import fetch from 'node-fetch';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { text, lang } = JSON.parse(event.body || '{}');
    if (!text) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Text is required' }) };
    }

    const apiKey = process.env.CARTESIA_API_KEY;
    const voiceId = process.env.CARTESIA_VOICE_ID || 'a513cd1d-17cd-4a92-94e3-de112db4a58e';

    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'CARTESIA_API_KEY is missing' }) };
    }

    const response = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        'Cartesia-Version': '2024-06-10',
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model_id: 'sonic-multilingual',
        transcript: text,
        voice: {
          mode: 'id',
          id: voiceId
        },
        output_format: {
          container: 'wav',
          encoding: 'pcm_f32le',
          sample_rate: 44100
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Cartesia API error:', errText);
      return { statusCode: response.status, body: errText };
    }

    const buffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(buffer).toString('base64');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Access-Control-Allow-Origin': '*'
      },
      body: base64Audio,
      isBase64Encoded: true
    };
  } catch (error) {
    console.error('Cartesia TTS error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
