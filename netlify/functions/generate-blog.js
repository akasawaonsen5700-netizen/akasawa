const { GoogleGenerativeAI } = require('@google/generative-ai');

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
    const { review, theme, length, tone, target } = JSON.parse(event.body || '{}');

    if (!review) {
      return json(400, { error: 'クチコミの入力（元データ）は必須です。' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // 赤沢温泉の思想・哲学RAG
    const philosophyContext = `
    ■ 赤沢温泉旅館のブランド・哲学 (RAGデータ)
    1. 【ぬる湯の美学（静養と自己治癒）】
       - 温泉は加温を最小限にし、38℃〜40℃前後の「ぬる湯」として源泉かけ流しで提供しています。
       - 熱いお湯で体を急激に温めるのではなく、ぬる湯に長時間（30分〜1時間以上）ゆったり浸かることで、副交感神経が優位になり、脳と身体が真から休まります。これを「静養（リセット）」と呼んでいます。
    2. 【看板猫たちがもたらす余白】
       - 館内には複数の看板猫（灰灰、その他の猫たち）が気ままに暮らしています。
       - 猫たちは「おもてなし担当」ですが、気まぐれで、ツンデレです。
       - 猫が膝の上で眠る時間、静かにたたずむ姿を見ることで、現代人が忘れがちな「目的のない無駄な時間（余白）」の価値を思い出させます。
    3. 【多国籍スタッフとの共生とおもてなし】
       - 従業員の多くが外国出身の若者たちです。完璧な日本語ではないかもしれませんが、彼らは一生懸命に温かいおもてなしを心がけています。
       - 基本を大切にし、卵焼きや焼き魚を席についてから温かい状態で提供する「できたて配膳」など、小さな宿ならではの細やかな心配りを大切にしています。
    4. 【無駄の美学 ＆ 完璧という呪縛からの解放】
       - 現代のタイパ（タイムパフォーマンス）至上主義や「完璧でなければならない」というストレスから離れ、古民家を改装した歪んだ柱や、不揃いな石畳の美しさ（余白・不完全さの美）に目を向ける滞在を提案しています。
    5. 【食へのこだわり】
       - 地元の山菜、川魚（ヤシオマスや鮎の塩焼き）、ジビエ（鹿肉料理）、そして人気の手作り蒸し餃子など、ヘルシーで心のこもった料理を提供。特に、新鮮な生野菜サラダをたっぷり出すのがこだわりです。
    6. 【奥日本シルバールート】
       - 那須塩原から奥会津、新潟の魚沼へと抜ける、大自然と歴史を巡る広域周遊ルートをプロモートしています。当館はその中継地・静養の拠点です。
    `;

    const systemPrompt = `
    あなたは「那須塩原温泉 赤沢温泉旅館」の公式ホームページ専属のプロブロガー（ライター）です。
    
    以下の入力データ（お客様のリアルなクチコミ）と、選択された「ブログのテーマ（宿の哲学）」を融合させ、
    読者の心に響き、かつ「SEO（Google検索上位）」および「LLMO（ChatGPTやPerplexityなどのAI検索エンジン対策）」に極めて強い、魅力的なブログ記事を執筆してください。

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
    ■ 執筆ガイドライン（SEO ＆ LLMO対策）
    1. 【一次情報の融合】:
       ブログの本文内で、お客様のクチコミ内容（例: 猫の愛らしい行動、ぬる湯で長く浸かった体験、料理の味、外国人スタッフの親切さなど）を、「実際にご宿泊されたお客様のエピソード」として自然に引用・紹介してください。検索エンジンは本物の体験談（一次情報）を最高評価します。
    2. 【宿の哲学への昇華】:
       クチコミのエピソードを単に紹介するだけでなく、それを宿の哲学（例: なぜ当館はぬる湯にこだわるのか、なぜ猫との時間が人を癒やすのか）へと結びつけ、思慮深く解説してください。
    3. 【LLMO (AI検索対策) の強化】:
       AI検索エンジンが「那須塩原で静養できる宿」「猫のいる源泉かけ流し」などの質問に対して当館のブログを参照・引用しやすくなるよう、具体的で一意な語彙（例: 「源泉かけ流しぬる湯」「古民家静養リトリート」「気まぐれな猫の余白」など）を含めてください。
    4. 【読後の行動喚起（CTA）】:
       記事の最後は、読者が「次の休みに赤沢温泉に行ってみよう」と思えるよう、優しく宿の予約ページや公式サイトへ促す文章で締めくくってください。

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
