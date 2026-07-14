const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
  // CORS対応
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(500, { error: 'GEMINI_API_KEY is not configured in server environment variables.' });
  }

  try {
    const { direction, customNotes } = JSON.parse(event.body || '{}');

    if (!direction) {
      return json(400, { error: 'プランの企画方向性は必須項目です。' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // 赤沢温泉旅館の強み（RAG）
    const ryokanRagPath = path.join(__dirname, '_shared', 'ryokan_rag.md');
    let ryokanRag = '';
    try {
      ryokanRag = fs.readFileSync(ryokanRagPath, 'utf8');
    } catch (err) {
      console.warn('Failed to load ryokan_rag.md, using fallback.', err.message);
      ryokanRag = '赤沢温泉旅館（ぬる湯、猫、大自然、静養）の要素を取り入れてください。';
    }

    const systemPrompt = `
    あなたは那須塩原の「赤沢温泉旅館」専属のホテルマーケティングコンサルタント、およびプロのプランナーです。
    楽天トラベルやじゃらんの「AI検索」と、人間の旅行者の「エモーショナルな予約動機」の双方に最適化された宿泊プランを自律設計してください。
    
    今回は、以下の2パターンのプランを【同時に】作成してください。
    1. 年間通して販売できる定番のプラン（yearRoundPlan）
    2. 特定の時期や短期的な需要を狙った特別プラン（shortTermPlan）

    ---
    ■ 今回のプラン企画の方向性 (ユーザー指定):
    """
    ${direction}
    """
    ※補足事項: ${customNotes || '特になし'}

    ---
    ■ 赤沢温泉旅館のブランド強み（RAG）:
    ${ryokanRag}

    ---
    ■ 重要な設計ルール（AI・人間ハイブリッド型）：
    1. **【AI検索対策（LLMO/SEO）】**:
       - プラン名および本文中に、検索されやすく具体的な属性キーワード（例: 「源泉かけ流しぬる湯」「ペットと泊まれる宿」「露天風呂付き客室」「看板猫」など）を豊富に、自然な文章として組み込んでください。
    2. **【情緒的ストーリー（人間へのアピール）】**:
       - プラン説明文（本文）は、ターゲット顧客が具体的な滞在イメージ（ストーリー）を追体験できるエッセイ調またはルポルタージュ調の上品な日本語で記述してください。
    3. **【市場調査・ポジショニング分析】**:
       - このプランがなぜ他の那須塩原温泉の競合に対して優位性を持つのかという「市場背景と差別化のポイント」、および安売りせず付加価値で売るための「推奨価格」とその設定理由を含めてください。

    ---
    ■ 出力フォーマット
    必ず以下のJSONオブジェクト形式（プレーンなJSONテキスト）のみを出力してください。マークダウンの\`\`\`jsonなどの囲みは不要です。

    {
      "yearRoundPlan": {
        "marketAnalysis": "市場のトレンド、競合との差別化（ポジショニング）、なぜこのプランが最適なのかの分析（マークダウン形式、150〜200文字程度）",
        "pricingStrategy": "このプランに推奨する販売価格レンジ（大人1名あたり）と、その価格を設定すべき強みの根拠。",
        "aiKeywords": ["キーワード1", "キーワード2", "キーワード3", "キーワード4", "キーワード5"],
        "planName": "【AI・SEO最適化】人間の心を惹きつけるキャッチーなプランタイトル（50文字以内）",
        "catchCopy": "プラン一覧画面で表示される、人間を惹きつける魅力的なキャッチコピー",
        "description": "人間向け：このプランで体験できる極上の滞在ストーリー。見出し（H3レベル）を使い情緒豊かな筆致で描くこと。マークダウン形式で700〜900文字程度。",
        "otaSettings": {
          "roomType": "充てるべき推奨客室タイプ",
          "mealType": "食事条件の設定",
          "perks": "設定すべき具体的なオリジナル特典のリスト",
          "couponAdvice": "このプランを売るために発行すべきクーポンやセールの推奨設定"
        }
      },
      "shortTermPlan": {
        "marketAnalysis": "市場のトレンド、競合との差別化（ポジショニング）、なぜこのプランが最適なのかの分析（マークダウン形式、150〜200文字程度）",
        "pricingStrategy": "このプランに推奨する販売価格レンジ（大人1名あたり）と、その価格を設定すべき強みの根拠。",
        "aiKeywords": ["キーワード1", "キーワード2", "キーワード3", "キーワード4", "キーワード5"],
        "planName": "【AI・SEO最適化】人間の心を惹きつけるキャッチーなプランタイトル（50文字以内）",
        "catchCopy": "プラン一覧画面で表示される、人間を惹きつける魅力的なキャッチコピー",
        "description": "人間向け：このプランで体験できる極上の滞在ストーリー。見出し（H3レベル）を使い情緒豊かな筆致で描くこと。マークダウン形式で700〜900文字程度。",
        "otaSettings": {
          "roomType": "充てるべき推奨客室タイプ",
          "mealType": "食事条件の設定",
          "perks": "設定すべき具体的なオリジナル特典のリスト",
          "couponAdvice": "このプランを売るために発行すべきクーポンやセールの推奨設定"
        }
      }
    }
    `;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });

    let responseText = result.response.text().trim();
    if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      },
      body: responseText
    };

  } catch (error) {
    console.error('Plan generation failed:', error);
    return json(500, { error: error.message || 'プランの作成中に内部エラーが発生しました。' });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
  };
}
