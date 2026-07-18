const WORKING_APP_ID = process.env.RAKUTEN_APP_ID || '9d7baaac-17e2-4aea-a604-b4152ce2fc7b';
const WORKING_ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY || 'pk_cT3tE1itL8C1K35hCdS4ZXJkstCARzGtWUi4pa2oJf8';
async function test() {
  const url = `https://openapi.rakuten.co.jp/engine/api/Travel/VacantHotelSearch/20170426?applicationId=${WORKING_APP_ID}&accessKey=${WORKING_ACCESS_KEY}&format=json&hotelNo=14850&checkinDate=2026-08-01&checkoutDate=2026-08-02&adultNum=2&searchPattern=1`;
  const res = await fetch(url, {
    headers: { 'Referer': 'https://akasawa.netlify.app/', 'Origin': 'https://akasawa.netlify.app' }
  });
  const json = await res.json();
  if (json.hotels) {
    const hotel = json.hotels[0].hotel;
    const roomInfo = hotel.find(h => h.roomInfo);
    if (roomInfo) {
      console.log(JSON.stringify(roomInfo.roomInfo[0].roomBasicInfo, null, 2));
    }
  } else { console.log(json); }
}
test();
