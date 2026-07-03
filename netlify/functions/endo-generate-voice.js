const { generateVoiceFromText } = require('./_lib-endo/gemini-tts');
const { generateVoiceFromCartesia } = require('./_lib-endo/cartesia-tts');
const { getDb } = require('./_lib-endo/firebase-admin');
const { ok, badRequest, methodNotAllowed, parseBody, json } = require('./_lib-endo/helpers');
const { z } = require('zod');

const schema = z.object({
  text: z.string().min(1, 'Text is required'),
  submissionId: z.string().optional(),
  voiceName: z.string().optional().default('Charon')
});

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return ok({ ok: true });
  if (event.httpMethod !== 'POST') return methodNotAllowed();

  try {
    const payload = schema.parse(parseBody(event));
    const filename = `voice_${payload.submissionId || Date.now()}_${payload.voiceName}.wav`;
    
    // Cartesia の設定が存在する場合は Cartesia API で遠藤正俊クローン音声を生成し、
    // そうでない場合は従来どおり Gemini API で生成する
    let audioUrl;
    if (process.env.CARTESIA_API_KEY && process.env.CARTESIA_VOICE_ID) {
      audioUrl = await generateVoiceFromCartesia(payload.text, filename);
    } else {
      audioUrl = await generateVoiceFromText(payload.text, filename, payload.voiceName);
    }

    // submissionIdがある場合はFirestoreの該当ドキュメントを更新
    if (payload.submissionId) {
      const db = getDb();
      const docRef = db.collection('submissions').doc(payload.submissionId);
      const doc = await docRef.get();
      if (doc.exists) {
        await docRef.update({
          voiceUrl: audioUrl,
          voiceName: payload.voiceName,
          // チャンネル個別の設定にも反映
          'channelSettings.instagram.voiceUrl': audioUrl
        });
      }
    }

    return ok({ ok: true, audioUrl });
  } catch (error) {
    console.error('Error generating voice:', error);
    if (error.name === 'ZodError') {
      return badRequest(error.issues.map(issue => issue.message).join(', '));
    }
    return json(500, { error: error.message || 'Failed to generate voice' });
  }
};
