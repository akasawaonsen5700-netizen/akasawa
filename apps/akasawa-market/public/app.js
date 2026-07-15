// ==========================================
// 定数・データ定義
// ==========================================

// 仕様書に基づく調査対象施設 (塩原温泉エリア)
let TARGET_FACILITIES = [];

// 標準的な調査対象日
const TARGET_DATES = [
  { date: "2026-07-22", label: "通常日 (水) - 7月22日", isEvent: false },
  { date: "2026-07-25", label: "通常日 (土) - 7月25日", isEvent: true },
  { date: "2026-07-27", label: "イベント (塩原まつり前夜祭) - 7月27日", isEvent: true },
  { date: "2026-08-10", label: "イベント (塩原温泉花火大会) - 8月10日", isEvent: true },
  { date: "2026-08-13", label: "繁忙期 (お盆ピーク) - 8月13日", isEvent: true },
  { date: "2026-08-22", label: "通常日 (土) - 8月22日", isEvent: true }
];

// 指標一覧
const METRICS = [
  { id: "prices", label: "施設ごとの価格", icon: "🏢" },
  { id: "direct_avg", label: "直接比較の平均価格", icon: "📊" },
  { id: "direct_median", label: "直接比較の中央値", icon: "⚖️" },
  { id: "direct_min", label: "直接比較の最安値", icon: "📉" },
  { id: "direct_max", label: "直接比較の最高値", icon: "📈" },
  { id: "all_range", label: "市場全体の価格帯", icon: "🌐" },
  { id: "full_count", label: "満室施設", icon: "🈵" },
  { id: "coupon_count", label: "クーポン実施", icon: "🎫" },
  { id: "pet_range", label: "ペット可施設の価格", icon: "🐾" },
  { id: "event_increase", label: "通常日比の上昇幅", icon: "🚀" },
  { id: "stats", label: "分析サマリー", icon: "📋" }
];

// 塩原エリア全体の総軒数の仮定
const TOTAL_SHIOBARA_HOTELS = 65;

// ==========================================
// アプリケーション状態 (AppState)
// ==========================================
const AppState = {
  selectedDate: TARGET_DATES[0].date,
  selectedOta: "rakuten",
  selectedMetric: "prices",
  marketResearchData: [], // キャッシュ用
  realOccRate: null,
  isFetchingOcc: false
};

// ==========================================
// ユーティリティ
// ==========================================
function formatCurrency(val) {
  return val !== null && val !== undefined ? '¥' + Math.round(val).toLocaleString('ja-JP') : 'データなし';
}

