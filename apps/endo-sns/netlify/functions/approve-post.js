const { z } = require('zod');
const { getDb, admin } = require('./_lib/firebase-admin');
const { ok, badRequest, methodNotAllowed, parseBody, json } = require('./_lib/helpers');
const { buildDraftPackage } = require('./_lib/ai');
const { publishToChannel } = require('./_lib/publishers');

const schema = z.object({
  id: z.string().min(1),
  action: z.enum(['approve', 'reject', 'regenerate', 'publish_now']),
  channel: z.string().nullable().optional(),
  publishAt: z.string().nullable().optional()
});

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return ok({ ok: true });
  if (event.httpMethod !== 'POST') return methodNotAllowed();

  try {
    const { id, action, publishAt, channel } = schema.parse(parseBody(event));
    const db = getDb();
    const ref = db.collection('submissions').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return badRequest('対象データが見つかりません');
    const current = snap.data();

    const channelStatuses = { ...(current.channelStatuses || {}) };
    const channelSettings = { ...(current.channelSettings || {}) };
    const targetChannels = channel ? [channel] : (current.channels || []);

    if (action === 'reject') {
      targetChannels.forEach(ch => {
        channelStatuses[ch] = 'rejected';
      });
      
      const allFinished = (current.channels || []).every(ch => {
        const s = channelStatuses[ch];
        return s === 'published' || s === 'rejected' || s === 'failed';
      });
      const nextStatus = allFinished ? 'rejected' : 'review_required';

      await ref.update({
        status: nextStatus,
        channelStatuses,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return ok({ id, status: nextStatus });
    }

    if (action === 'approve') {
      targetChannels.forEach(ch => {
        channelStatuses[ch] = 'approved';
        if (publishAt) {
          if (!channelSettings[ch]) channelSettings[ch] = {};
          channelSettings[ch].publishAt = publishAt;
        }
      });

      const allApproved = (current.channels || []).every(ch => channelStatuses[ch] === 'approved' || channelStatuses[ch] === 'published');
      const nextStatus = allApproved ? 'approved' : 'review_required';

      await ref.update({
        status: nextStatus,
        channelStatuses,
        channelSettings,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return ok({ id, status: nextStatus });
    }

    if (action === 'publish_now') {
      targetChannels.forEach(ch => {
        channelStatuses[ch] = 'approved';
      });
      
      await ref.update({
        channelStatuses,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 最新のデータを取得して配信
      const updatedSnap = await ref.get();
      const submission = { id: updatedSnap.id, ...updatedSnap.data() };
      
      const publishResults = [];
      for (const ch of targetChannels) {
        try {
          console.log(`[PublishNow] Publishing to ${ch} for ${submission.id}...`);
          const result = await publishToChannel(ch, submission);
          publishResults.push(result);
          channelStatuses[ch] = 'published';
        } catch (err) {
          console.error(`[PublishNow] Failed to publish ${ch}:`, err);
          publishResults.push({ ch, mode: 'error', error: err.message });
          channelStatuses[ch] = 'failed';
        }
      }

      const allFinished = (submission.channels || []).every(ch => {
        const s = channelStatuses[ch];
        return s === 'published' || s === 'rejected' || s === 'failed';
      });
      const nextStatus = allFinished ? 'published' : 'publishing';

      await ref.update({
        status: nextStatus,
        channelStatuses,
        publishLog: admin.firestore.FieldValue.arrayUnion({
          at: new Date().toISOString(),
          results: publishResults
        }),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return ok({ id, status: nextStatus, results: publishResults });
    }

    const regenerated = await buildDraftPackage({ ...current, publishAt: publishAt || current.publishAt });
    await ref.update({
      ...regenerated,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return ok({ id, status: regenerated.status });
  } catch (error) {
    console.error(error);
    if (error.name === 'ZodError') {
      return badRequest(error.issues.map(issue => issue.message).join(', '));
    }
    return json(500, { error: error.message || 'Internal error' });
  }
};
