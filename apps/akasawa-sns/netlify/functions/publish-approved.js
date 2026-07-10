const dayjs = require('dayjs');
const { getDb, admin } = require('./_lib/firebase-admin');
const { ok, json } = require('./_lib/helpers');
const { publishToChannel } = require('./_lib/publishers');
const { getRenderProgress } = require('@remotion/lambda-client');

exports.handler = async () => {
  try {
    const db = getDb();
    const now = dayjs().toISOString();

    // ----------------------------------------------------
    // 【動画生成の自動回収スイーパー（Cron見回り）】
    // ----------------------------------------------------
    console.log('[Cron] Checking for rendering videos on AWS...');
    const renderingSnap = await db.collection('submissions')
      .where('videoStatus', '==', 'rendering_video')
      .limit(10)
      .get();

    for (const doc of renderingSnap.docs) {
      const data = doc.data();
      const awsRenderId = data.awsRenderId;
      const awsBucketName = data.awsBucketName;
      const awsRegion = data.awsRegion || 'ap-northeast-1';
      
      if (!awsRenderId || !awsBucketName) {
        continue;
      }

      try {
        const awsAccessKey = process.env.REMOTION_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
        const awsSecretKey = process.env.REMOTION_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
        const functionName = process.env.REMOTION_AWS_FUNCTION_NAME;

        if (awsAccessKey && awsSecretKey && functionName) {
          process.env.AWS_ACCESS_KEY_ID = awsAccessKey;
          process.env.AWS_SECRET_ACCESS_KEY = awsSecretKey;

          const progress = await getRenderProgress({
            region: awsRegion,
            bucketName: awsBucketName,
            renderId: awsRenderId,
            functionName
          });

          if (progress.done) {
            console.log(`[Cron] Video completed for submission: ${doc.id}`);
            await doc.ref.update({
              videoUrl: progress.outputFile,
              'channelSettings.instagram.videoUrl': progress.outputFile,
              videoStatus: 'completed',
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          } else if (progress.fatalErrorEncountered) {
            console.error(`[Cron] Video render failed for submission: ${doc.id}`);
            await doc.ref.update({
              videoStatus: 'failed',
              videoError: progress.errors?.[0]?.message || 'AWS render fatal error',
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
      } catch (checkErr) {
        console.error(`[Cron] Error checking progress for ${doc.id}:`, checkErr);
      }
    }

    // ----------------------------------------------------
    // 【通常のSNS自動配信処理】
    // ----------------------------------------------------
    const snapshot = await db.collection('submissions')
      .where('status', 'in', ['approved', 'publishing'])
      .limit(10)
      .get();

    const results = [];
    for (const doc of snapshot.docs) {
      const submission = { id: doc.id, ...doc.data() };
      const publishResults = [];
      const channelStatuses = { ...(submission.channelStatuses || {}) };
      const channelSettings = submission.channelSettings || {};

      const channelsToPublish = (submission.channels || []).filter(channel => {
        const status = channelStatuses[channel];
        const currentStatus = status || (submission.status === 'approved' ? 'approved' : 'draft');
        const setting = channelSettings[channel] || {};
        const publishTime = setting.publishAt || submission.publishAt || now;
        return currentStatus === 'approved' && publishTime <= now;
      });

      if (channelsToPublish.length === 0) {
        continue;
      }

      for (const channel of channelsToPublish) {
        try {
          const result = await publishToChannel(channel, submission);
          publishResults.push(result);
          channelStatuses[channel] = 'published';
        } catch (err) {
          console.error(`Failed to publish channel ${channel} for ${submission.id}:`, err);
          publishResults.push({ channel, mode: 'error', error: err.message });
          channelStatuses[channel] = 'failed';
        }
      }

      const allFinished = (submission.channels || []).every(channel => {
        const s = channelStatuses[channel];
        return s === 'published' || s === 'rejected' || s === 'failed';
      });

      const nextStatus = allFinished ? 'published' : 'publishing';

      await doc.ref.update({
        status: nextStatus,
        channelStatuses,
        publishLog: admin.firestore.FieldValue.arrayUnion({
          at: new Date().toISOString(),
          results: publishResults
        }),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      results.push({ id: doc.id, publishResults });
    }

    return ok({ processed: results.length, results });
  } catch (error) {
    console.error(error);
    return json(500, { error: error.message || 'Internal error' });
  }
};
