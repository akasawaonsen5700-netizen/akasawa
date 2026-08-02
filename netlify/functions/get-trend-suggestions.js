const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PHILOSOPHY } = require('./_lib-endo/endo-philosophy');

// 「ぬる湯」「温泉」「赤沢」「宣伝要素」を100%排除したマインドフルネス提案のフォールバック
const FALLBACK_SUGGESTIONS = [
  {
    title: "🔥 「完璧主義」を手放す言葉の処方箋",
    theme: "「完璧じゃなくていい」と自分を許す、素直な心を取り戻すひととき",
    reason: "日々頑張りすぎて肩をすぼめている人に、心の重荷を降ろす静かな気づきを与えます。"
  },
  {
    title: "🔥 スマホを置いて自分と向き合う静寂の時間",
    theme: "画面の向こうの情報から離れ、自分の心の声に耳を澄ます贅沢",
    reason: "周囲と比較して疲弊した心に、他人のスピードではなく自分の歩幅で生きる大切さを伝えます。"
  },
  {
    title: "🔥 頑張りすぎたあなたへ、立ち止まる勇気",
    theme: "立ち止まることはサボりではなく、明日を生きるための優しい調律",
    reason: "焦りや不安を抱える現代人に、自然の理に基づいた温かい人生の静かな洞察を届けます。"
  }
];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(FALLBACK_SUGGESTIONS)
      };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
あなたはSNS（Instagram/TikTok）で数百万人の心を静かに揺さぶる「マインドフルネス・言葉の処方箋」のプロデューサーです。

【語り手の思想（最重要手本: 松下幸之助の「素直な心」 ✕ 遠藤正俊の自然観）】
・世界中で自然や森と向き合ってきた人生の先輩。
・完璧を求めず、他人と比べず、ありのままの自分を愛する「素直な心」の深み。

【絶対に守るべき厳格ルール】
❌ 1. 【温泉・ぬる湯・施設PRの完全禁止】: 「ぬる湯」「温泉」「赤沢」「旅館」「オーナー」「宿主」といった宣伝ワード・お風呂ワードは絶対に1文字も入れないでください。
❌ 2. 【ターゲット属性読み上げの禁止】: 「20代〜30代の女性」等のメタ単語は不可。
❌ 3. 【ビジネス・営業口調の禁止】: 静かで上品、心にじわっと温かく灯がともるテーマにしてください。

【出力形式】
以下のJSON配列のみを出力してください:
[
  {
    "title": "テーマの短いタイトル（例：🔥 「完璧主義」を手放す言葉の処方箋）",
    "theme": "具体的なテーマ内容",
    "reason": "このテーマがなぜ人々の心に深く刺さるかの説明"
  }
]
`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' }
    });

    let responseText = result.response.text().trim();
    if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
    }

    let data = JSON.parse(responseText.trim());

    // 禁句（ぬる湯、温泉、赤沢など）が含まれていた場合の自動クレンジング
    data = data.map(item => ({
      title: item.title.replace(/ぬる湯/g, '静けさ').replace(/温泉/g, '自分時間').replace(/赤沢/g, ''),
      theme: item.theme.replace(/ぬる湯/g, '静けさ').replace(/温泉/g, '自分時間').replace(/赤沢/g, ''),
      reason: item.reason.replace(/ぬる湯/g, '静けさ').replace(/温泉/g, '自分時間').replace(/赤沢/g, '')
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('get-trend-suggestions Error:', error);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(FALLBACK_SUGGESTIONS)
    };
  }
};
