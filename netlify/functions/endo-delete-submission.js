const { z } = require('zod');
const { getDb } = require('./_lib-endo/firebase-admin');
const { ok, badRequest, methodNotAllowed, parseBody, json } = require('./_lib-endo/helpers');

const schema = z.object({
  id: z.string().min(1)
});

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return ok({ ok: true });
  if (event.httpMethod !== 'POST') return methodNotAllowed();

  try {
    const payload = schema.parse(parseBody(event));
    const db = getDb();
    
    // Firestore の submissions コレクションから該当ドキュメントを削除
    await db.collection('submissions').doc(payload.id).delete();
    
    return ok({ success: true });
  } catch (error) {
    console.error(error);
    if (error.name === 'ZodError') {
      return badRequest(error.issues.map(issue => issue.message).join(', '));
    }
    return json(500, { error: error.message || 'Internal error' });
  }
};
