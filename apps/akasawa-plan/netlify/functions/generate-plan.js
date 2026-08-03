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
    const reasonToBuyPath = path.join(__dirname, '_shared', 'reason_to_buy_rag.md');
    
    let ryokanRag = '';
    let reasonToBuyRag = '';
    try {
      ryokanRag = fs.readFileSync(ryokanRagPath, 'utf8');
    } catch (err) {
      console.warn('Failed to load ryokan_rag.md, using fallback.', err.message);
      ryokanRag = '赤沢温泉旅館（ぬる湯、猫、大自然、静養）の要素を取り入れてください。';
    }
    try {
      reasonToBuyRag = fs.readFileSync(reasonToBuyPath, 'utf8');
    } catch (err) {
      console.warn('Failed to load reason_to_buy_rag.md');
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
    ■ 『買う理由』中心RAG設計原則:
    ${reasonToBuyRag}

    ---
    ■ 重要な設計ルール（AI・人間ハイブリッド型）：
    1. **【『買う理由』構文の徹底】**:
       - 施設スペック（部屋・設備）の羅列ではなく、**「誰向けか → 何が得られるか(ベネフィット) → なぜそう言えるか(Because)」**という構造でプランタイトル・説明文を構成してください。
       - タイトルやキャッチコピーは、「静かに休みたい方へ」「ぬる湯と自然音にほどける」など滞在目的・理由が伝わる名称を優先してください。
    2. **【AI検索対策（LLMO/SEO）】**:
       - プラン名および本文中に、検索されやすく具体的な属性キーワード（例: 「源泉かけ流しぬる湯」「静養」「看板猫」「渓流の音」「不完全さの美学」など）を豊富に組み込んでください。
    3. **【猫の扱い方】**:
       - 猫は触れ合い放題のコンテンツではなく「自由に過ごす気配を静かに見守る存在」として表現してください。
    4. **【市場調査・価格意味づけ】**:
       - 安売りではなく、なぜこの価格に価値があるのか（静養に集中できる環境、できたて食事、長湯温泉）を理由として説明してください。

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
