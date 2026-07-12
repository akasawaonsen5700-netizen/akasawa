const { GoogleGenerativeAI } = require('@google/generative-ai');

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
    const ryokanRag = `
    ■ 那須塩原温泉 赤沢温泉旅館 の強みと独自のポジショニング (RAGデータ)
    1. 【源泉かけ流しぬる湯 (38〜40℃)】
       - 一般的な温泉宿（加温で熱い温泉）に対して、当館は源泉そのままの「ぬる湯」を提供。
       - 長時間（30分〜1時間以上）体に負担なく浸かることで、自律神経を整え、脳と体を真から休める「静養（リセット）」の体験価値。
    2. 【看板猫たちと過ごす、目的のない余白】
       - ロビーや廊下、時にはお部屋を訪れる人懐っこい猫たち（灰灰など）。
       - 現代人が忘れがちな「時間を無駄にする豊かさ」「何もしない余白」を提供。
    3. 【多国籍スタッフによる心温まるおもてなし ＆ できたて配膳】
       - 外国人スタッフが一生懸命にサービス。
       - 朝食のお膳では、席に着いてから温かい卵焼きや焼き魚を配膳する「できたて」へのこだわり。
       - 夕食時の「揚げたて天ぷら」「手作り蒸し餃子（奥様特製）」が好評。
    4. 【古民家をリノベーションした歴史ある佇まいと自然環境】
       - 箒川（ほうきがわ）の対岸に位置し、喧騒から離れた大自然の中の一軒宿。目の前には滝が見える抜群のロケーション。
       - 柱の歪みや不揃いな石畳などを「完璧という呪縛からの解放」として楽しむ不完全さの美学。
    5. 【奥日本シルバールート】
       - 那須塩原から会津を通り新潟（魚沼）へ抜ける、豊かな自然と古き良き日本の風景をめぐる新しい観光ドライブルート。当館はその中継・中核拠点。
    6. 【貸別荘（ペット同伴対応）】
       - 本館とは別に、愛犬と完全プライベートな空間で温泉を楽しめる古民家貸別荘（離れ）を用意。
    `;

    const systemPrompt = `
    あなたは那須塩原の「赤沢温泉旅館」専属のホテルマーケティングコンサルタント、およびプロのプランナーです。
    楽天トラベルやじゃらんの「AI検索」と、人間の旅行者の「エモーショナルな予約動機」の双方に最適化された宿泊プランを自律設計してください。
    
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
       - 楽天トラベルのAI検索は、プラン名や説明文に含まれる「具体的名詞（お部屋タイプ、特典、温泉の種類、立地、食事の食材など）」をベースにユーザーの検索とマッチングします。
       - プラン名および本文中に、検索されやすく具体的な属性キーワード（例: 「源泉かけ流しぬる湯」「ペットと泊まれる宿」「露天風呂付き客室」「個室風配膳」「看板猫」「箒川の渓流」「一人旅」「手作り餃子」「できたて朝食」「レイトチェックアウト」など）を豊富に、しかし自然な文章として組み込んでください。
    2. **【情緒的ストーリー（人間へのアピール）】**:
       - プラン説明文（本文）は、単なるスペック羅列ではなく、ターゲット顧客が「この部屋で、この料理を食べ、温泉で癒やされ、猫と戯れる」という具体的な滞在イメージ（ストーリー）をエッセイ調またはルポルタージュ調の上品な日本語で記述してください。
    3. **【市場調査・ポジショニング分析】**:
       - このプランがなぜ他の那須塩原温泉の競合に対して優位性を持つのかという「市場背景と差別化のポイント」、および安売りせず付加価値で売るための「推奨価格」とその設定理由を出力に含めてください。

    ---
    ■ 出力フォーマット
    必ず以下のJSONオブジェクト形式（プレーンなJSONテキスト）のみを出力してください。マークダウンの\`\`\`jsonなどの囲みは不要です。

    {
      "marketAnalysis": "市場のトレンド、競合との差別化（ポジショニング）、なぜこのプランが今最適なのかの分析（マークダウン形式、150〜200文字程度）",
      "pricingStrategy": "このプランに推奨する販売価格レンジ（大人1名あたり、例: ¥18,000〜¥25,000）と、その価格を設定すべき強み（付加価値）の根拠。",
      "aiKeywords": [
        "AI検索エンジンや旅行AIがインデックスとして検知しやすい、このプランに仕込まれた具体的キーワード1（例: 源泉かけ流しぬる湯）",
        "キーワード2",
        "キーワード3",
        "キーワード4",
        "キーワード5"
      ],
      "planName": "【AI・SEO最適化】人間の心を惹きつけるキャッチーなプランタイトル（楽天・じゃらんの制限文字数である50文字以内を厳守し、【】やフックとなるワードを組み合わせること）",
      "catchCopy": "プラン一覧画面で表示される、人間を惹きつける魅力的なキャッチコピー（80〜100文字程度）",
      "description": "人間向け：このプランで体験できる極上の滞在ストーリー。見出し（H3レベル）を使い、到着からぬる湯、猫、できたて料理、翌朝の静養までの追体験を情緒豊かな筆致で描くこと。マークダウン形式（H3や箇条書きを含む）で700〜900文字程度。",
      "otaSettings": {
        "roomType": "充てるべき推奨客室タイプ（例: プチスイート（ペット可） または プレミアムスイート など）",
        "mealType": "食事条件の設定（夕食・朝食付き、など）",
        "perks": "設定すべき具体的なオリジナル特典のリスト（例: ・愛犬用の猫・犬用ちゅーるプレゼント ・レイトチェックアウト1時間無料 など）",
        "couponAdvice": "このプランを売るために楽天トラベルやじゃらんで発行すべきクーポン（割引率）や、参画すべきセールの推奨設定。"
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
