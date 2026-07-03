const { z } = require('zod');
const { getDb, admin } = require('./_lib-endo/firebase-admin');
const { ok, badRequest, methodNotAllowed, parseBody, json } = require('./_lib-endo/helpers');
const { buildDraftPackage } = require('./_lib-endo/ai');

const schema = z.object({
  id: z.string().min(1),
  action: z.enum(['approve', 'reject', 'regenerate']),
  publishAt: z.string().nullable().optional()
});

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return ok({ ok: true });
  if (event.httpMethod !== 'POST') return methodNotAllowed();

  try {
    const { id, action, publishAt } = schema.parse(parseBody(event));
    const db = getDb();
    const ref = db.collection('submissions').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return badRequest('対象データが見つかりません');
    const current = snap.data();

    if (action === 'reject') {
      const channelStatuses = { ...(current.channelStatuses || {}) };
      (current.channels || []).forEach(ch => {
        channelStatuses[ch] = 'rejected';
      });
      await ref.update({
        status: 'rejected',
        channelStatuses,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return ok({ id, status: 'rejected' });
    }

    if (action === 'approve') {
      const channelStatuses = { ...(current.channelStatuses || {}) };
      const channelSettings = { ...(current.channelSettings || {}) };
      (current.channels || []).forEach(ch => {
        if (channelStatuses[ch] === 'review_required' || !channelStatuses[ch]) {
          channelStatuses[ch] = 'approved';
        }
        if (publishAt) {
          if (!channelSettings[ch]) channelSettings[ch] = {};
          channelSettings[ch].publishAt = publishAt;
        }
      });
      await ref.update({
        status: 'approved',
        channelStatuses,
        channelSettings,
        publishAt: publishAt || current.publishAt,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return ok({ id, status: 'approved' });
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
