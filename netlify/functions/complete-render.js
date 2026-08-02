const { getDb, admin } = require('./_lib-endo/firebase-admin');
const { ok, badRequest, methodNotAllowed, parseBody, json } = require('./_lib-endo/helpers');

/**
 * AWS Lambdaで動画生成が正常終了したことを受け取り、
 * Firestoreドキュメントの動画URLとステータスを「完了」に更新します。
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return ok({ ok: true });
  if (event.httpMethod !== 'POST') return methodNotAllowed();

  try {
    const { id, videoUrl } = parseBody(event);
    if (!id || videoUrl === undefined) {
      return badRequest('id and videoUrl are required');
    }

    const db = getDb();
    const docRef = db.collection('submissions').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return badRequest('Submission not found');
    }

    console.log(`[CompleteRender] Updating Firestore for ID: ${id} with videoUrl: ${videoUrl}`);

    await docRef.update({
      videoUrl: videoUrl,
      'channelSettings.instagram.videoUrl': videoUrl,
      videoStatus: 'completed',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return ok({ ok: true });
  } catch (error) {
    console.error('[CompleteRender Error]:', error);
    return json(500, { error: error.message || 'Internal error' });
  }
};
