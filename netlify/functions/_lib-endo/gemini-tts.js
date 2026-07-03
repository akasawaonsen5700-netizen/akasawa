const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getBucket } = require('./firebase-admin');

/**
 * Gemini APIを使用してテキストから音声を生成し、Firebase Storageに保存してURLを返します。
 * @param {string} text 読み上げるテキスト
 * @param {string} filename 保存するファイル名 (例: 'submission_123.wav')
 * @param {string} voiceName 音声モデル名 ('Charon', 'Puck', 'Fenrir', 'Aoede', 'Kore')
 */
async function generateVoiceFromText(text, filename, voiceName = 'Charon') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  // 音声出力は gemini-2.0-flash モデルを使用
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  console.log(`Generating voice for text: "${text.substring(0, 30)}..." using voice: ${voiceName}`);

  const response = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `以下のテキストを落ち着いたトーンで、自然に朗読してください。余計な前置きや解説は一切含めず、テキストのみを読み上げてください。\n\n${text}`
          }
        ]
      }
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            // Puck: 男性、Charon: 男性、Kore: 女性、Fenrir: 男性、Aoede: 女性
            // 65歳の渋い声に近いトーンとして Charon または Puck を指定
            voiceName: voiceName
          }
        }
      }
    }
  });

  const candidate = response.response.candidates?.[0];
  const part = candidate?.content?.parts?.find(
    (p) => p.inlineData && p.inlineData.mimeType.startsWith('audio/')
  );

  if (!part || !part.inlineData || !part.inlineData.data) {
    throw new Error('Failed to generate audio from Gemini API');
  }

  const audioBase64 = part.inlineData.data;
  const audioBuffer = Buffer.from(audioBase64, 'base64');

  // Firebase Storageへ保存
  const bucket = getBucket();
  const file = bucket.file(`voices/${filename}`);
  await file.save(audioBuffer, {
    metadata: {
      contentType: 'audio/wav',
      cacheControl: 'public, max-age=31536000'
    }
  });

  // 公開URLを取得可能にする
  await file.makePublic().catch(err => {
    console.warn('makePublic failed, attempting alternative metadata access', err);
  });

  return `https://storage.googleapis.com/${bucket.name}/voices/${filename}`;
}

module.exports = { generateVoiceFromText };
