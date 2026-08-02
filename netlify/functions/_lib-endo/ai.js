const dayjs = require('dayjs');
const { BRAND } = require('./brand');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// 20〜30代女性ターゲット向け5つのコンテンツクラスター
const THEME_KEYWORDS = {
  '私を甘やかす、ご褒美時間': ['ご褒美', 'セルフケア', 'ぬる湯', '何もしない贅沢', 'デトックス', '温泉', 'チル', '癒やし', '自分磨き'],
  '「ちゃんとしなきゃ」を手放す言葉': ['完璧主義', '自己肯定感', '不安', '人間関係', '焦り', '肩の荷', '頑張りすぎる', '自分らしく', '言葉の処方箋'],
  '世界を旅したオーナーが教える、本当の豊かさ': ['世界を歩いて', '森林学', '植林', '数字や比較', '丁寧な暮らし', '豊かな時間', '自分を大切に'],
  '静寂と森に包まれる、五感の癒やし': ['森林浴', '渓流の音', '星空', '自然音', '看板猫', 'マインドフルネス', '静けさ', 'デジタルデトックス'],
  '自分を取り戻す、奥日本リセット旅': ['女子旅', 'ソロ活', '奥日本シルバールート', 'リセット旅', '日常からの脱出', '秘境', '自分探しの旅']
};

function classifySubmission(input) {
  const text = [input.ownerComment, input.location, input.simpleTag, input.ngMemo]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const scores = Object.entries(THEME_KEYWORDS)
    .map(([theme, terms]) => ({
      theme,
      score: terms.reduce((sum, term) => sum + (text.includes(term.toLowerCase()) ? 1 : 0), 0)
    }))
    .sort((a, b) => b.score - a.score);

  const primary = input.simpleTag || (scores[0]?.score ? scores[0].theme : '私を甘やかす、ご褒美時間');
  const secondary = scores.filter(item => item.theme !== primary && item.score > 0).slice(0, 2).map(item => item.theme);
  return { primary, secondary };
}

function detectRisk(input) {
  const flags = [];
  const text = [input.ownerComment, input.ngMemo].filter(Boolean).join(' ');
  if (/人物|顔|お客様|child|kids|guest/i.test(text)) flags.push('人物確認');
  if (/入浴|湯船|水着なし|裸/i.test(text)) flags.push('入浴表現確認');
  if (/暗い|ブレ|ぼけ|低画質/i.test(text)) flags.push('画質確認');
  if (/ng|使わない|非公開|禁止/i.test(text)) flags.push('公開NGメモあり');
  
  const allAssets = [...(input.assets || [])];
  if (input.channelSettings) {
    Object.values(input.channelSettings).forEach(ch => {
      if (ch.assets) allAssets.push(...ch.assets);
    });
  }
  if (allAssets.some(asset => (asset.type || '').startsWith('video/'))) flags.push('動画内容確認');
  return { flags, requiresReview: flags.length > 0 };
}

function suggestedSchedule(primary, requested) {
  if (requested) return dayjs(requested).toISOString();
  const base = dayjs();
  return base.hour(20).minute(0).second(0).millisecond(0).add(1, 'day').toISOString();
}

