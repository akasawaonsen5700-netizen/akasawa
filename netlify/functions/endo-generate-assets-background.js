const { getDb } = require('./_lib-endo/firebase-admin');
const { triggerAutoRenderFlow } = require('./_lib-endo/auto-render-flow');
const { generateDraftWithGemini, classifySubmission } = require('./_lib-endo/ai');

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
    
    // バックグラウンドでSNS投稿文章をGeminiで生成（Netlify 10秒タイムアウト回避）
    try {
      console.log(`[Background] Starting Gemini draft generation for ID: ${id}`);
      const classification = data.classification || classifySubmission(data);
      const geminiDraft = await generateDraftWithGemini(data, classification);
      
      if (geminiDraft) {
        await docRef.update({
          'drafts.instagram.text': geminiDraft.instagram.text,
          'drafts.instagram.narration': geminiDraft.instagram.narration,
          'drafts.x.text': geminiDraft.x.text,
          'drafts.x.narration': geminiDraft.x.narration,
          'altText': geminiDraft.altText || data.altText
        });
        console.log(`[Background] Gemini draft successfully updated for ID: ${id}`);
        // 最新データを反映
        data.drafts.instagram = geminiDraft.instagram;
        data.drafts.x = geminiDraft.x;
      }
    } catch (geminiError) {
      console.error(`[Background] Gemini draft generation failed for ID: ${id}`, geminiError);
    }

    // バックグラウンドで音声合成と動画生成を実行
    await triggerAutoRenderFlow(db, docRef, data, voiceUrl);
    console.log(`[Background] Auto render flow successfully completed for ID: ${id}`);
    
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('[Background Error]:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
