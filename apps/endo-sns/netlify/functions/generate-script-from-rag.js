const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 20〜30代女性が心から共感する・自然でエモい高品質フォールバック台本
function buildFallbackScript(theme) {
  const fallbackMap = {
    '私を甘やかす、ご褒美時間': {
      hook: '「また、頑張りすぎてない？」',
      script: '毎日誰かのために気を張って、自分のことは後回し。そんな夜は、ちょっと立ち止まっていいんです。人肌より少し温かいぬる湯に体をあずけて、ただ深く息を吸う。何も考えない数時間が、明日をちょっと優しくしてくれます。'
    },
    '「ちゃんとしなきゃ」を手放す言葉': {
      hook: '「完璧じゃなくていい、本当に。」',
      script: '世界中の森を見てきて気づいたのは、真っ直ぐな木なんて一本もないってこと。曲がった枝も苔むした幹も、みんな美しい。あなたも、そのままで十分頑張ってる。「ちゃんとしなきゃ」の鎧、ここで脱いでいきませんか。'
    },
    '世界を旅したオーナーが教える、本当の豊かさ': {
      hook: '「スマホの画面、閉じたら。」',
      script: 'SNSのキラキラした世界と比べて、疲れてしまう夜もありますよね。でも、本当の贅沢って、誰もいない森の静寂の中で、ぬる湯の波紋をぼーっと眺める時間だったりします。あなただけの「心地よさ」を取り戻して。'
    },
    '静寂と森に包まれる、五感の癒やし': {
      hook: '「風の音、聞こえますか？」',
      script: '渓流のせせらぎ、木々の揺れる音、膝の上にのってくる猫のぬくもり。デジタルな毎日に疲れた頭を空っぽにして、五感全部で静けさを味わう。そんなご褒美が、ここにはあります。'
    },
    '自分を取り戻す、奥日本リセット旅': {
      hook: '「私を、私に戻す場所。」',
      script: '誰の機嫌もとらなくていい。時間も気にせず、好きなだけぬる湯に浸かって、自分と会話する。日常の喧騒から少し離れるだけで、忘れていた「自分の好き」がすーっと戻ってきますよ。'
    }
  };

  return fallbackMap[theme] || {
    hook: '「一息つく時間、足りてますか？」',
    script: '毎日がんばるあなたへ。たまには立ち止まって、静かな自然とぬる湯に心を預けてみませんか。自分を一番大切にする、優しい時間を過ごせますように。'
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
      console.warn('GEMINI_API_KEY not found in process.env, returning fallback script');
      const fallback = buildFallbackScript(theme);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(fallback)
      };
    }

    let ragContent = '';
    try {
      const { PHILOSOPHY } = require('./_lib/endo-philosophy');
      ragContent = PHILOSOPHY;
    } catch (err) {
      console.warn('Failed to read RAG corpus:', err);
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `
あなたはSNS（Instagramリール/TikTok）で大ヒットする動画を作るトップクリエイター・コピーライターです。
語り手は、世界中で植林をしてきた静かで温かい人生の先輩「遠藤正俊（赤沢温泉旅館オーナー）」。

【ターゲット視聴者】
SNS疲れ・仕事疲れ・タイパ疲れ・完璧主義で「ちゃんとしなきゃ」と自分を追い込んでいる20代〜30代の女性。

【動画テーマ】
${theme}

【絶対に守るべき厳格ルール（反した場合は即やり直し）】
❌ 1. 絶対に「皆さん、こんにちは」「赤沢温泉旅館オーナーの遠藤正俊です」のような営業的・硬い自己紹介を冒頭に入れないでください。（SNS動画では一瞬で離脱されます）
❌ 2. 絶対に「20代〜30代の女性の皆さん」「働く女性の皆様」といったターゲットの属性を表す言葉を台本本文に書かないでください。（不自然でメタ的な表現になり冷めます）
❌ 3. 定型文や宣伝チラシのような言葉遣いはNGです。「〜にお越しください」「〜でございます」のような堅苦しい接客用語は使わず、夜の静けさの中でそっと語りかけるような、エモーショナルで温かい口調（〜ですよ、〜ですよね、〜してみませんか）にしてください。

【構成指針】
・冒頭3秒（hook）: スクロールする指がピタッと止まる、共感・ハッとする言葉（20文字以内）
・台本本文（script）: 心の緊張がすーっとほぐれ、深呼吸したくなるような語り（140文字〜190文字程度）

【思想インプット】
${ragContent.substring(0, 1000)}

必ず以下のJSON形式のみを出力してください（JSON以外のテキストやMarkdown装飾は禁止）:
{"hook": "フック文", "script": "アバター用台本"}
`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { 
          responseMimeType: 'application/json',
          temperature: 0.7
        }
      });

      let responseText = result.response.text().trim();
      if (responseText.startsWith('```')) {
        responseText = responseText.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
      }

      const data = JSON.parse(responseText.trim());
      if (data && data.hook && data.script) {
        // 万が一プロンプト違反のテキストが混ざった場合の自動クリーニング
        data.script = data.script
          .replace(/皆さん、こんにちは[。！]?/g, '')
          .replace(/赤沢温泉旅館?オーナーの遠藤正俊です[。！]?/g, '')
          .replace(/20代[〜~ー]?30代の女性の?皆?様?さん?/g, '')
          .trim();

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
