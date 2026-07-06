const { getDb } = require('./_lib/firebase-admin');
const { triggerAutoRenderFlow } = require('./_lib/auto-render-flow');

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { id, voiceUrl } = body;
    if (!id) {
      console.error('[Background] Missing submission ID');
      return;
    }
    
    console.log(`[Background] Starting assets generation for ID: ${id}`);
    const db = getDb();
    const docRef = db.collection('submissions').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      console.error(`[Background] Submission ${id} not found`);
      return;
    }
    
    const data = snap.data();
    
    // バックグラウンドで音声合成と動画生成を実行
    await triggerAutoRenderFlow(db, docRef, data, voiceUrl);
    console.log(`[Background] Auto render flow successfully completed for ID: ${id}`);
  } catch (err) {
    console.error('[Background Error]:', err);
  }
};
