const dayjs = require('dayjs');
const { BRAND } = require('./brand');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// 投稿テーマのキーワードマップ（ルールベース分類用）
const THEME_KEYWORDS = {
  '無駄の美学': ['無駄', '枯れ葉', '効率', '余裕', '余白'],
  '完璧という呪縛': ['完璧', '不完全', 'プレッシャー', '歪み', '正解'],
  '失われた日本の魂': ['魂', '奥日本', '秘境', '原風景', '伝統', 'アイデンティティ'],
  '自然との距離': ['自然', 'せせらぎ', '森', '川', '虫', '苔', '呼吸'],
  '成功の定義': ['成功', '数字', 'お金', '地位', '幸せ', '豊かさ'],
  '情報過多の疲弊': ['情報', '疲弊', 'スマホ', 'SNS', '沈黙', '静寂'],
  '日本の未来への不安': ['未来', '不安', '衰退', '少子化', '歴史', '過去'],
  '自己肯定感の低さ': ['自己肯定', '比較', '価値', '葛藤', '自分らしく']
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

  const primary = input.simpleTag || (scores[0]?.score ? scores[0].theme : '無駄の美学');
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
  // 投稿スケジュール。Xは毎日1-2回、Instagramは週2-3回推奨
  const base = dayjs();
  return base.hour(20).minute(0).second(0).millisecond(0).add(1, 'day').toISOString();
}

// ルールベースのフォールバック用テンプレート生成
function buildFallbackTone(input, classification) {
  const loc = input.location ? `${input.location}で` : '';
  const theme = classification.primary;

  const templates = {
    '無駄の美学': {
      scene: `「無駄」があるからこそ、心に余白が生まれる。`,
      detail: `世界中を植林し「生」を育んできた私が最後にたどり着いたのは、この山奥 of 「枯れ葉」の美しさでした。効率だけでは見えない命の循環があります。`,
      instagramQuote: `“All gold does not glitter, not all those who wander are lost.”\n(すべての黄金が輝くわけではなく、彷徨う者すべてが道に迷っているわけではない。)`,
      xText: `かつては数字を追い、今は季節を追う。どちらが人間らしいか、未だ答えは出ない。だが、数字を追うことに疲れた魂は、季節の中に救いを見出すだろう。`
    },
    '完璧という呪縛': {
      scene: `完璧でなくていい。その不完全さにこそ美がある。`,
      detail: `日本人は完璧を求めすぎるあまり、自分自身をすり減らしています。古民家の歪んだ柱や、不揃いな石畳の美しさに目を向けてみてください。`,
      instagramQuote: `“There is a crack in everything. That's how the light gets in.”\n(すべてのものにはひびがある。そこから光が入るのだ。)`,
      xText: `日本人はなぜ、これほどまでに「完璧」を求めるのか。世界から見れば、その「余白」こそが魅力なのに。あなたの心の「余白」は、今、何で埋められているだろうか？`
    },
    '失われた日本の魂': {
      scene: `観光地ではない『奥日本』に、失われた魂を探す旅。`,
      detail: `海外の富裕層が日本の秘境に惹かれるのは、彼ら自身の失われた魂のあり処を、日本の原風景や伝統に見出しているからです。`,
      instagramQuote: `“The real voyage of discovery consists not in seeking new landscapes, but in having new eyes.”\n(真の発見の旅とは、新しい景色を探すことではなく、新しい目を持つことにある。)`,
      xText: `地図に残らない日本を歩く。奥日本シルバールートは、単なる道ではない。それは、忘れられた日本の記憶を辿り、あなたの魂を呼び覚ます旅だ。`
    },
    '自然との距離': {
      scene: `川の音に沈黙し、自然と繋がるということ。`,
      detail: `世界中の森を見てきて気づいたのは、日本にしかない「沈黙」の価値です。川のせせらぎや風の音は、あなたの心と対話するための余白です。`,
      instagramQuote: `“Look deep into nature, and then you will understand everything better.”\n(自然を深く見つめなさい。そうすれば、すべてをより理解できるようになる。)`
    }
  };

  const selected = templates[theme] || templates['無駄の美学'];
  return {
    scene: `${loc}${selected.scene}`,
    detail: selected.detail,
    instagramQuote: selected.instagramQuote || '',
    xText: selected.xText || `${loc}${selected.scene} ${selected.detail}`
  };
}

function buildFallbackHashtags(classification, channel) {
  if (channel.startsWith('instagram')) {
    return [...BRAND.hashtagsBaseInstagram];
  }
  return [...BRAND.hashtagsBaseX];
}

function draftForChannelFallback(channel, tone, classification, input) {
  const userText = input.ownerComment || '';
  if (channel.startsWith('instagram')) {
    const lines = [
      `【${BRAND.instagramTheme}】`,
      tone.scene,
      '私は、毎日忙しさに追われ、自分の疲れにすら気づけない人たちを多く見てきました。',
      'この動画には、そんなあなたの心を整えるヒントを込めています。',
      '',
      BRAND.profileInstagram
    ].filter(Boolean);
    return {
      text: `${lines.join('\n')}\n\n${buildFallbackHashtags(classification, 'instagram').join(' ')}`,
      narration: userText || `${tone.scene}。${tone.detail}`
    };
  } else if (channel === 'x') {
    const mainText = 'あなたは最近、いつ「深い呼吸」をしましたか？\n\n情報と予定に追われる毎日の中で、私たちは「立ち止まること」にすら罪悪感を抱いてしまいます。\n\n心当たりのある方は、どうかこの動画を見てみてください。\n\n' + BRAND.site;
    return {
      text: mainText.slice(0, 280),
      narration: userText || tone.xText
    };
  }
  return { text: userText };
}

