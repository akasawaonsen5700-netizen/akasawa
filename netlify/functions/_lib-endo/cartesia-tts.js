const { getBucket } = require('./firebase-admin');

/**
 * Cartesia APIを使用してテキストからクローン音声を生成し、Firebase Storageに保存してURLを返します。
 * @param {string} text 読み上げるテキスト
 * @param {string} filename 保存するファイル名 (例: 'voice_123_cartesia.wav')
 */
async function generateVoiceFromCartesia(text, filename) {
  const apiKey = process.env.CARTESIA_API_KEY;
  const voiceId = process.env.CARTESIA_VOICE_ID;
  if (!apiKey) {
    throw new Error('CARTESIA_API_KEY is not configured');
  }
  if (!voiceId) {
    throw new Error('CARTESIA_VOICE_ID is not configured in .env');
  }

  console.log(`Generating Cartesia voice for text: "${text.substring(0, 30)}..." using Voice ID: ${voiceId}`);

  // Cartesia API 音声合成リクエスト
  const response = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: {
      'Cartesia-Version': '2024-06-10',
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model_id: 'sonic-3.5', // 最新の多言語モデル
      transcript: text,
      voice: {
        mode: 'id',
        id: voiceId
      },
      output_format: {
        container: 'wav',
        encoding: 'pcm_s16le', // 標準的な16ビットPCM。再生エラーを防ぐため s16le にしておきます
        sample_rate: 44100
      },
      language: 'ja'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cartesia API error (HTTP ${response.status}): ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = Buffer.from(arrayBuffer);

  // ローカル環境用に public/voices にも書き出す
  try {
    const fs = require('fs');
    const path = require('path');
    const localDir = path.join(process.cwd(), 'apps', 'endo-sns', 'public', 'voices');
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const localPath = path.join(localDir, filename);
    fs.writeFileSync(localPath, audioBuffer);
    console.log(`Saved voice to local path: ${localPath}`);
  } catch (err) {
    console.error('Failed to save voice file locally:', err);
  }

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

module.exports = { generateVoiceFromCartesia };
