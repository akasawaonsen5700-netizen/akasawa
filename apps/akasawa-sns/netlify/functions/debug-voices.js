const { ok, json } = require('./_lib/helpers');

exports.handler = async (event) => {
  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) {
    return json(400, { error: 'CARTESIA_API_KEY is not configured in .env' });
  }

  try {
    console.log('Fetching Cartesia voices to find Akasawa Masatoshi voice...');
    const response = await fetch('https://api.cartesia.ai/voices', {
      headers: {
        'X-API-Key': apiKey,
        'Cartesia-Version': '2024-06-10'
      }
    });

    if (!response.ok) {
      return json(response.status, { error: 'Cartesia API error', details: await response.text() });
    }

    const voices = await response.json();
    
    // 赤沢温泉旅館氏の組織ID（あるいは名前）でカスタムボイスを検索
    const userOrgId = "org_3FyKRw7UBQHRS9pdQ5zJJ8WUrDl";
    const customVoices = voices.filter(v => 
      v.owner_id === userOrgId || 
      v.name.toLowerCase().includes('akasawa') || 
      v.name.includes('赤沢温泉旅館') ||
      (v.description && (v.description.includes('赤沢温泉旅館') || v.description.toLowerCase().includes('akasawa')))
    );

    // 日本語対応のボイス
    const japaneseVoices = voices.filter(v => 
      v.language === 'ja' || 
      (v.languages && v.languages.includes('ja')) ||
      v.name.toLowerCase().includes('japanese')
    );

    return json(200, {
      message: "利用可能なボイスをスキャンしました。以下の推奨ボイスIDをコピーして .env に設定してください。",
      recommendedAkasawaVoices: customVoices.map(v => ({ name: v.name, id: v.id, owner_id: v.owner_id })),
      japanesePublicVoices: japaneseVoices.map(v => ({ name: v.name, id: v.id, languages: v.language || v.languages }))
    });
  } catch (error) {
    console.error('debug-voices error:', error);
    return json(500, { error: error.message || 'Internal error' });
  }
};
