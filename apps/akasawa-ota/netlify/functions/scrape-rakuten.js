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

// 楽天トラベルの「塩原温泉」カテゴリ (67宿) の公式ホテルNoリスト
const SHIOBARA_HOTEL_IDS = new Set([
  "104699","106120","108911","10893","109143","109188","129503","129558","130092","130512",
  "135495","137011","139924","141349","14850","148895","149003","158803","168710","171075",
  "171102","178660","179991","180420","181731","182177","182335","183256","184890","188070",
  "189516","191142","191906","192419","194095","195152","196027","196231","196671","196672",
  "198021","198042","198660","199770","20063","20095","2477","2491","2634","29530",
  "30967","31902","32030","38848","40934","41140","4674","5144","5650","5884",
  "68477","72035","74518","74676","74699","9129","9304"
]);

// 除外プランキーワード (ステップ1用)
const EXCLUDE_KEYWORDS = [
  '早割', '直前', 'タイムセール', '一人旅', 'ビジネス', '連泊', '訳あり', '訳有', '記念日', '3名', '三名', '4名'
];

// 高級客室などを除外するための客室キーワード (ステップ1, 2用)
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

  // --- クエリ1: A案 エリア全体の空室検索 (全体満室率の算出用) ---
  try {
    let areaHotels = [];
    let areaPage = 1;
    let hasNextAreaPage = true;

    while (hasNextAreaPage && areaPage <= 3) {
      const areaApiUrl = `https://openapi.rakuten.co.jp/engine/api/Travel/VacantHotelSearch/20170426?applicationId=${WORKING_APP_ID}&accessKey=${WORKING_ACCESS_KEY}&format=json&largeClassCode=japan&middleClassCode=tochigi&smallClassCode=shiobara&checkinDate=${checkinDate}&checkoutDate=${checkoutDate}&adultNum=2&searchPattern=0&hits=30&page=${areaPage}`;
      
      const areaResp = await fetch(areaApiUrl, {
        headers: { 'Referer': 'https://akasawa.netlify.app/', 'Origin': 'https://akasawa.netlify.app' }
      });
      
      if (areaResp.ok) {
        const areaJson = await areaResp.json();
        if (areaJson && areaJson.hotels) {
          areaHotels = areaHotels.concat(areaJson.hotels);
          const pagingInfo = areaJson.pagingInfo;
          if (pagingInfo && areaPage < pagingInfo.pageCount) {
            areaPage++;
            await sleep(1100);
          } else {
            hasNextAreaPage = false;
          }
        } else {
          hasNextAreaPage = false;
        }
      } else {
        hasNextAreaPage = false;
      }
    }

    if (areaHotels.length > 0) {
      const filteredShiobaraHotels = areaHotels.filter(h => {
        const info = h.hotel[0].hotelBasicInfo;
        return SHIOBARA_HOTEL_IDS.has(String(info.hotelNo));
      });
      totalResults = filteredShiobaraHotels.length;
      console.log(`Vacant area search resolved strictly to ${totalResults} hotels in Shiobara Onsen.`);
    }
  } catch (error) {
    console.error("Area Vacant Search error (A案):", error.message);
  }

  await sleep(1100);

  // --- クエリ2: B案 ターゲット11施設一括詳細検索 ---
  try {
    const hotelNos = Object.keys(TARGETS).join(',');
    let allHotels = [];
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage && page <= 4) {
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

    const isOneNightTwoMeals = (planName) => {
      const low = planName.toLowerCase();
      
      if (low.includes('素泊') || low.includes('食事なし') || low.includes('食事無し') || low.includes('食事無') || low.includes('朝食のみ') || low.includes('夕食のみ') || low.includes('朝食なし') || low.includes('夕食なし') || low.includes('朝食無し') || low.includes('夕食無し') || low.includes('朝寝坊ok')) {
        if (low.includes('2食') || low.includes('夕朝') || low.includes('朝夕')) {
          return true;
        }
        return false;
      }
      
      if (low.includes('朝食付') || low.includes('朝食付き')) {
        if (!low.includes('夕食') && !low.includes('会席') && !low.includes('膳') && !low.includes('ディナー') && !low.includes('2食') && !low.includes('夕朝')) {
          return false;
        }
      }
      if (low.includes('夕食付') || low.includes('夕食付き')) {
        if (!low.includes('朝食') && !low.includes('2食') && !low.includes('夕朝')) {
          return false;
        }
      }

      return true;
    };

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
          lowPrice: 0,
          planName: "",
          roomType: "",
          roomCount: 0,
          hasPetPlan: facilityId === "wanwan" || facilityId === "gensenkan"
        });
        return;
      }

      const { info, plans } = hotelData;
      
      // 10帖通常プラン判定用の変数
      let stdMinPrice = 999999;
      let stdMatchedPlanName = "";
      let stdMatchedRoomName = "";
      let isStdAvailable = false;

      // 10帖以外を含む全体の1泊2食最安値判定用の変数
      let absoluteMinPrice = 999999;
      let absMatchedPlanName = "";
      let absMatchedRoomName = "";
      let isAnyAvailable = false;

      // --- 探索1: 10帖通常（ステップ1・2の基準に合う標準10帖客室プラン） ---
      plans.forEach(p => {
        if (p.price === 999999) return;

        const planName = p.planName;
        const roomName = p.roomName;

        if (!isOneNightTwoMeals(planName)) return;

        // 標準的な「10畳」などの通常比較プランを狙い撃ち
        if (EXCLUDE_KEYWORDS.some(word => planName.includes(word))) return;
        if (EXCLUDE_ROOM_KEYWORDS.some(word => planName.includes(word) || roomName.includes(word))) return;
        
        // 標準和室10畳系以外のベッド洋室や極端に狭い部屋、特異な部屋を除外（10帖に近い部屋を対象にする）
        const lowRoom = roomName.toLowerCase();
        if (lowRoom.includes('シングル') || lowRoom.includes('ダブル') || lowRoom.includes('ツイン') || lowRoom.includes('訳あり') || lowRoom.includes('訳有')) return;

        if (facilityId !== "wanwan" && facilityId !== "gensenkan") {
          if (planName.includes('ペット') || planName.includes('愛犬') || planName.includes('ワンちゃん') || planName.includes('犬') || planName.includes('猫')) return;
        }

        isStdAvailable = true;
        if (p.price < stdMinPrice) {
          stdMinPrice = p.price;
          stdMatchedPlanName = planName;
          stdMatchedRoomName = roomName;
        }
      });

      // --- 探索2: 10帖以外の1泊2食すべてを含む絶対最安値 (ステップ3) ---
      plans.forEach(p => {
        if (p.price === 999999) return;

        const planName = p.planName;
        const roomName = p.roomName;

        if (!isOneNightTwoMeals(planName)) return;

        // 2人利用不可のプラン（一人旅、3人以上など）のみ除外
        const minExclude = ['一人旅', '3名', '三名', '4名'];
        if (minExclude.some(word => planName.includes(word))) return;

        isAnyAvailable = true;
        if (p.price < absoluteMinPrice) {
          absoluteMinPrice = p.price;
          absMatchedPlanName = planName;
          absMatchedRoomName = roomName;
        }
      });

      // レスポンスの構築
      if (isAnyAvailable && absoluteMinPrice !== 999999) {
        const perPersonLowPrice = Math.round(absoluteMinPrice / 2);
        const perPersonStdPrice = isStdAvailable && stdMinPrice !== 999999 ? Math.round(stdMinPrice / 2) : 0;
        
        competitors.push({
          hotelId: facilityId,
          hotelName: info.hotelName || master.name || facilityId,
          reviewAverage: info.reviewAverage ? parseFloat(info.reviewAverage) : (master.rating || 0),
          hotelInformationUrl: info.hotelInformationUrl || master.url || "",
          status: "available",
          price: perPersonStdPrice, // 10帖通常プランの1人あたり価格 (なければ0)
          lowPrice: perPersonLowPrice, // 10帖以外を含む1泊2食最安値
          planName: stdMatchedPlanName || absMatchedPlanName,
          roomType: stdMatchedRoomName || absMatchedRoomName,
          roomCount: plans.length,
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
          lowPrice: 0,
          planName: "",
          roomType: "",
          roomCount: 0,
          hasPetPlan: facilityId === "wanwan" || facilityId === "gensenkan"
        });
      }
    });

  } catch (error) {
    console.error("API error (B案):", error.message);
  }

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
        lowPrice: 0,
        planName: "",
        roomType: "",
        roomCount: 0,
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
