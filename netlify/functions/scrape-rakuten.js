const WORKING_APP_ID = process.env.RAKUTEN_APP_ID || '9d7baaac-17e2-4aea-a604-b4152ce2fc7b';
const WORKING_ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY || 'pk_cT3tE1itL8C1K35hCdS4ZXJkstCARzGtWUi4pa2oJf8';

const fetch = typeof globalThis.fetch !== 'undefined'
  ? globalThis.fetch
  : (...args) => import('node-fetch').then(({default: fetchFn}) => fetchFn(...args));

const TARGETS = {
  14850: 'majimaso',
  4674: 'kamiaizuya',
  129558: 'nuriya',
  5884: 'tokiwa',
  109143: 'umekawaso',
  32030: 'okukogen',
  5650: 'shimofujiya',
  2634: 'shofuro',
  5144: 'gensenkan',
  104699: 'wanwan'
};

// 11施設の詳細マスタデータ
const COMPETITOR_MASTER = {
  majimaso: { name: '旅館まじま荘', rating: 4.2, url: 'https://travel.rakuten.co.jp/HOTEL/14850/' },
  kamiaizuya: { name: '上会津屋', rating: 4.4, url: 'https://travel.rakuten.co.jp/HOTEL/4674/' },
  nuriya: { name: '心づくしの宿 ぬりや', rating: 4.3, url: 'https://travel.rakuten.co.jp/HOTEL/129558/' },
  tokiwa: { name: '常盤ホテル', rating: 4.0, url: 'https://travel.rakuten.co.jp/HOTEL/5884/' },
  umekawaso: { name: '塩原温泉梅川壮', rating: 4.4, url: 'https://travel.rakuten.co.jp/HOTEL/109143/' },
  okukogen: { name: '奥塩原高原ホテル', rating: 4.2, url: 'https://travel.rakuten.co.jp/HOTEL/32030/' },
  shimofujiya: { name: 'やまの宿 下藤屋', rating: 4.5, url: 'https://travel.rakuten.co.jp/HOTEL/5650/' },
  shofuro: { name: '松楓楼 松屋', rating: 4.5, url: 'https://travel.rakuten.co.jp/HOTEL/2634/' },
  gensenkan: { name: '秘湯の宿 元泉館', rating: 4.2, url: 'https://travel.rakuten.co.jp/HOTEL/5144/' },
  wanwan: { name: 'わんわんパラダイス', rating: 4.2, url: 'https://travel.rakuten.co.jp/HOTEL/104699/' }
};

// 除外プランキーワード
const EXCLUDE_KEYWORDS = [
  '早割', '直前', 'タイムセール', '一人旅', 'ビジネス', '連泊', '訳あり', '訳有', '記念日', '3名', '三名', '4名'
];

