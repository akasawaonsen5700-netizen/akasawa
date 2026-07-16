const dotenv = require('dotenv');
const path = require('path');

// ルートの.envから環境変数をロード
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const appId = process.env.RAKUTEN_APP_ID || '9d7baaac-17e2-4aea-a604-b4152ce2fc7b';
const accessKey = process.env.RAKUTEN_ACCESS_KEY || 'pk_cT3tE1itL8C1K35hCdS4ZXJkstCARzGtWUi4pa2oJf8';

const TARGETS = {
  14850: '旅館まじま荘',
  9304: '山口屋旅館',
  4674: '上会津屋',
  129558: '心づくしの宿 ぬりや',
  5884: '常盤ホテル',
  109143: '塩原温泉梅川壮',
  32030: '奥塩原高原ホテル',
  5650: 'やまの宿 下藤屋',
  2634: '松楓楼 松屋',
  5144: '秘湯の宿 元泉館',
  104699: 'わんわんパラダイス'
};

const hotelNos = Object.keys(TARGETS).join(',');

async function fetchRealData(checkinDate) {
  const d = new Date(checkinDate);
  d.setDate(d.getDate() + 1);
  const checkoutDate = d.toISOString().split('T')[0];

  const apiUrl = `https://openapi.rakuten.co.jp/engine/api/Travel/VacantHotelSearch/20170426?applicationId=${appId}&accessKey=${accessKey}&format=json&hotelNo=${hotelNos}&checkinDate=${checkinDate}&checkoutDate=${checkoutDate}&adultNum=2`;

  try {
    const res = await fetch(apiUrl, {
      headers: {
        'Referer': 'https://akasawa.netlify.app/',
        'Origin': 'https://akasawa.netlify.app'
      }
    });
    return await res.json();
  } catch (err) {
    return { error: err.message };
  }
}

async function main() {
  const dates = ['2026-07-16', '2026-07-18']; // 本日と週末土曜日
  
  for (const date of dates) {
    console.log(`=== DATE_START: ${date} ===`);
    const result = await fetchRealData(date);
    if (result.hotels) {
      result.hotels.forEach(h => {
        const info = h.hotel[0].hotelBasicInfo;
        const plans = h.hotel.slice(1);
        let minPrice = 999999;
        let planName = "";
        plans.forEach(p => {
          if (p.roomInfo && p.roomInfo[1] && p.roomInfo[1].dailyCharge) {
            const price = p.roomInfo[1].dailyCharge.total;
            if (price < minPrice) {
              minPrice = price;
              planName = p.roomInfo[0].roomBasicInfo.planName;
            }
          }
        });
        console.log(JSON.stringify({
          hotelName: info.hotelName,
          reviewAverage: info.reviewAverage,
          price: minPrice === 999999 ? '満室' : minPrice,
          planName: planName,
          url: info.hotelInformationUrl
        }));
      });
    } else {
      console.log(`ERROR_OR_NO_DATA: ${JSON.stringify(result)}`);
    }
    console.log(`=== DATE_END: ${date} ===`);
  }
}

main();