// フォールバック用テンプレート生成（20〜30代女性向け）
function buildFallbackTone(input, classification) {
  const loc = input.location ? `${input.location}で` : '';
  const theme = classification.primary;

  const templates = {
    '私を甘やかす、ご褒美時間': {
      scene: `頑張る私へ、心身をゆるめるぬる湯のご褒美時間。`,
      detail: `日常の忙しさで、自分の疲れにすら気づけなくなっていませんか？熱すぎない「ぬる湯」にゆっくり浸かって、深呼吸するひとときを。`,
      instagramQuote: `“Rest is not idleness, and to lie sometimes on the grass under trees is by no means a waste of time.”\n(休むことは決してサボることではない。)`,
      xText: `毎日頑張りすぎているあなたへ。たまには「何もしない時間」を自分にプレゼントしませんか？`
    },
    '「ちゃんとしなきゃ」を手放す言葉': {
      scene: `「完璧じゃなくていい」と心から思える場所。`,
      detail: `自然の中に完璧な形がないように、あなたもそのままで美しい。世界中の森を巡ってきた元植林博士が贈る、肩の荷を下ろす言葉。`,
      instagramQuote: `“Be gentle with yourself. You are doing the best you can.”\n(自分に優しくあろう。あなたはもう充分頑張っているのだから。)`,
      xText: `「もっと頑張らなきゃ」と自分を責めていませんか？休むことは、また前を向くための大切な準備です。`
    },
    '世界を旅したオーナーが教える、本当の豊かさ': {
      scene: `SNSの比較から離れ、自分の心を満たす生き方。`,
      detail: `海外の現場で数字と格闘してきた私がたどり着いたのは、日本の田舎の静けさでした。誰かの評価ではなく、自分の心地よさを大切に。`,
      instagramQuote: `“Happiness is not a state to arrive at, but a manner of traveling.”\n(幸せとは到達する場所ではなく、旅する姿勢そのものである。)`,
      xText: `画面の中の誰かと自分を比べるのに疲れたら。森の静けさと温かい温泉が、あなたの心を包み込みます。`
    },
    '静寂と森に包まれる、五感の癒やし': {
      scene: `自然の音とぬる湯に抱かれ、五感をリセットする。`,
      detail: `渓流のせせらぎ、風の音、看板猫のぬくもり。デジタル社会で疲れた五感を取り戻す贅沢な時間。`,
      instagramQuote: `“In every walk with nature, one receives far more than he seeks.”\n(自然の中を歩けば、求める以上のものを手に入れることができる。)`,
      xText: `最後に「風の音」や「水の音」に耳を傾けたのはいつですか？心を空っぽにする贅沢がここにあります。`
    },
    '自分を取り戻す、奥日本リセット旅': {
      scene: `都会を離れ、私だけの物語を旅する。`,
      detail: `誰のためでもない、自分のためのリセット旅。奥日本の原風景と温かい温泉が、傷ついた心をそっと癒やします。`,
      instagramQuote: `“Journey to find your true self.”\n(自分らしさを取り戻す、温かな旅へ。)`
    }
  };

  const selected = templates[theme] || templates['私を甘やかす、ご褒美時間'];
  return {
    scene: `${loc}${selected.scene}`,
    detail: selected.detail,
    instagramQuote: selected.instagramQuote || '',
    xText: selected.xText || `${loc}${selected.scene} ${selected.detail}`
  };
}

function buildFallbackHashtags(classification, channel) {
  return [...BRAND.hashtagsBaseInstagram];
}

function draftForChannelFallback(channel, tone, classification, input) {
  const userText = input.ownerComment || '';
  if (channel === 'instagram') {
    const lines = [
      `【${BRAND.instagramTheme}】`,
      tone.scene,
      '毎日仕事や人間関係で気を張っていませんか？',
      'この動画には、そんなあなたの心をそっとゆるめるメッセージを込めています。',
      '',
      BRAND.profileInstagram
    ].filter(Boolean);
    return {
      text: `${lines.join('\n')}\n\n${buildFallbackHashtags(classification, 'instagram').join(' ')}`,
      narration: userText || `${tone.scene}。${tone.detail}`
    };
  } else if (channel === 'x') {
    const mainText = '「もっと頑張らなきゃ」と自分を追い詰めていませんか？\n\n情報や予定に追われる毎日の中で、私たちは「休むこと」に罪悪感を抱いてしまいがちです。\n\n心が少し疲れている方は、音声をオンにして動画を聴いてみてくださいね。\n\n' + BRAND.site;
    return {
      text: mainText.slice(0, 280),
      narration: userText || tone.xText
    };
  }
  return { text: userText };
}

