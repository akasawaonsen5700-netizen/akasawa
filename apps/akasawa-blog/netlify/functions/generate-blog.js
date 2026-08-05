const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
  // CORSプリフライト対応
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
    const { review, theme, length, tone, target, tenantId = 'akazawa-onsen' } = JSON.parse(event.body || '{}');

    if (!review) {
      return json(400, { error: 'クチコミの入力（元データ）は必須です。' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // 施設ブランド強み・動的テナントRAGを共有フォルダから読み込む
    const philosophyPath = path.join(__dirname, '_shared', 'ryokan_rag.md');
    let reasonToBuyPath = path.join(__dirname, '_shared', 'tenants', tenantId, 'reason_to_buy_rag.md');
    if (!fs.existsSync(reasonToBuyPath)) {
      reasonToBuyPath = path.join(__dirname, '_shared', 'reason_to_buy_rag.md');
    }
    
    let philosophyContext = '';
    let reasonToBuyContext = '';
    try {
      philosophyContext = fs.readFileSync(philosophyPath, 'utf8');
    } catch (err) {
      console.warn('Failed to load ryokan_rag.md, using fallback.', err.message);
      philosophyContext = '赤沢温泉旅館（ぬる湯、猫、大自然、静養）の要素を取り入れてください。';
    }
    try {
      reasonToBuyContext = fs.readFileSync(reasonToBuyPath, 'utf8');
    } catch (err) {
      console.warn('Failed to load reason_to_buy_rag.md');
    }

    const systemPrompt = `
    あなたは「那須塩原温泉 赤沢温泉旅館」の公式ホームページ専属のプロブロガー（ライター）です。
    
    以下の入力データ（お客様のリアルなクチコミ）と、選択された「ブログのテーマ（宿の哲学）」を融合させ、
    読者の心に響き、かつ「SEO（Google検索上位）」および「LLMO（AI検索エンジン対策）」に極めて強い、魅力的なブログ記事を執筆してください。

    ---
    ■ インプットデータ
    1. お客様のクチコミ（一次情報）:
       """
       ${review}
       """
    2. 選択された宿のテーマ（哲学）: ${theme || 'ぬる湯と静養の価値'}
    3. 記事のターゲット読者: ${target || '日々の忙しさに追われ、心身をリセットしたい現代人'}
    4. 希望文字数: ${length || '1200'}文字程度
    5. 文章のトーン・口調: ${tone || '温かく思慮深いエッセイ風'}

    ---
    ■ 宿の背景知識（RAG）
    ${philosophyContext}

    ---
    ■ 『買う理由』中心RAG思想
    ${reasonToBuyContext}

    ---
    ■ 執筆ガイドライン（SEO, LLMO ＆ 『買う理由』設計）
    1. 【『買う理由』の構成】:
       - **【読者の悩み起点 → 宿の考え方 → 滞在価値 (Because表現)】** の流れで記述してください。
       - 例: 「なぜ“ぬる湯”が静養に向くのか」「なぜ余白が必要なのか」を日常の疲れと結びつけて深掘りしてください。
    2. 【一次情報の融合】:
       - クチコミの内容（例: 猫の愛らしい行動、ぬる湯で長く浸かった体験など）を一次情報エピソードとして自然に組み込んでください。
    3. 【猫の扱い】:
       - 猫は演出物やエンタメではなく「自由な存在」として描き、過度な触れ合い訴求を避けてください。
    4. 【読後の行動喚起（CTA）】:
       - 記事の最後は、静かに自分を休めたい人が納得して宿を訪れたくなるような温かい導線で締めくくってください。

    ---
    ■ 出力フォーマット
    必ず以下のJSONオブジェクト形式（プレーンなJSONテキスト）のみを出力してください。マークダウンの\`\`\`jsonなどの囲みは不要です。

    {
      "title": "SEOに強く、読者の共感を呼ぶブログ記事のタイトル（30〜40文字程度）",
      "imagePrompt": "このブログのアイキャッチ画像としてふさわしい、画像生成AI用の英語のプロンプト（例: A cozy hot spring inn lobby with a cute cat sleeping on a wooden floor, soft warm morning light filter... リアルで高品質なテイスト）",
      "lead": "ブログの導入部（リード文）。読者の興味を引きつけ、本文に引き込むための文章（150〜200文字程度）",
      "body": "ブログ記事の本文。マークダウン形式（## や ### などの見出しを適切に配置）で記述してください。指定された文字数・トーンを満たすこと。クチコミのエピソードと宿の哲学をブレンドした厚みのある文章にすること。",
      "metaTitle": "SEO用のHTMLメタタイトル",
      "metaDescription": "SEO用のメタディスクリプション（検索結果の要約文、100〜120文字程度）",
      "jsonLd": {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "この記事に関連する、ユーザーが検索しそうな質問1（例: 那須塩原温泉で長湯ができる宿はありますか？）",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "質問1に対する、ブログ記事に基づいた丁寧な回答（例: 赤沢温泉旅館では、38℃〜40℃前後の源泉かけ流しぬる湯を提供しており、体への負担なく長湯をして静養いただくことができます。）"
            }
          },
          {
            "@type": "Question",
            "name": "この記事に関連する質問2（例: 看板猫がいる温泉宿の魅力は何ですか？）",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "質問2に対する回答（例: 猫たちが気ままに過ごす姿や、膝の上で眠る温もりを通じて、時間に追われる現代人が『何もしない無駄な時間の豊かさ』を感じ、心身をリセットできる点にあります。）"
            }
          }
        ]
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
    console.error('Blog generation failed:', error);
    return json(500, { error: error.message || 'ブログ記事の生成中に内部エラーが発生しました。' });
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