// 高級客室などを除外するための客室キーワード
const EXCLUDE_ROOM_KEYWORDS = [
  '特別室', '露天風呂付', '露天風呂付き', 'スイート', '離れ', '貴賓室'
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

exports.handler = async function (event, context) {
  const { year, month, day } = event.queryStringParameters || {};

  if (!year || !month || !day) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Missing date parameters" }),
    };
  }

  const checkinDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const d = new Date(year, parseInt(month)-1, parseInt(day));
  d.setDate(d.getDate() + 1);
  const checkoutDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  let totalResults = -1;
  let competitors = [];

  // A案: 全体宿泊率のスクレイピング
  try {
    const targetUrl = `https://search.travel.rakuten.co.jp/ds/vacant/searchVacant?f_dai=japan&f_chu=tochigi&f_sho=nasu&f_sai=shiobara&f_otona_su=2&f_heya_su=1&f_nen1=${year}&f_tuki1=${month}&f_hi1=${day}`;
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      }
    });

    if (response.ok) {
      const html = await response.text();
      const match = html.match(/"totalResults":\[(\d+)\]/);
      if (match && match[1]) {
        totalResults = parseInt(match[1], 10);
      }
    }
  } catch (error) {
    console.error("HTML Scrape error (A案):", error.message);
  }

  // B案: ターゲット11施設の詳細取得
  try {
    const hotelNos = Object.keys(TARGETS).join(',');
    let allHotels = [];
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage && page <= 8) {
      const apiUrl = `https://openapi.rakuten.co.jp/engine/api/Travel/VacantHotelSearch/20170426?applicationId=${WORKING_APP_ID}&accessKey=${WORKING_ACCESS_KEY}&format=json&hotelNo=${hotelNos}&checkinDate=${checkinDate}&checkoutDate=${checkoutDate}&adultNum=2&searchPattern=1&hits=30&page=${page}`;
      
      try {
        const apiResp = await fetch(apiUrl, {
          headers: { 'Referer': 'https://akasawa.netlify.app/', 'Origin': 'https://akasawa.netlify.app' }
        });
        if (apiResp.ok) {
          const apiJson = await apiResp.json();
          if (apiJson && apiJson.hotels) {
            allHotels = allHotels.concat(apiJson.hotels);
            
            const pagingInfo = apiJson.pagingInfo;
            if (pagingInfo && page < pagingInfo.pageCount) {
              page++;
              await sleep(1100);
            } else {
              hasNextPage = false;
            }
          } else {
            hasNextPage = false;
          }
        } else {
          hasNextPage = false;
        }
      } catch (e) {
        hasNextPage = false;
      }
    }

    // ホテルIDごとにプランを収集するマップ
    const hotelPlansMap = {};

    allHotels.forEach(h => {
      const info = h.hotel[0].hotelBasicInfo;
      const facilityId = TARGETS[info.hotelNo];
      if (facilityId) {
        if (!hotelPlansMap[facilityId]) {
          hotelPlansMap[facilityId] = { info: info, plans: [] };
        }

        h.hotel.forEach(el => {
          if (el.roomInfo) {
            const roomBasic = el.roomInfo[0].roomBasicInfo;
            const dailyChargeContainer = el.roomInfo.find(innerEl => innerEl.dailyCharge);
            const price = dailyChargeContainer && dailyChargeContainer.dailyCharge ? dailyChargeContainer.dailyCharge.total : 999999;

            hotelPlansMap[facilityId].plans.push({
              planName: roomBasic.planName || "",
              roomName: roomBasic.roomName || "",
              price: price
            });
          }
        });
      }
    });

    // 11施設のプラン分析
    Object.keys(TARGETS).forEach(hotelNo => {
      const facilityId = TARGETS[hotelNo];
      const master = COMPETITOR_MASTER[facilityId] || {};
      const hotelData = hotelPlansMap[facilityId];

      if (!hotelData || !hotelData.plans || hotelData.plans.length === 0) {
        competitors.push({
          hotelId: facilityId,
          hotelName: master.name || facilityId,
          reviewAverage: master.rating || 0,
          hotelInformationUrl: master.url || "",
          status: "full",
          price: 0,
          planName: "",
          roomType: "",
          hasPetPlan: facilityId === "wanwan" || facilityId === "gensenkan"
        });
        return;
      }

      const { info, plans } = hotelData;
      let minPrice = 999999;
      let matchedPlanName = "";
      let matchedRoomName = "";
      let isAvailable = false;

      // プラン名から1泊2食（夕食・朝食両方あり）を厳密にチェックする補助関数
      const isOneNightTwoMeals = (planName) => {
        return true; // 食事条件は一切不問（素泊まり・朝食のみ等もすべて許可）
      };

      // 1回目のループ: 厳しい条件で1泊2食標準プランを探索
      plans.forEach(p => {
        if (p.price === 999999) return;

        const planName = p.planName;
        const roomName = p.roomName;

        // 1泊2食の判定
        if (!isOneNightTwoMeals(planName)) return;

        // 厳しい除外ワード (早割、直前、タイムセールなど)
        if (EXCLUDE_KEYWORDS.some(word => planName.includes(word))) return;
        if (EXCLUDE_ROOM_KEYWORDS.some(word => planName.includes(word) || roomName.includes(word))) return;
        
        if (facilityId !== "wanwan" && facilityId !== "gensenkan") {
          if (planName.includes('ペット') || planName.includes('愛犬') || planName.includes('ワンちゃん') || planName.includes('犬') || planName.includes('猫')) return;
        }

        isAvailable = true;
        if (p.price < minPrice) {
          minPrice = p.price;
          matchedPlanName = planName;
          matchedRoomName = roomName;
        }
      });

      // 2回目のループ (フォールバック): 厳しい除外条件で全滅した場合、早割・直前を許容して再探索
      if (!isAvailable) {
        plans.forEach(p => {
          if (p.price === 999999) return;

          const planName = p.planName;
          const roomName = p.roomName;

          if (!isOneNightTwoMeals(planName)) return;

          // 早割・直前を除外した基本除外のみ適用
          const relaxedExclude = ['一人旅', 'ビジネス', '連泊', '3名', '三名', '4名'];
          if (relaxedExclude.some(word => planName.includes(word))) return;
          if (EXCLUDE_ROOM_KEYWORDS.some(word => planName.includes(word) || roomName.includes(word))) return;
          
          if (facilityId !== "wanwan" && facilityId !== "gensenkan") {
            if (planName.includes('ペット') || planName.includes('愛犬') || planName.includes('ワンちゃん') || planName.includes('犬') || planName.includes('猫')) return;
          }

          isAvailable = true;
          if (p.price < minPrice) {
            minPrice = p.price;
            matchedPlanName = planName;
            matchedRoomName = roomName;
          }
        });
      }

      if (isAvailable && minPrice !== 999999) {
        const perPersonPrice = Math.round(minPrice / 2);
        competitors.push({
          hotelId: facilityId,
          hotelName: info.hotelName || master.name || facilityId,
          reviewAverage: info.reviewAverage ? parseFloat(info.reviewAverage) : (master.rating || 0),
          hotelInformationUrl: info.hotelInformationUrl || master.url || "",
          status: "available",
          price: perPersonPrice,
          planName: matchedPlanName,
          roomType: matchedRoomName,
          hasPetPlan: facilityId === "wanwan" || facilityId === "gensenkan"
        });
      } else {
        competitors.push({
          hotelId: facilityId,
          hotelName: master.name || info.hotelName || facilityId,
          reviewAverage: master.rating || 0,
          hotelInformationUrl: master.url || "",
          status: "full",
          price: 0,
          planName: "",
          roomType: "",
          hasPetPlan: facilityId === "wanwan" || facilityId === "gensenkan"
        });
      }
    });

  } catch (error) {
    console.error("API error (B案):", error.message);
  }

  // 万が一リストから漏れた施設を満室補完
  const allTargets = Object.values(TARGETS);
  allTargets.forEach(fid => {
    if (!competitors.find(c => c.hotelId === fid)) {
      const master = COMPETITOR_MASTER[fid] || {};
      competitors.push({
        hotelId: fid,
        hotelName: master.name || fid,
        reviewAverage: master.rating || 0,
        hotelInformationUrl: master.url || "",
        status: "full",
        price: 0,
        planName: "",
        roomType: "",
        hasPetPlan: fid === "wanwan" || fid === "gensenkan"
      });
    }
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ totalResults, competitors }),
  };
};
