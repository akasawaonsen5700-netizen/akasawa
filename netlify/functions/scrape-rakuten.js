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

exports.handler = async function (event, context) {
  const { year, month, day } = event.queryStringParameters || {};

  if (!year || !month || !day) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Missing date parameters" })
    };
  }

  const checkinDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const d = new Date(year, parseInt(month)-1, parseInt(day));
  d.setDate(d.getDate() + 1);
  const checkoutDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  let totalResults = -1;
  let competitors = [];

  // A案: 全体宿泊率のスクレイピング (約65施設中、空室のある施設数)
  try {
    const htmlUrl = `https://search.travel.rakuten.co.jp/ds/vacant/searchVacant?f_dai=japan&f_chu=tochigi&f_sho=nasu&f_sai=shiobara&f_otona_su=2&f_heya_su=1&f_nen1=${year}&f_tuki1=${month}&f_hi1=${day}`;
    const respHTML = await fetch(htmlUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html'
      }
    });
    const html = await respHTML.text();
    const match = html.match(/"totalResults":\[?(\d+)\]?/);
    if (match && match[1]) {
      totalResults = parseInt(match[1], 10);
    }
  } catch (err) {
    console.error("HTML Scrape error:", err);
  }

  // B案: ターゲット11施設のリアルタイム価格と空室取得
  try {
    const hotelNos = Object.keys(TARGETS).join(',');
    const apiUrl = `https://openapi.rakuten.co.jp/engine/api/Travel/VacantHotelSearch/20170426?applicationId=${WORKING_APP_ID}&accessKey=${WORKING_ACCESS_KEY}&format=json&hotelNo=${hotelNos}&checkinDate=${checkinDate}&checkoutDate=${checkoutDate}&adultNum=2`;
    
    const apiResp = await fetch(apiUrl, {
      headers: {
        'Referer': 'https://akasawa.netlify.app/',
        'Origin': 'https://akasawa.netlify.app'
      }
    });
    const apiJson = await apiResp.json();
    
    if (apiJson.hotels) {
      apiJson.hotels.forEach(h => {
        const info = h.hotel[0].hotelBasicInfo;
        const plans = h.hotel.slice(1);
        
        let minPrice = 999999;
        let planName = "";
        let roomName = "";
        
        plans.forEach(p => {
          if (p.roomInfo && p.roomInfo[1] && p.roomInfo[1].dailyCharge) {
            const price = p.roomInfo[1].dailyCharge.total;
            if (price < minPrice) {
              minPrice = price;
              planName = p.roomInfo[0].roomBasicInfo.planName;
              roomName = p.roomInfo[0].roomBasicInfo.roomName;
            }
          }
        });
        
        const facilityId = TARGETS[info.hotelNo];
        if (facilityId) {
          competitors.push({
            hotelId: facilityId,
            status: "available",
            price: minPrice === 999999 ? 0 : minPrice,
            planName: planName,
            roomType: roomName,
            hasPetPlan: facilityId === "wanwan" || facilityId === "okukogen",
          });
        }
      });
    }
    
    // APIレスポンスに含まれなかった施設は満室
    Object.values(TARGETS).forEach(fid => {
      if (!competitors.find(c => c.hotelId === fid)) {
        competitors.push({
          hotelId: fid,
          status: "full",
          price: 0,
          planName: "",
          roomType: "",
          hasPetPlan: fid === "wanwan" || fid === "okukogen",
        });
      }
    });
    
  } catch (err) {
    console.error("API error:", err);
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({ totalResults, competitors }),
  };
};
