const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * RAG知識・出力厳格ルール（猫の表現・露天風呂・ペット宿泊）に基づき、
 * 1クレジット消費（30秒以内・約25秒〜28秒尺・130文字〜150文字）に適合した
 * 台本をランダム出力する多系フォールバックマップ
 */
function buildFallbackScript(theme) {
  const fallbackVariations = {
    '私を甘やかす、ご褒美時間': [
      {
        hook: '「その重荷、降ろしませんか？」',
        script: '私たちは皆、完璧であろうと頑張りすぎてしまいますね。森の木々がただそこに在るだけで美しいように、ありのままのあなたで尊いもの。言葉にならない静けさに身を委ね、素直な心で自分を慈しむ時間を持つこと。それが明日を生きる穏やかな力となると思うのです。'
      },
      {
        hook: '「自分を甘やかすのは、悪ではありません。」',
        script: '休むことに罪悪感を覚える必要はありません。道具を休ませるように、心にも休息が必要です。何も生産しない時間を自分に与え、素直な心を取り戻すこと。その静かなご褒美が、疲れ切った心に新しい潤いをもたらしてくれると思うのです。'
      },
      {
        hook: '「頑張りすぎた心に、ご褒美を。」',
        script: '毎日誰かのために走り続けてきたあなたへ。たまには立ち止まり、自分のためだけに静かなお茶を淹れてみる。他人の基準ではなく自分の歩幅を愛すること。素直な心で自分を慈しむ時間こそが、明日への大切な活力になると信じているのです。'
      }
    ],
    '「ちゃんとしなきゃ」を手放す言葉': [
      {
        hook: '「完璧な姿など、どこにもありません。」',
        script: '自然の森には真っ直ぐな木ばかりではありません。どれも曲がり、風に耐え、そのまま生きている。人も同じです。完璧を目指して肩を張らず、ありのままの自分を赦してあげる。それだけで、心に心地よい風が吹き抜けていくと思うのです。'
      },
      {
        hook: '「『完璧』の二文字をそっと置いてみる。」',
        script: 'ちゃんとしなきゃと自分を追い詰めると、素直な声を見失いがちです。不完全さの中にこそ、人間らしい温もりが宿るもの。肩の力を抜き、今の自分のままで歩んでみる。それだけで景色はガラリと優しく変わるのではないでしょうか。'
      },
      {
        hook: '「歪みがあるから、人は美しい。」',
        script: '風に揺れる木々に同じ形がないように、心も揺れて当たり前です。自分の弱さもそっと抱きしめてあげる。素直な心で自分と向き合うとき、肩肘張らずに生きる本当の強さと静けさが戻ってくると思うのです。'
      }
    ],
    '本当の豊かさと自分らしさ': [
      {
        hook: '「他人のスピードに惑わされなくていい。」',
        script: '周りと比べて焦る必要はありません。本当の豊かさとは、静かな場所で自分の心を慈しめること。他人の基準ではなく、あなた自身の歩幅で一日を重ねていく。自分のペースを愛せる素直な心こそが、最も贅沢な生き方ではないでしょうか。'
      },
      {
        hook: '「豊かな人生とは、心が穏やかであること。」',
        script: '多くのものを所有することだけが幸せではありません。木漏れ日や呼吸の深さに気づける素直な心を持つこと。世間の物差しを手放し、自分が心から心地よいと感じる時間を生きる。それこそが何より確かな豊かさだと思うのです。'
      },
      {
        hook: '「自分だけの歩幅を、愛すること。」',
        script: '他人の評価で自分を測ると心がすり減ってしまいます。大切なのは自分の声に耳を傾け、ありのままの歩みを尊重すること。静かな空間で自分と対話し今日を慈しむ。誰かと比べるのをやめたとき、確かな安心感が広がると思うのです。'
      }
    ],
    '静寂と森に包まれる、五感の癒やし': [
      {
        hook: '「静けさの中に、答えがあります。」',
        script: '風の音や木の葉の揺れに耳を澄ませてみる。雑音を横へ置き、五感の感じるままに身を委ねる。言葉を超えた自然の静寂に身を置くだけで、日常で擦り切れた心の調和がすーっと戻ってくる。素直な心で静けさと共にあることが何よりの癒やしです。'
      },
      {
        hook: '「森の静寂が、傷ついた心を包み込む。」',
        script: '忙しない喧騒から少し離れ、大自然の静寂に身を浸してみる。木々が放つ静かな気配は、言葉以上に心を優しく包み込んでくれます。頭で考えるのをやめ心が静かになる時間を自分に許すことで、本来の自分が甦ってくる気がするのです。'
      },
      {
        hook: '「耳を澄ますと、心が澄んでいく。」',
        script: '慌ただしい日常の中では自分の声すら聞こえなくなりますね。静かな環境でゆっくり呼吸を繰り返してみる。胸の底に溜まった疲労が解き放たれ心が澄み渡っていく。素直な心で静寂を味わう時間こそが明日へのエネルギーだと思うのです。'
      }
    ],
    '自分を取り戻す、マインドリセット': [
      {
        hook: '「心に、小さな余白を作りましょう。」',
        script: '誰かの期待に応えようと無理を重ねていませんか。一日のうちわずかでもいい、仮面を脱いで自分と向き合う時間を作る。素直な心で感情を受け止めてあげることで自分を取り戻せる。心にゆったりとした余白を持つことが大切だと思うのです。'
      },
      {
        hook: '「一度、立ち止まる勇気を持ってみる。」',
        script: '走り続けることだけが正解ではありません。行き詰まったときこそ立ち止まり、重荷を降ろしてみる。心に隙間が生まれたとき、新しい一歩を踏み出す穏やかなパワーが湧いてくる。素直な心で休むことは前進なのだと思うのです。'
      },
      {
        hook: '「本当の自分に、還る場所。」',
        script: '日常の立場や面目を脱ぎ捨て、素の自分に戻る時間を持つこと。静かな空間で心と体を休ませ、頑張ってきた自分を褒めてあげる。そうして心のリセットを行うことが、どんな時代も自分らしく生き抜くための大切な知恵だと思うのです。'
      }
    ]
  };

  const list = fallbackVariations[theme] || fallbackVariations['私を甘やかす、ご褒美時間'];
  const randomIndex = Math.floor(Math.random() * list.length);
  return list[randomIndex];
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const body = event.body ? JSON.parse(event.body || '{}') : {};
  const theme = body.theme || '私を甘やかす、ご褒美時間';

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      const fallback = buildFallbackScript(theme);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(fallback)
      };
    }

    let ragContent = '';
    try {
      const { PHILOSOPHY } = require('./_lib-endo/endo-philosophy');
      ragContent = PHILOSOPHY;
    } catch (err) {
      console.warn('Failed to read RAG corpus:', err);
    }

    const randomSeed = Math.floor(Math.random() * 100000);

    const fetchGeminiScript = async () => {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `
あなたはTikTokやInstagramリールで数百万人の心に深く静かな感動を与える動画プロデューサーです。

【最重要要求: 動画尺を30秒未満（約25秒〜28秒・文字数 130文字〜150文字程度）にピッタリ収めること】
HeyGenのクレジット消費を最小限（1動画＝1クレジット）に抑えるため、文字数は必ず【130文字〜150文字程度】（音声で25秒〜28秒尺）にジャスト調整して書き下ろしてください。（シード値: ${randomSeed}）

【語り手の思想・ペルソナ（最重要手本: 松下幸之助の「素直な心」 ✕ 遠藤正俊の自然観）】
・話者背景: 世界中で自然や森と向き合ってきた70歳手前の人生の先輩（遠藤正俊）。
・お手本: 松下幸之助氏のような「素直な心」「人間への深い温かさと尊敬」「謙虚で誇らない姿勢」。
・『買う理由』の核: 単なる物やサービスの宣伝ではなく、「静かにほどける時間」「何もしない余白」「自分を取り戻す理由」を語る。
・語り口: 上品、深み、静けさ。「〜ですね」「〜だと思うのです」「〜ではないでしょうか」と、静かに心にともしびを灯すような、温かく語りかける口調。

【最新RAG知識・表現に関する厳格ルール（反したらやり直し）】
❌ 1. 【「看板猫」の表現完全禁止】: 「看板猫」という単語・表現は絶対に使わないこと。（※猫は館内や旅館で自由気ままに生活しており、触れ合いたい客には別棟の「猫カフェ」を案内する世界観）。
❌ 2. 【「露天風呂」の前面訴求禁止】: 「露天風呂」を宿のメインの売りとして前面に出さないこと。
❌ 3. 【「ペット同伴宿泊」の全面宣伝禁止】: ペットと泊まれる部屋は限られるため、全面的な宣伝として前面には出さないこと（※専用プランでのみ専用使用として案内する）。
❌ 4. 【「ぬる湯」「温泉」「お風呂」「赤沢」「旅館」「オーナー」の完全禁止】: 宣伝ワードや自己紹介・PRは絶対に1文字も入れないこと！

【模範とする正解出力例（130〜150文字）】
hook: "その重荷、降ろしませんか？"
script: "私たちは皆、完璧であろうと頑張りすぎてしまいますね。森の木々がただそこに在るだけで美しいように、ありのままのあなたで尊いもの。言葉にならない静けさに身を委ね、素直な心で自分を慈しむ時間を持つこと。それが明日を生きる穏やかな力となると思うのです。"

【今回のテーマ】
${theme}

【構成規定】
・冒頭3秒（hook）: スマホのスクロールの手がピタッと止まる、静かで本質的な問いかけ（15文字以内）
・台本本文（script）: 文字数は必ず【130文字〜150文字程度】（音声で25秒〜28秒尺）に調整すること。

【思想インプット】
${ragContent.substring(0, 1000)}

必ず以下のJSON形式のみを出力してください（JSON以外のテキストやMarkdown装飾は禁止）:
{"hook": "フック文", "script": "アバター用台本"}
`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { 
          responseMimeType: 'application/json',
          temperature: 0.8
        }
      });

      let responseText = result.response.text().trim();
      if (responseText.startsWith('```')) {
        responseText = responseText.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
      }

      const data = JSON.parse(responseText.trim());
      if (data && data.hook && data.script) {
        data.script = data.script
          .replace(/看板猫/g, '猫ちゃん')
          .replace(/露天風呂/g, '風呂')
          .replace(/ペットと泊まれる/g, '')
          .replace(/皆さん、こんにちは[。！]?/g, '')
          .replace(/赤沢温泉旅館?オーナーの遠藤正俊です[。！]?/g, '')
          .replace(/赤沢温泉/g, '')
          .replace(/赤沢/g, '')
          .replace(/旅館/g, '')
          .replace(/オーナー/g, '')
          .replace(/ぬる湯/g, '静けさ')
          .replace(/温泉/g, '自然')
          .replace(/お風呂/g, '静けさ')
          .replace(/湯船/g, '静寂')
          .replace(/20代[〜~ー]?30代の?女?性?の?皆?様?さん?/g, '')
          .trim();

        data.hook = data.hook
          .replace(/看板猫/g, '猫ちゃん')
          .replace(/露天風呂/g, '風呂')
          .replace(/ぬる湯/g, '静けさ')
          .replace(/温泉/g, '自然')
          .replace(/赤沢/g, '');

        return data;
      }
      throw new Error('Invalid JSON structure from Gemini');
    };

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout 4000ms')), 4000)
    );

    try {
      const scriptData = await Promise.race([fetchGeminiScript(), timeoutPromise]);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(scriptData)
      };
    } catch (raceErr) {
      console.warn('Gemini generation timed out or failed, returning randomized fallback script:', raceErr.message);
      const fallback = buildFallbackScript(theme);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(fallback)
      };
    }

  } catch (error) {
    console.error('generate-script-from-rag Error:', error);
    const fallback = buildFallbackScript(theme);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(fallback)
    };
  }
};