function formatDateJapanese(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const wdays = ['日','月','火','水','木','金','土'];
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${wdays[d.getDay()]}）`;
}

// ==========================================
// 初期化処理
// ==========================================
window.onload = async function() {
  try {
    const res = await fetch('/shared/target_hotels.json');
    TARGET_FACILITIES = await res.json();
  } catch(err) {
    console.error('Failed to load target hotels', err);
  }
  initUI();
  updateView();
};

function initUI() {
  // 日付プルダウン初期化
  const selectEl = document.getElementById('date-select');
  if (selectEl) {
    selectEl.innerHTML = TARGET_DATES.map(d => `<option value="${d.date}">${d.label}</option>`).join('');
    selectEl.onchange = function(e) {
      AppState.selectedDate = e.target.value;
      document.getElementById('custom-date').value = e.target.value;
      updateView();
    };
  }

  // カレンダー入力初期化
  const customDateEl = document.getElementById('custom-date');
  if (customDateEl) {
    customDateEl.value = AppState.selectedDate;
    customDateEl.onchange = function(e) {
      AppState.selectedDate = e.target.value;
      // プリセットプルダウンに対象日があれば切り替える
      const presetOption = Array.from(selectEl.options).find(opt => opt.value === e.target.value);
      if (presetOption) {
        selectEl.value = e.target.value;
      } else {
        selectEl.value = ""; // 該当なし
      }
      updateView();
    };
  }

  // 指標メニュー初期化
  renderMetricButtons();
}

function renderMetricButtons() {
  const container = document.getElementById('metric-buttons');
  if (!container) return;

  container.innerHTML = METRICS.map(m => {
    const activeClass = AppState.selectedMetric === m.id ? 'active' : '';
    return `<button class="metric-btn ${activeClass}" onclick="switchMetric('${m.id}')">
      <span>${m.icon}</span> ${m.label}
    </button>`;
  }).join('');
}

function switchMetric(metricId) {
  AppState.selectedMetric = metricId;
  renderMetricButtons();
  updateViewContent();
}

function switchChannel(otaId) {
  AppState.selectedOta = otaId;
  document.getElementById('channel-rakuten').classList.toggle('active', otaId === 'rakuten');
  document.getElementById('channel-jalan').classList.toggle('active', otaId === 'jalan');
  updateView();
}

// ==========================================
// 楽天トラベルエリア稼働率の取得 (Netlify Functions 経由 / CORS回避)
// ==========================================
async function fetchMarketOccupancy(dateStr) {
  if (AppState.isFetchingOcc) return;
  AppState.isFetchingOcc = true;

  const statusEl = document.getElementById('scraping-status');
  const occValEl = document.getElementById('area-occ-val');
  const occLabelEl = document.getElementById('area-occ-label');

  if (statusEl) {
    statusEl.className = 'status-badge';
    statusEl.innerHTML = '<i class="fas fa-sync fa-spin"></i> 楽天トラベル同期中...';
  }

  const d = new Date(dateStr + 'T00:00:00');
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  // Netlify Functions (scrape-rakuten) 経由
  const proxyUrl = `/api/scrape-rakuten?year=${year}&month=${month}&day=${day}`;

  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error('Proxy error or offline');
    const json = await response.json();
    
    if (json.totalResults !== undefined && json.totalResults !== -1) {
      const vacantCount = json.totalResults;
      let occ = Math.round(((TOTAL_SHIOBARA_HOTELS - vacantCount) / TOTAL_SHIOBARA_HOTELS) * 100);
      occ = Math.max(0, Math.min(100, occ));

      AppState.realOccRate = occ;
      occValEl.textContent = `${occ}%`;
      occValEl.style.color = occ >= 85 ? 'var(--danger)' : occ >= 60 ? 'var(--warning)' : 'var(--accent-color)';
      occLabelEl.textContent = occ >= 85 ? '満室直前' : occ >= 60 ? '高需要' : '通常';
      
      if (statusEl) {
        statusEl.className = 'status-badge green';
        statusEl.innerHTML = '🟢 楽天トラベルと同期済';
      }
      AppState.isFetchingOcc = false;
      return;
    }
    throw new Error('No results');
  } catch (error) {
    console.warn('Scraping failed, using fallback simulation:', error);
    // フォールバック（擬似計算）
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
    const isHolidaySeason = d.getMonth() === 7 || d.getMonth() === 3 || d.getMonth() === 4;
    const isEv = TARGET_DATES.some(td => td.date === dateStr && td.isEvent);

    let occ = isWeekend ? 82 : 46;
    if (isHolidaySeason) occ += 12;
    if (isEv) occ += 10;
    occ = Math.min(98, occ + (d.getDate() % 8)); // 乱数要素

    AppState.realOccRate = occ;
    occValEl.textContent = `${occ}%`;
    occValEl.style.color = occ >= 85 ? 'var(--danger)' : occ >= 60 ? 'var(--warning)' : 'var(--accent-color)';
    occLabelEl.textContent = occ >= 85 ? '満室直前' : occ >= 60 ? '高需要' : '通常';
    
    if (statusEl) {
      statusEl.className = 'status-badge orange';
      statusEl.innerHTML = '🟡 推定値（通信制限回避）';
    }
  } finally {
    AppState.isFetchingOcc = false;
  }
}

// ==========================================
// 競合データの生成・取得（擬似シミュレーション）
// ==========================================
function getMarketResearchData(dateStr, ota) {
  const cacheKey = `${dateStr}-${ota}`;
  // キャッシュにあればそれを返す
  const existing = AppState.marketResearchData.find(d => d.cacheKey === cacheKey);
  if (existing) return existing.data;

  const dObj = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = dObj.getDay();
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
  const isHolidaySeason = dObj.getMonth() === 7 || dObj.getMonth() === 3; // 8月とお盆、4月を想定
  const isEv = TARGET_DATES.some(td => td.date === dateStr && td.isEvent);

  const seed = (dObj.getDate() * 19 + dObj.getMonth() * 11 + (ota === "rakuten" ? 3 : 7)) % 100;
  const baseMarkup = (isWeekend ? 3500 : 0) + (isHolidaySeason ? 6000 : 0) + (isEv ? 4000 : 0) + (seed * 15);

  const basePrices = {
    majimaso: 11000,
    yamaguciya: 12500,
    kamiaizuya: 13000,
    nuriya: 12000,
    tokiwa: 14000,
    okukogen: 17500,
    shimofujiya: 18000,
    shofuro: 19000,
    gensenkan: 16000,
    wanwan: 15500
  };

  const planNames = {
    majimaso: '【スタンダード】塩原温泉掛け流し・女将の手作り郷土和食膳プラン',
    yamaguciya: '【のんびり湯治】歴史息づく源泉と季節の釜飯会席プラン',
    kamiaizuya: '【創作和食】上会津屋スタンダード会席と名湯堪能プラン',
    nuriya: '【当館人気】名物山家料理と趣の異なる３つの貸切風呂満喫',
    tokiwa: '【常盤スタイル】モダン和室で過ごす贅沢な休日・地産こだわり会席',
    okukogen: '【高原の特等席】乳白色の天然硫黄泉・極上会席1泊2食付',
    shimofujiya: '【老舗の宿】やまの味覚をふんだんに取り入れた郷土会席プラン',
    shofuro: '【贅をつくす】川のせせらぎを聞きながら露天風呂＆本格会席',
    gensenkan: '【愛犬と一緒】ペット専用温泉風呂付！塩原の大自然を愛犬と旅する',
    wanwan: '【ドッグパーク完備】愛犬用フルコースディナー付きご宿泊プラン'
  };

  const roomTypes = {
    majimaso: '標準和室10畳（バス・トイレ付）',
    yamaguciya: '渓谷美を望む和室10畳',
    kamiaizuya: '和室またはベッド付和モダン室',
    nuriya: '民芸調の和室8畳〜10畳',
    tokiwa: '新和風客室10畳（リニューアル）',
    okukogen: 'モダン和洋室（高原ビュー）',
    shimofujiya: '純和風数寄屋造り客室',
    shofuro: '渓流沿い露天風呂付和室',
    gensenkan: 'ペット同伴OK和室10畳',
    wanwan: 'ドッグフレンドリーシングル/ツイン'
  };

  const data = TARGET_FACILITIES.map((fac, idx) => {
    let base = basePrices[fac.id] || 12000;
    // わずかにOTAでの価格差シミュレーション
    const otaDiff = ota === "jalan" ? ((idx % 3 - 1) * 300) : 0;
    
    // タイプに応じたマークアップ補正
    let markup = baseMarkup;
    if (fac.type === 'market') {
      markup = Math.round(baseMarkup * 1.35); // 高級宿は値上げ幅が大きめ
    } else if (fac.type === 'pet') {
      markup = Math.round(baseMarkup * 1.1);
    }

    // 満室判定の確率（土日・イベントは高確率）
    const fullChance = (isWeekend ? 0.45 : 0.12) + (isHolidaySeason ? 0.35 : 0) + (isEv ? 0.3 : 0);
    const isFull = ((seed + idx * 23) % 100) < (fullChance * 100);

    // クーポン実施率 (30%)
    const hasCoupon = ((seed + idx * 17) % 100) < 30;

    return {
      hotelId: fac.id,
      hotelName: fac.name,
      type: fac.type,
      status: isFull ? 'full' : 'available',
      price: isFull ? null : Math.floor((base + markup + otaDiff) / 100) * 100, // 100円丸め
      planName: planNames[fac.id],
      roomType: roomTypes[fac.id],
      meals: '1泊2食付',
      hasCoupon: hasCoupon,
      updatedAt: new Date().toISOString()
    };
  });

  // キャッシュ保存
  AppState.marketResearchData.push({ cacheKey, data });
  return data;
}

// 通常日の平日直接比較施設の平均単価（上昇率算出用の分母）
function getNormalDayAvgPrice() {
  const directBasePrices = [11000, 12500, 13000, 12000, 14000];
  return Math.round(directBasePrices.reduce((a, b) => a + b, 0) / directBasePrices.length);
}

// ==========================================
// ビューの更新
// ==========================================
async function updateView() {
  const dateStr = AppState.selectedDate;
  const ota = AppState.selectedOta;

  // 日付表示ラベル更新
  document.getElementById('result-date-label').textContent = `対象日: ${formatDateJapanese(dateStr)}`;

  // エリア宿泊率同期実行
  await fetchMarketOccupancy(dateStr);

  // コンテンツ更新
  updateViewContent();
}

function updateViewContent() {
  const dateStr = AppState.selectedDate;
  const ota = AppState.selectedOta;
  const metric = AppState.selectedMetric;

  const data = getMarketResearchData(dateStr, ota);
  const container = document.getElementById('result-content');
  const titleEl = document.getElementById('result-title');

  if (!container || !titleEl) return;

  // 各種計算に必要な配列作成
  const directPrices = data
    .filter(d => d.type === 'direct' && d.status !== 'full')
    .map(d => d.price)
    .sort((a, b) => a - b);

  const allPrices = data
    .filter(d => d.status !== 'full')
    .map(d => d.price)
    .sort((a, b) => a - b);

  const petPrices = data
    .filter(d => d.type === 'pet' && d.status !== 'full')
    .map(d => d.price)
    .sort((a, b) => a - b);

  // 指標計算
  const directAvg = directPrices.length > 0 ? Math.round(directPrices.reduce((a, b) => a + b, 0) / directPrices.length) : null;
  const directMin = directPrices.length > 0 ? directPrices[0] : null;
  const directMax = directPrices.length > 0 ? directPrices[directPrices.length - 1] : null;
  
  let directMedian = null;
  if (directPrices.length > 0) {
    const mid = Math.floor(directPrices.length / 2);
    directMedian = directPrices.length % 2 !== 0 
      ? directPrices[mid] 
      : Math.round((directPrices[mid - 1] + directPrices[mid]) / 2);
  }

  const fullHotels = data.filter(d => d.status === 'full');
  const couponHotels = data.filter(d => d.hasCoupon);

  // 競合平均稼働率の擬似算出 (カード用)
  const compOccRates = data.map((hotel, idx) => {
    if (hotel.status === 'full') return 100;
    const dObj = new Date(dateStr + 'T00:00:00');
    return Math.min(96, 45 + ((dObj.getDate() * 5 + hotel.hotelName.charCodeAt(0)) % 45));
  });
  const competitorAvgOcc = Math.round(compOccRates.reduce((a, b) => a + b, 0) / data.length);

  document.getElementById('competitor-occ-val').textContent = `${competitorAvgOcc}%`;
  document.getElementById('competitor-occ-label').textContent = `10軒中 ${fullHotels.length} 軒が満室`;

  // 各指標のタイトルを設定
  const metricObj = METRICS.find(m => m.id === metric);
  titleEl.innerHTML = metricObj ? `${metricObj.icon} ${metricObj.label}` : '価格指標';

  // コンテンツのHTML生成
  switch (metric) {
    case 'prices':
      container.innerHTML = `<div class="mr-grid">
        ${data.map(h => {
          let typeBadge = '';
          if (h.type === 'direct') typeBadge = '<span class="mr-hotel-type-badge blue">🔵 直接比較</span>';
          else if (h.type === 'market') typeBadge = '<span class="mr-hotel-type-badge orange">🔘 相場参考</span>';
          else if (h.type === 'pet') typeBadge = '<span class="mr-hotel-type-badge purple">🐾 ペット可</span>';

          const priceHtml = h.status === 'full' 
            ? '<span class="price-full">満室御礼</span>' 
            : `<span class="price-num">${formatCurrency(h.price)}</span>`;

          const couponBadge = h.hasCoupon ? '<span class="mr-badge coupon">🎫 クーポン</span>' : '';

          return `<div class="mr-hotel-card ${h.status === 'full' ? 'full' : ''}">
            <div class="mr-hotel-card-header">
              ${typeBadge}
              <h4 class="mr-hotel-name">${h.hotelName}</h4>
            </div>
            <div class="mr-hotel-price-row">
              ${priceHtml}
            </div>
            <div class="mr-hotel-details">
              <p><strong>プラン:</strong> ${h.planName}</p>
              <p><strong>部屋:</strong> ${h.roomType}</p>
              <div class="mr-hotel-badges">
                ${couponBadge}
                <span class="mr-badge">🍽️ 1泊2食付</span>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>`;
      break;

    case 'direct_avg':
      container.innerHTML = `<div class="mr-kpi-view">
        <span class="mr-kpi-label">直接比較 5施設の平均価格 (1泊2食付)</span>
        <div class="mr-kpi-value gradient">
          ${directAvg ? formatCurrency(directAvg) : '全て満室・データなし'}
        </div>
        <p class="mr-kpi-desc">
          同規模・同等グレードの競合旅館5軒の平均料金です。当館の料金設定の主要基準値となります。この平均値に対して、当館の現在の料金設定が割高・割安すぎないか確認してください。
        </p>
      </div>`;
      break;

    case 'direct_median':
      container.innerHTML = `<div class="mr-kpi-view">
        <span class="mr-kpi-label">直接比較 5施設の中央値</span>
        <div class="mr-kpi-value">
          ${directMedian ? formatCurrency(directMedian) : '全て満室・データなし'}
        </div>
        <p class="mr-kpi-desc">
          極端な安値や高値（アウトライヤー）の影響を除いた、実質的な市場の中心単価です。価格決定にブレのない安定した基準を提供します。
        </p>
      </div>`;
      break;

    case 'direct_min':
      container.innerHTML = `<div class="mr-kpi-view">
        <span class="mr-kpi-label">直接比較 5施設の最安値 (下限相場)</span>
        <div class="mr-kpi-value text-danger">
          ${directMin ? formatCurrency(directMin) : '全て満室・データなし'}
        </div>
        <p class="mr-kpi-desc">
          直接比較対象の中で最も安い価格です。当館がこの下限値を下回る設定をする必要は基本的にありません。安売り競争を避けるための防衛ラインとなります。
        </p>
      </div>`;
      break;

    case 'direct_max':
      container.innerHTML = `<div class="mr-kpi-view">
        <span class="mr-kpi-label">直接比較 5施設の最高値 (上限相場)</span>
        <div class="mr-kpi-value text-success">
          ${directMax ? formatCurrency(directMax) : '全て満室・データなし'}
        </div>
        <p class="mr-kpi-desc">
          競合が設定している最も強気な価格です。この上限値付近でも他館が売れている場合、その日は非常に需要が強いことを示し、当館も価格を引き上げるチャンスです。
        </p>
      </div>`;
      break;

    case 'all_range':
      container.innerHTML = `<div class="mr-kpi-view">
        <span class="mr-kpi-label">調査対象全施設全体の価格帯 (最安値 〜 最高値)</span>
        <div class="mr-kpi-value text-dark" style="font-size: 2.8rem; color: var(--text-main);">
          ${allPrices.length > 0 ? `${formatCurrency(allPrices[0])} 〜 ${formatCurrency(allPrices[allPrices.length - 1])}` : '全施設満室'}
        </div>
        <p class="mr-kpi-desc">
          高級宿（奥塩原高原ホテル等）やペット特化宿を含めた、塩原温泉エリア全体の販売価格レンジです。高付加価値層のホテルが価格を引き上げているときは、観光・レジャー需要が強く値上げが通りやすい環境と言えます。
        </p>
      </div>`;
      break;

    case 'full_count':
      const fullList = fullHotels.length > 0
        ? fullHotels.map(h => `<div class="mr-list-item danger"><i class="fas fa-hotel"></i> <strong>${h.hotelName}</strong> - 満室</div>`).join('')
        : '<p class="text-muted" style="text-align:center;padding:2rem;">満室になっている競合ホテルはありません。</p>';

      container.innerHTML = `<div class="mr-analysis-view">
        <div class="mr-summary-card danger">
          <div class="card-icon">🈵</div>
          <div class="card-text">
            <h3>満室施設数</h3>
            <div class="card-value">${fullHotels.length} / 10 施設</div>
          </div>
        </div>
        <div class="mr-analysis-details">
          <h4>現在満室の施設リスト</h4>
          <div class="mr-list-container">${fullList}</div>
          <p class="mr-analysis-tip" style="margin-top: 15px;">
            💡 <strong>価格調整への助言:</strong><br/>
            直接比較施設（まじま荘や上会津屋など）で満室・売り切れが増えてきた場合、直前予約が当館へ流れる確率が大幅に高まります。速やかに強気料金（1,500円〜3,000円アップ）へ調整することを推奨します。
          </p>
        </div>
      </div>`;
      break;

    case 'coupon_count':
      const couponList = couponHotels.length > 0
        ? couponHotels.map(h => `<div class="mr-list-item warning"><i class="fas fa-tag"></i> <strong>${h.hotelName}</strong> - 割引クーポン配布中</div>`).join('')
        : '<p class="text-muted" style="text-align:center;padding:2rem;">クーポン配布・割引実施中の施設はありません。</p>';

      container.innerHTML = `<div class="mr-analysis-view">
        <div class="mr-summary-card warning">
          <div class="card-icon">🎫</div>
          <div class="card-text">
            <h3>クーポン配布中</h3>
            <div class="card-value">${couponHotels.length} / 10 施設</div>
          </div>
        </div>
        <div class="mr-analysis-details">
          <h4>クーポン実施宿リスト</h4>
          <div class="mr-list-container">${couponList}</div>
          <p class="mr-analysis-tip" style="margin-top: 15px;">
            💡 <strong>価格調整への助言:</strong><br/>
            競合がクーポンをばら撒いて実質値下げを行っている場合、表示価格比較だけで強気の価格設定をすると、ユーザー転換率（CVR）が落ちることがあります。競合の実質支払額を念頭に価格を調整してください。
          </p>
        </div>
      </div>`;
      break;

    case 'pet_range':
      container.innerHTML = `<div class="mr-kpi-view">
        <span class="mr-kpi-label">ペット同伴可能施設 2軒の価格帯 (元泉館、わんわんパラダイス)</span>
        <div class="mr-kpi-value" style="font-size: 2.8rem; color: #ba72ed;">
          ${petPrices.length > 0 ? (petPrices.length === 1 ? formatCurrency(petPrices[0]) : `${formatCurrency(petPrices[0])} 〜 ${formatCurrency(petPrices[1])}`) : '全施設満室'}
        </div>
        <p class="mr-kpi-desc">
          当館が特に注視しているペットフレンドリープランを有するホテルの価格動向です。ペット需要は客層のロイヤルティが高いため高単価を維持しやすい傾向があり、当館の「ペット同伴プラン」の値決めの参考になります。
        </p>
      </div>`;
      break;

    case 'event_increase':
      const normalDayAvg = getNormalDayAvgPrice();
      let increaseVal = '--';
      let increasePct = 0;

      if (directAvg) {
        increasePct = Math.round(((directAvg - normalDayAvg) / normalDayAvg) * 100);
        increaseVal = `+${increasePct}%`;
      }

      container.innerHTML = `<div class="mr-kpi-view">
        <span class="mr-kpi-label">通常日 (7/22水) 直接比較平均価格比の上昇率</span>
        <div class="mr-kpi-value text-success" style="font-size: 4.5rem; color: var(--success);">
          ${increaseVal}
        </div>
        <p class="mr-kpi-desc">
          平日の基準日（平均 ¥${normalDayAvg.toLocaleString()}）と比較した、現在の指定日の相場上昇幅です。<br>
          上昇率が <strong>20%以上</strong> になる日は、週末やローカルイベントによる需要高騰日です。当館も自動的にイベント係数を1.2〜1.4倍に引き上げる設定をお勧めします。
        </p>
      </div>`;
      break;

    case 'stats':
      const tips = [];
      if (fullHotels.length >= 3) {
        tips.push(`<li class="mr-tip-item danger">
          <i class="fas fa-exclamation-triangle"></i>
          <div>
            <strong>競合ホテルの売り切れが著しい状況です（${fullHotels.length}施設が満室）。</strong><br/>
            需要が集中しています。当館の販売価格も早急に上限価格（上限値付近）へと引き上げるか、残室調整をして売上単価（RevPAR）を最大化してください。
          </div>
        </li>`);
      }
      if (couponHotels.length >= 4) {
        tips.push(`<li class="mr-tip-item warning">
          <i class="fas fa-percent"></i>
          <div>
            <strong>多くのホテルがクーポン割引を実施しています（${couponHotels.length}施設）。</strong><br/>
            全体の客足が鈍い平日である可能性があります。当館も平日の稼働率を補填するため、下限価格での販売、または直前割・早期割キャンペーンの強化を検討してください。
          </div>
        </li>`);
      }
      if (directAvg && directAvg > getNormalDayAvgPrice() * 1.15) {
        tips.push(`<li class="mr-tip-item success">
          <i class="fas fa-chart-line"></i>
          <div>
            <strong>競合平均単価が通常平日に比べ15%以上高騰しています（平均 ${formatCurrency(directAvg)}）。</strong><br/>
            周辺で観光イベントやお祭り、あるいは行楽シーズンに入っている影響です。当館の料金設定も推奨価格を上に調整する絶好の好機です。
          </div>
        </li>`);
      }
      if (tips.length === 0) {
        tips.push(`<li class="mr-tip-item info">
          <i class="fas fa-info-circle"></i>
          <div>
            <strong>市場環境は穏やかで、極めて平穏に推移しています。</strong><br/>
            競合の平均価格は平時の水準（${formatCurrency(directAvg || getNormalDayAvgPrice())}前後）で安定しています。基本料金テーブルの適用、または通常のダイナミックプライシングでの設定が適切です。
          </div>
        </li>`);
      }

      container.innerHTML = `<div class="mr-stats-view">
        <h3 style="font-size: 1.1rem; margin-bottom: 16px; font-weight: 700;">📊 塩原温泉市場サマリー</h3>
        
        <div class="mr-stats-summary-grid">
          <div class="mr-summary-item-box">
            <span class="label">直接比較 平均価格</span>
            <span class="value">${directAvg ? formatCurrency(directAvg) : '満室'}</span>
          </div>
          <div class="mr-summary-item-box">
            <span class="label">直接比較 最安値</span>
            <span class="value" style="color:var(--danger);">${directMin ? formatCurrency(directMin) : '満室'}</span>
          </div>
          <div class="mr-summary-item-box">
            <span class="label">直接比較 最高値</span>
            <span class="value" style="color:var(--success);">${directMax ? formatCurrency(directMax) : '満室'}</span>
          </div>
        </div>

        <div style="margin-top: 24px;">
          <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 12px; color: var(--accent-color);">💡 AIによる意思決定サポートインサイト</h4>
          <ul class="mr-tips-list" style="list-style: none; padding: 0; display:flex; flex-direction:column; gap:12px;">
            ${tips.join('')}
          </ul>
        </div>
      </div>`;
      break;

    default:
      container.innerHTML = '<p class="text-muted">指標を選択してください。</p>';
  }
}
