const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

function buildFallbackScript(theme) {
  const fallbackMap = {
    '私を甘やかす、ご褒美時間': {
      hook: '「頑張りすぎている、あなたへ。」',
      script: '毎日仕事や人間関係で気を張っていませんか？熱すぎない赤沢温泉の「ぬる湯」にゆっくり浸かって深呼吸。何もしない時間を自分にプレゼントしましょう。私を甘やかす、ご褒美時間。'
    },
    '「ちゃんとしなきゃ」を手放す言葉': {
      hook: '「『完璧じゃなくていい』って、知ってる？」',
      script: '世界中の森を見てきた私から伝えたいのは、完璧な自然なんて一つもないということ。曲がった木も苔も美しい。あなたもそのままでいいんです。「ちゃんとしなきゃ」を手放してみませんか。'
    },
    '世界を旅したオーナーが教える、本当の豊かさ': {
      hook: '「画面の中の比較に疲れたら。」',
      script: '南米や海外の現場で数字と格闘してきた私がたどり着いたのは、奥日本の静けさでした。誰かの評価ではなく、自分の心の心地よさを大切にする生き方を。'
    },
    '静寂と森に包まれる、五感の癒やし': {
      hook: '「風の音、水の音に耳を傾けて。」',
      script: '渓流のせせらぎ、風の音、看板猫のぬくもり。デジタル社会で疲れた五感をリセットする時間が、赤沢温泉旅館にはあります。心を空っぽにする贅沢を。'
    },
    '自分を取り戻す、奥日本リセット旅': {
      hook: '「私だけの物語を旅する。」',
      script: '誰のためでもない、自分のためのリセット旅。奥日本の静かな原風景と温かいぬる湯が、日常で傷ついた心をそっと癒やします。自分を取り戻す時間へ。'
    }
  };

  return fallbackMap[theme] || {
    hook: `「${theme.substring(0, 20)}」を求めるあなたへ。`,
    script: `毎日お疲れ様です。赤沢温泉のぬる湯と大自然の中で、肩の荷をそっと下ろしてみませんか。${theme}をテーマに、自分を大切にする時間をお過ごしください。`
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const theme = body.theme || '私を甘やかす、ご褒美時間';

    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      const fallback = buildFallbackScript(theme);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(fallback)
      };
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `
あなたは「遠藤正俊」（元植林博士・赤沢温泉旅館オーナー）のSNSショート動画台本を作成するAIプロデューサーです。

■ ターゲット顧客: 20代〜30代の女性（仕事疲れ・ご褒美旅・チル・自己肯定感）
■ 動画テーマ: ${theme}

■ 指示
1. 冒頭3秒で手を止めるフック文（hook: 25文字以内）
2. 遠藤オーナーがAIアバターで喋る温かい台本（script: 150〜220文字程度）
必ず以下のJSONのみを出力してください:
{"hook": "フック文", "script": "アバター用台本"}
`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      });

      let responseText = result.response.text().trim();
      if (responseText.startsWith('```')) {
        responseText = responseText.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
      }

      const data = JSON.parse(responseText.trim());
      if (data && data.hook && data.script) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify(data)
        };
      }
    } catch (geminiError) {
      console.warn('Gemini generation failed, using fallback:', geminiError.message);
    }

    const fallback = buildFallbackScript(theme);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(fallback)
    };

  } catch (error) {
    console.error('generate-script-from-rag Error:', error);
    const fallback = buildFallbackScript('私を甘やかす、ご褒美時間');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(fallback)
    };
  }
};