// Gemini APIを使った高度な下書き生成（20〜30代女性ターゲット専用プロンプト）
async function generateDraftWithGemini(input, classification) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const systemPrompt = `
    あなたは「遠藤正俊」（元植林博士・赤沢温泉旅館オーナー）の公式SNSアカウント（Instagram・TikTok・X）のコンテンツを生成する専属AIです。

    ■ ターゲット顧客
    【20代〜30代の女性】
    （仕事、人間関係、SNS疲れ、自己肯定感の低さ、「ちゃんとしなきゃ」というプレッシャーを抱え、自分へのご褒美・癒やし・心の肩の荷を下ろす言葉・ぬる湯温泉でのリセットを求めている女性たち）

    ■ トーン＆マナー
    - 一人称は「私」。世界中の自然を見てきた人生の先輩・温かい理解者として、20〜30代女性に寄り添い、優しく語りかけてください。
    - 単なる旅館の宣伝ではなく、「頑張る女性の心をゆるめる言葉の処方箋」として作成してください。

    ■ 最重要ルール：キャプション（text）とナレーション台本（narration）は【完全に別物】
    - 「narration」= 動画用テロップ・AIアバター発話用の短尺台本（100〜180文字程度）。冒頭3秒でターゲット女性の手を止めるフックから始まり、心にじんわり響くメッセージにする。
    - 「text」= Instagram/Xの投稿文・キャプション。動画を見る前に視聴者の共感を誘い、「保存したい」「音声をオンにして聴いてみたい」と思わせる短く魅力的な文章（3〜5行）＋プロフィール文＋ハッシュタグ。

    ■ Instagram用の「text」（キャプション）の書き方
    1. 【本文】20〜30代女性の悩み（「仕事の疲れ」「SNSでの比較」「自分へのご褒美」等）に寄り添う共感文（3〜4行）。
    2. 【プロフィール紹介文】「${BRAND.profileInstagram}」をそのまま挿入。
    3. 【ハッシュタグ】末尾にターゲット女性が検索しそうな良質なハッシュタグを4〜5個付ける。（例: #ご褒美旅 #心のデトックス #自分を愛する時間 #チル旅 #赤沢温泉旅館）

    ■ X用の「text」（ポスト文）の書き方
    - 20〜30代女性のハッとする気づきや共感を誘う語りかけ文（140〜200文字程度） ＋ 公式サイトURL (${BRAND.site})。

    ■ 入力情報
    - オーナーの投稿メモ (動画台本ソース): ${input.ownerComment || '特になし'}
    - 指定テーマ: ${classification.primary}

    ■ 出力フォーマット
    必ず以下のJSONフォーマット（プレーンなJSONオブジェクト）のみを返してください。マークダウンの囲みは不要です。
    {
      "instagram": {
        "text": "Instagram用キャプション（共感フック文 + プロフィール紹介文 + ハッシュタグ）",
        "narration": "AIアバター用発話台本（冒頭3秒惹きつけフック + 語りかけ文 100〜180文字）"
      },
      "x": {
        "text": "X用投稿文（共感ポスト + サイトURL）",
        "narration": "X用読み上げテキスト"
      },
      "altText": "20-30代女性向け癒やし動画の代替テキスト（100文字程度）"
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
    const data = JSON.parse(responseText.trim());
    if (data.instagram && data.x) {
      return data;
    }
  } catch (error) {
    console.error('Gemini API draft generation failed:', error);
  }
  return null;
}

async function buildDraftPackage(input) {
  const classification = classifySubmission(input);
  const risk = detectRisk(input);
  const tone = buildFallbackTone(input, classification);

  const channels = input.channels?.length ? input.channels : ['instagram', 'x'];

  const geminiDraft = await generateDraftWithGemini(input, classification);

  let drafts = {};
  let altText = '';
  let hashtags = [];

  if (geminiDraft) {
    drafts = {
      instagram: { text: geminiDraft.instagram.text, narration: geminiDraft.instagram.narration },
      x: { text: geminiDraft.x.text, narration: geminiDraft.x.narration }
    };
    altText = geminiDraft.altText || `遠藤正俊オーナーによる20-30代女性向け癒やしメッセージ`;
    hashtags = geminiDraft.instagram.text.match(/#[^\s]+/g) || buildFallbackHashtags(classification, 'instagram');
  } else {
    drafts = Object.fromEntries(channels.map(channel => [
      channel, 
      draftForChannelFallback(channel, tone, classification, input)
    ]));
    altText = `遠藤正俊による「${classification.primary}」をテーマにした投稿用ビジュアル。`;
    hashtags = buildFallbackHashtags(classification, 'instagram');
  }
  
  const channelSettings = { ...(input.channelSettings || {}) };
  const defaultPublishAt = suggestedSchedule(classification.primary, input.publishAt);

  for (const channel of channels) {
    if (!channelSettings[channel]) {
      channelSettings[channel] = {};
    }
    if (!channelSettings[channel].assets) {
      channelSettings[channel].assets = input.assets || [];
    }
    if (!channelSettings[channel].publishAt) {
      channelSettings[channel].publishAt = defaultPublishAt;
    }
  }

  const initialStatus = risk.requiresReview || input.visibility === 'review' ? 'review_required' : 'approved';
  const channelStatuses = Object.fromEntries(channels.map(channel => [channel, initialStatus]));

  return {
    classification,
    risk,
    drafts,
    hashtags,
    altText,
    channelSettings,
    channelStatuses,
    status: initialStatus
  };
}

module.exports = { buildDraftPackage, generateDraftWithGemini, classifySubmission };
