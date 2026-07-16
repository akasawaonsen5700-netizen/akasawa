const WORKING_APP_ID = process.env.RAKUTEN_APP_ID || '9d7baaac-17e2-4aea-a604-b4152ce2fc7b';
const WORKING_ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY || 'pk_cT3tE1itL8C1K35hCdS4ZXJkstCARzGtWUi4pa2oJf8';

const TARGETS = {
  14850: 'majimaso',
  9304: 'yamaguciya',
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

// 11施設の詳細マスタデータ（満室時のフォールバックおよびデータ整合用）
const COMPETITOR_MASTER = {
  majimaso: { name: '旅館まじま荘', rating: 4.2, url: 'https://travel.rakuten.co.jp/HOTEL/14850/', planKeyword: 'スタンダードプラン' },
  yamaguciya: { name: '山口屋旅館', rating: 4.1, url: 'https://travel.rakuten.co.jp/HOTEL/9304/', planKeyword: '1泊2食付きプラン' },
  kamiaizuya: { name: '上会津屋', rating: 4.4, url: 'https://travel.rakuten.co.jp/HOTEL/4674/', planKeyword: '源泉かけ流し満喫プラン' },
  nuriya: { name: '心づくしの宿 ぬりや', rating: 4.3, url: 'https://travel.rakuten.co.jp/HOTEL/129558/', planKeyword: '心づくし会席プラン' },
  tokiwa: { name: '常盤ホテル', rating: 4.0, url: 'https://travel.rakuten.co.jp/HOTEL/5884/', planKeyword: '温泉と旬の味覚プラン' },
  umekawaso: { name: '塩原温泉梅川壮', rating: 4.4, url: 'https://travel.rakuten.co.jp/HOTEL/109143/', planKeyword: '温泉満喫プラン' },
  okukogen: { name: '奥塩原高原ホテル', rating: 4.2, url: 'https://travel.rakuten.co.jp/HOTEL/32030/', planKeyword: '高原リゾート満喫プラン' },
  shimofujiya: { name: 'やまの宿 下藤屋', rating: 4.5, url: 'https://travel.rakuten.co.jp/HOTEL/5650/', planKeyword: '特選会席プラン' },
  shofuro: { name: '松楓楼 松屋', rating: 4.5, url: 'https://travel.rakuten.co.jp/HOTEL/2634/', planKeyword: '露天風呂付き客室プラン' },
  gensenkan: { name: '秘湯の宿 元泉館', rating: 4.2, url: 'https://travel.rakuten.co.jp/HOTEL/5144/', planKeyword: '愛犬と同室宿泊プラン' },
  wanwan: { name: 'わんわんパラダイス', rating: 4.2, url: 'https://travel.rakuten.co.jp/HOTEL/104699/', planKeyword: 'ドッグリゾート満喫プラン' }
};

// 全共通の除外プランキーワード
const EXCLUDE_KEYWORDS = [
  '早割', '直前', 'タイムセール', '一人旅', 'ビジネス', '連泊', '訳あり', '訳有', '記念日', '3名', '三名', '4名'
];

// 高級客室などを除外するための客室キーワード
const EXCLUDE_ROOM_KEYWORDS = [
  '特別室', '露天風呂付', '露天風呂付き', 'スイート', '離れ', '貴賓室'
];

exports.handler = async function (event, context) {
  const { year, month, day } = event.queryStringParameters || {};

  if (!year || !month || !day) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Missing date parameters" }),
    };
  }

  const checkinDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const d = new Date(year, parseInt(month)-1, parseInt(day));
  d.setDate(d.getDate() + 1);
  const checkoutDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  let totalResults = -1;
  let competitors = [];

  // A案: 全体宿泊率のスクレイピング（WAFブロックを許容）
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

  // B案: ターゲット11施設のリアルタイム詳細取得
  try {
    const hotelNos = Object.keys(TARGETS).join(',');
    const apiUrl = `https://openapi.rakuten.co.jp/engine/api/Travel/VacantHotelSearch/20170426?applicationId=${WORKING_APP_ID}&accessKey=${WORKING_ACCESS_KEY}&format=json&hotelNo=${hotelNos}&checkinDate=${checkinDate}&checkoutDate=${checkoutDate}&adultNum=2`;
    
    const apiResp = await fetch(apiUrl, {
      headers: {
        'Referer': 'https://akasawa.netlify.app/',
        'Origin': 'https://akasawa.netlify.app'
      }
    });
    
    if (apiResp.ok) {
      const apiJson = await apiResp.json();
      if (apiJson && apiJson.hotels) {
        apiJson.hotels.forEach(h => {
          const info = h.hotel[0].hotelBasicInfo;
          const plans = h.hotel.slice(1);
          
          const facilityId = TARGETS[info.hotelNo];
          if (facilityId) {
            const master = COMPETITOR_MASTER[facilityId] || {};

            let minPrice = 999999;
            let matchedPlanName = "";
            let matchedRoomName = "";
            let isAvailable = false;

            plans.forEach(p => {
              if (p.roomInfo && p.roomInfo[1] && p.roomInfo[1].dailyCharge) {
                const planName = p.roomInfo[0].roomBasicInfo.planName || "";
                const roomName = p.roomInfo[0].roomBasicInfo.roomName || "";
                const price = p.roomInfo[1].dailyCharge.total;

                // --- フィルタリング条件の適用 ---

                // 1. 食事条件: 夕食と朝食が両方とも付いていること (1泊2食付)
                const withDinner = p.roomInfo[0].roomBasicInfo.withDinner !== false;
                const withBreakfast = p.roomInfo[0].roomBasicInfo.withBreakfast !== false;
                if (!withDinner || !withBreakfast) {
                  return;
                }
                const lowPlanName = planName.toLowerCase();
                if (lowPlanName.includes('素泊') || lowPlanName.includes('食事なし') || lowPlanName.includes('朝食のみ') || lowPlanName.includes('朝食付') || lowPlanName.includes('夕食のみ')) {
                  if (!lowPlanName.includes('2食') && !lowPlanName.includes('夕朝')) {
                    return;
                  }
                }

                // 2. 除外プランキーワードの適用
                const hasExcludePlanWord = EXCLUDE_KEYWORDS.some(word => planName.includes(word));
                if (hasExcludePlanWord) {
                  return;
                }

                // 3. 除外客室キーワードの適用（高級客室・特別室を除外）
                const hasExcludeRoomWord = EXCLUDE_ROOM_KEYWORDS.some(word => planName.includes(word) || roomName.includes(word));
                if (hasExcludeRoomWord) {
                  return;
                }

                // 4. ペット不可施設の場合、ペット関連プランを除外
                if (facilityId !== "wanwan" && facilityId !== "gensenkan") {
                  if (planName.includes('ペット') || planName.includes('愛犬') || planName.includes('ワンちゃん') || planName.includes('犬') || planName.includes('猫')) {
                    return;
                  }
                }

                // すべての条件を満たした場合、最安値を計算
                isAvailable = true;
                if (price < minPrice) {
                  minPrice = price;
                  matchedPlanName = planName;
                  matchedRoomName = roomName;
                }
              }
            });

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
          }
        });
      }
    }
  } catch (error) {
    console.error("API error (B案):", error.message);
  }

  // APIレスポンスに含まれなかった施設は満室扱いとしてマスタ情報から補完して返す
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
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({ totalResults, competitors }),
  };
};
