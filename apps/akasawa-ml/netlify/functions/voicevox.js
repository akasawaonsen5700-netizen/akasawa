/**
 * Netlify Function: voicevox
 * VOICEVOX Web API を使って音声合成を行う
 * API Key 1→2→3 の順にフォールバック
 */
const https = require('https');

const VOICEVOX_HOST = 'deprecatedapis.tts.quest';

/**
 * VOICEVOX Web API を呼び出して音声データを取得する
 */
function callVoicevoxAPI(apiKey, text, speaker, pitch, speed) {
  return new Promise((resolve, reject) => {
    const encodedText = encodeURIComponent(text);
    const path = `/v2/voicevox/audio/?key=${apiKey}&speaker=${speaker}&pitch=${pitch}&intonationScale=1&speed=${speed}&text=${encodedText}`;

    const options = {
      hostname: VOICEVOX_HOST,
      path: path,
      method: 'GET',
      headers: {
        'Accept': 'audio/wav, audio/mpeg, */*'
      },
      timeout: 15000
    };

    const chunks = [];
    const req = https.request(options, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        let errBody = '';
        res.on('data', d => { errBody += d; });
        res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${errBody.substring(0, 100)}`)));
        return;
      }
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          data: Buffer.concat(chunks),
          contentType: res.headers['content-type'] || 'audio/wav'
        });
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout (15s)'));
    });

    req.end();
  });
}

exports.handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // プリフライトリクエスト対応
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };
  }

  // リクエストボディ解析
  let reqBody;
  try {
    reqBody = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers: corsHeaders, body: 'Invalid JSON body' };
  }

  const {
    text = '',
    speaker = 5,       // デフォルト: 東北ずん子
    pitch = 0,
    speed = 1.0
  } = reqBody;

  if (!text || text.trim().length === 0) {
    return { statusCode: 400, headers: corsHeaders, body: '`text` field is required' };
  }

  // APIキーのリスト（環境変数から取得）
  const apiKeys = [
    process.env.VOICEVOX_API_KEY_1,
    process.env.VOICEVOX_API_KEY_2,
    process.env.VOICEVOX_API_KEY_3
  ].filter(k => k && k.trim() !== '');

  if (apiKeys.length === 0) {
    return {
      statusCode: 503,
      headers: corsHeaders,
      body: 'No VOICEVOX API keys configured. Please set VOICEVOX_API_KEY_1/2/3 in environment variables.'
    };
  }

  let lastError = null;

  // APIキーを順番に試行
  for (let i = 0; i < apiKeys.length; i++) {
    const apiKey = apiKeys[i];
    try {
      console.log(`VOICEVOX: APIキー${i + 1}で試行中... speaker=${speaker}`);
      const result = await callVoicevoxAPI(apiKey, text.trim(), speaker, pitch, speed);
      console.log(`VOICEVOX: APIキー${i + 1}で成功 (${result.data.length} bytes)`);

      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': result.contentType
        },
        body: result.data.toString('base64'),
        isBase64Encoded: true
      };
    } catch (err) {
      console.error(`VOICEVOX: APIキー${i + 1}失敗: ${err.message}`);
      lastError = err;
    }
  }

  // 全キー失敗
  return {
    statusCode: 503,
    headers: corsHeaders,
    body: `All ${apiKeys.length} VOICEVOX API keys failed. Last error: ${lastError?.message}`
  };
};
