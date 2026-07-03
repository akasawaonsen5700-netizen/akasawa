const dayjs = require('dayjs');
const { getDb, admin } = require('./_lib-endo/firebase-admin');
const { ok, json } = require('./_lib-endo/helpers');
const { publishToChannel } = require('./_lib-endo/publishers');

exports.handler = async () => {
  try {
    const db = getDb();
    const now = dayjs().toISOString();
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