// Gemini APIを使った高度な下書き生成
async function generateDraftWithGemini(input, classification) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const systemPrompt = `
    あなたは「赤沢温泉旅館」氏の個人SNSアカウント（InstagramおよびX）の発信をサポートする専属AIです。
    
    ■ 最重要ルール：キャプション（text）とナレーション（narration）は【完全に別物】
    - 「narration」= 動画のテロップ・音声読み上げ用。オーナーの台本をほぼそのまま出力する。
    - 「text」= SNS投稿のキャプション/ポスト文。**絶対に動画の台本（narration）と同じ文章にしないでください。動画を見る前に視聴者の興味を強く惹きつけ、「もっと知りたい」「検索してみたい」と思わせるような、全く別の魅力的な文章を書いてください。**

    ■ 禁止事項
    1. 勝手に「赤沢温泉旅館のぬる湯」「客室」「料理」「源泉かけ流し」などの宿泊プロモーション情報をでっち上げること。
    2. キャプション（text）にナレーション原稿をそのまま流用・コピペすること。これは厳禁です。

    ■ Instagram用の「text」（キャプション）の書き方（最新のInstagramアルゴリズム・SEO対応）
    以下の【1〜3の順番】で厳格に構成してください。
    【1. 本文】
    - 必ず赤沢温泉旅館本人が語りかけているような、一人称（私）の温かい口調で書いてください。
    - 長い文章は絶対に書かず、非常に短く簡潔に（3〜4行程度）してください。
    - 最新のInstagramアルゴリズム（SEO）を意識し、文章の中に「心のモヤモヤ」「ストレス」「自然の癒やし」といった検索されやすいキーワードを自然な文脈で織り込んでください。
    - 「現代人の疲れ、忙しさ」などの現状の悩みに強くフォーカスし、「動画の音声に、あなたの悩みを軽くするヒントを込めています」と伝えてください。
    - テロップ（narration）のコピペは厳禁です。
    【2. プロフィール紹介文】
    - 本文のすぐ下に、以下の紹介文をそのまま配置してください。
    「${BRAND.profileInstagram}」
    【3. ハッシュタグ（一番最後）】
    - 古い手法である「長すぎるハッシュタグの羅列」は禁止です。一番最後に、投稿テーマに関連する検索されやすい良質なハッシュタグを【3〜5個のみ】自身で考えて付けてください。（例: #心のモヤモヤ #自然療法 #赤沢温泉旅館）

    ■ X用の「text」（ポスト文）の書き方（最新のXアルゴリズム対応）
    - テロップ（narration）のコピペは厳禁です。必ず赤沢温泉旅館本人の語り口調（私）にしてください。
    - スクロールする手を止めるような「共感を呼ぶ問いかけ」や「ハッとするインサイト」から始めてください。
    - 現代人の悩み（疲弊、情報過多など）に寄り添い、「音声をオンにして動画を聴いてみてください」と誘導してください。
    - 検索からの流入を狙い、文脈を壊さない範囲でトレンドになりやすいキーワードを含めてください。
    - 最後に公式サイトURL (${BRAND.site}) を含めること。

    ■ narration（両チャンネル共通）
    - 入力された「オーナーの投稿メモ（動画台本）」を、ほぼそのまま（句読点の微調整程度で）出力すること。
    - 勝手に内容を変えたり、追加したりしないこと。

    ■ 入力情報
    - オーナーの投稿メモ (動画台本): ${input.ownerComment || '特になし'}
    - 指定テーマ: ${classification.primary}

    ■ 出力フォーマット
    必ず以下のJSONフォーマット（プレーンなJSONオブジェクト）のみを返してください。マークダウンの囲み(\`\`\`json など)は不要です。
    {
      "instagram": {
        "text": "Instagram用キャプション。テロップと被らない短いフック文（3〜5行）+ ハッシュタグ + プロフィール紹介文",
        "narration": "動画テロップ/音声用。オーナーの台本をほぼそのまま出力"
      },
      "x": {
        "text": "X用投稿文。台本と異なる言い回しの独り言調（140〜200文字）+ サイトURL",
        "narration": "X用読み上げテキスト。オーナーの台本をほぼそのまま出力"
      },
      "altText": "投稿画像の代替テキスト（100文字程度）"
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

  // Netlifyの10秒タイムアウト（502エラー）を回避するため、ここでは同期的にGeminiを呼び出さず、
  // バックグラウンドタスク（generate-assets-background.js）で非同期に生成するように変更します。
  const geminiDraft = null; // await generateDraftWithGemini(input, classification);

  let drafts = {};
  let altText = '';
  let hashtags = [];

  if (geminiDraft) {
    drafts = {};
    if (channels.includes('instagram_feed')) drafts.instagram_feed = { text: geminiDraft.instagram.text, narration: geminiDraft.instagram.narration };
    if (channels.includes('instagram_reel')) drafts.instagram_reel = { text: geminiDraft.instagram.text, narration: geminiDraft.instagram.narration };
    if (channels.includes('x')) drafts.x = { text: geminiDraft.x.text, narration: geminiDraft.x.narration };
    if (channels.includes('gbp')) drafts.gbp = { text: geminiDraft.instagram.text, narration: geminiDraft.instagram.narration };
    
    altText = geminiDraft.altText || `${BRAND.ownerName}個人アカウントの投稿用ビジュアル`;
    // ハッシュタグの抽出（なければデフォルト）
    hashtags = geminiDraft.instagram.text.match(/#[^\s]+/g) || buildFallbackHashtags(classification, 'instagram');
  } else {
    // フォールバック生成
    drafts = Object.fromEntries(channels.map(channel => [
      channel, 
      draftForChannelFallback(channel, tone, classification, input)
    ]));
    altText = `${BRAND.ownerName}による「${classification.primary}」をテーマにした投稿用ビジュアル。`;
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
