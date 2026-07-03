const dayjs = require('dayjs');
const { BRAND } = require('./brand');
const fs = require('fs');
const path = require('path');

const KEYWORDS = {
  猫: ['猫', 'ねこ', 'ネコ', 'cat', 'resident cat'],
  温泉: ['温泉', '露天', '内湯', 'ぬる湯', 'onsen', 'bath'],
  客室: ['客室', '和室', '洋室', '部屋', 'room'],
  料理: ['料理', '食事', 'ヤマメ', 'イワナ', '夕食', '朝食', 'meal'],
  渓流: ['渓流', '川', 'せせらぎ', 'river', 'waterfall'],
  外観: ['外観', '玄関', '建物'],
  館内: ['ロビー', '館内', '廊下'],
  アクセス: ['送迎', '駅', 'バス', 'アクセス', '駐車場'],
  'FAQ/注意事項': ['注意', '苦手', '虫', '葉', 'アレルギー', 'ぬるい', '熱くない']
};

function classifySubmission(input) {
  const text = [input.ownerComment, input.location, input.simpleTag, input.ngMemo, input.catName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const scores = Object.entries(KEYWORDS)
    .map(([category, terms]) => ({
      category,
      score: terms.reduce((sum, term) => sum + (text.includes(term.toLowerCase()) ? 1 : 0), 0)
    }))
    .sort((a, b) => b.score - a.score);

  const primary = input.simpleTag || (scores[0]?.score ? scores[0].category : '静養');
  const secondary = scores.filter(item => item.category !== primary && item.score > 0).slice(0, 2).map(item => item.category);
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
  if (primary === 'アクセス') return base.hour(12).minute(30).second(0).millisecond(0).add(1, 'day').toISOString();
  if (primary === '猫') return base.hour(20).minute(30).second(0).millisecond(0).add(1, 'day').toISOString();
  if (primary === '温泉' || primary === '静養' || primary === '渓流') return base.hour(20).minute(30).second(0).millisecond(0).add(1, 'day').toISOString();
  return base.hour(7).minute(30).second(0).millisecond(0).add(1, 'day').toISOString();
}

function buildTone(input, classification) {
  const loc = input.location ? `${input.location}で` : '';
  if (classification.primary === '猫') {
    return {
      scene: `${loc}${input.catName || '旅館猫'}がのんびり過ごす、静かなひととき。`,
      detail: `${BRAND.hotelName}らしい「猫 × 静養」の空気を、ありのままにお届けします。`,
      note: '猫が苦手な方やアレルギーが気になる方は、事前にご確認ください。',
      cta: 'ご予約・詳細は公式サイトへ。'
    };
  }
  if (classification.primary === '温泉') {
    return {
      scene: `${loc}38〜40度前後の天然ぬる湯で、長湯向きの静養時間。`,
      detail: '加温・加水なしの源泉かけ流しを、無理なくゆっくり味わう宿です。',
      note: '熱い湯を期待される方には合わない場合があります。',
      cta: 'ぬる湯の特徴は公式サイトのFAQもご覧ください。'
    };
  }
  if (classification.primary === '渓流') {
    return {
      scene: `${loc}渓流の音にほどける、何もしない贅沢。`,
      detail: '全室リバービューの静けさと、自然の近さをそのままお伝えします。',
      note: '自然環境ゆえ、季節により虫や葉が気になることがあります。',
      cta: '静養旅の詳細は公式サイトへ。'
    };
  }
  if (classification.primary === 'アクセス') {
    return {
      scene: 'ご来館前に知っておきたいアクセス案内です。',
      detail: '塩原温泉バスターミナルから送迎あり（要事前予約）。那須塩原駅発のバスは14時台が実質最終目安です。',
      note: '送迎希望の方は必ず事前にご連絡ください。',
      cta: `お電話 ${BRAND.phone} でもご案内します。`
    };
  }
  return {
    scene: `${loc}猫・ぬる湯・渓流・静養の空気を、そのまま切り取った一枚。`,
    detail: BRAND.supportCopy,
    note: '向いている方・向いていない方は公式FAQで明記しています。',
    cta: '詳細・空室検索は公式サイトへ。'
  };
}

function buildHashtags(classification, input) {
  const map = {
    猫: ['#保護猫', '#猫のいる宿', '#cattherapy'],
    温泉: ['#ぬる湯', '#長湯', '#源泉かけ流し'],
    渓流: ['#渓流沿い', '#川音', '#リバービュー'],
    静養: ['#静養旅', '#何もしない贅沢'],
    アクセス: ['#塩原温泉アクセス', '#送迎あり']
  };
  const extra = map[classification.primary] || ['#ウェルネス旅'];
  const custom = input.catName ? [`#${input.catName}`] : [];
  return [...new Set([...BRAND.hashtagsBase, ...extra, ...custom])].slice(0, 8);
}

function buildAltText(classification, input) {
  const loc = input.location ? `${input.location}の` : '';
  return `${BRAND.hotelName}の${loc}${classification.primary}に関する写真または動画。${BRAND.compactConcept}を伝える素材。`;
}

function draftForChannel(channel, tone, classification, input) {
  const lines = [
    tone.scene,
    tone.detail,
    `この投稿は「${classification.primary}${classification.secondary.length ? ` / ${classification.secondary.join(' / ')}` : ''}」の魅力を伝える内容です。`,
    tone.note,
    tone.cta
  ].filter(Boolean);

  if (channel === 'instagram' || channel === 'youtube') return { text: `${lines.join('\n')}\n\n${buildHashtags(classification, input).join(' ')}` };
  if (channel === 'gbp') return { text: [tone.scene, tone.detail, tone.note, BRAND.site].join('\n') };
  if (channel === 'x') return { text: `${tone.scene} ${tone.detail} ${BRAND.site}`.slice(0, 280) };
  return { text: lines.join('\n') };
}

// RAG検索ロジック (構造化されたビジョン・ミッション・ルーツJSONを丸ごと流し込み)
function retrieveRyokanSegments(input) {
  try {
    const dbPath = path.join(__dirname, 'ryokan_rag_db.json');
    if (!fs.existsSync(dbPath)) return '';
    return fs.readFileSync(dbPath, 'utf8');
  } catch (error) {
    console.error('Ryokan RAG retrieval failed:', error);
    return '';
  }
}

async function maybeUseAntigravity(input, fallback, ragContext) {
  const url = process.env.ANTIGRAVITY_WEBHOOK_URL;
  if (!url) return fallback;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        system: 'Akazawa Onsen brand-safe social draft generation', 
        input, 
        fallback,
        ragContext // RAGコンテキストをWebhook送信データに載せる
      })
    });
    if (!response.ok) throw new Error('antigravity webhook failed');
    const data = await response.json();
    if (data?.drafts) {
      return {
        ...fallback,
        drafts: data.drafts,
        classification: data.classification || fallback.classification,
        risk: data.risk || fallback.risk,
        altText: data.altText || fallback.altText,
        hashtags: data.hashtags || fallback.hashtags
      };
    }
  } catch (error) {
    console.warn(error.message);
  }
  return fallback;
}

async function buildDraftPackage(input) {
  const classification = classifySubmission(input);
  const risk = detectRisk(input);
  const tone = buildTone(input, classification);
  const channels = input.channels?.length ? input.channels : ['instagram', 'gbp'];
  const drafts = Object.fromEntries(channels.map(channel => [channel, draftForChannel(channel, tone, classification, input)]));
  const ragContext = retrieveRyokanSegments(input); // RAGコンテキストを取得
  
  // Normalize channelSettings for all selected channels
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

  const fallback = {
    classification,
    risk,
    drafts,
    hashtags: buildHashtags(classification, input),
    altText: buildAltText(classification, input),
    channelSettings,
    channelStatuses,
    status: initialStatus,
    ragContext // フォールバックオブジェクトにも含める
  };
  return maybeUseAntigravity(input, fallback, ragContext);
}

module.exports = { buildDraftPackage };
