const fs = require('fs');
const path = require('path');

// ==========================================
// 1. カレンダー設定（調査対象日）
// ==========================================
// 例として、本日から14日分のカレンダーを作成
function generateCalendar(days) {
  const calendar = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateString = d.toISOString().split('T')[0];
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    // モック用の属性として、土曜と特定の日をイベント日（繁忙期）とする
    const isEventDay = d.getDay() === 6 || i === 5; // 例: 5日後を連休/お盆扱い
    calendar.push({ date: dateString, isWeekend, isEventDay });
  }
  return calendar;
}

// ==========================================
// 2. モックデータ生成（各施設のスクレイピング結果を模す）
// ==========================================
// 実際にはここでPuppeteer/Cheerio等を用いてOTAからデータを取得します
function scrapeMarketData(calendar) {
  const facilitiesData = [];
  const facilityNames = [
    { name: '旅館A（直接比較）', type: 'direct' },
    { name: '旅館B（直接比較）', type: 'direct' },
    { name: 'ホテルC（直接比較）', type: 'direct' },
    { name: '高級宿D（相場参考）', type: 'reference' },
    { name: '民宿E（相場参考）', type: 'reference' }
  ];

  for (const day of calendar) {
    const dailyData = {
      date: day.date,
      isEventDay: day.isEventDay,
      facilities: []
    };

    for (const fac of facilityNames) {
      // 日付と施設に応じたダミーデータ生成
      const basePrice = fac.type === 'direct' ? 12000 : (fac.name.includes('高級') ? 25000 : 8000);
      // イベント日は1.5倍に価格上昇
      const priceMultiplier = day.isEventDay ? 1.5 : 1.0;
      // ランダム性を持たせる
      const randomVariance = Math.floor(Math.random() * 3000) - 1000;
      
      const price = Math.floor((basePrice * priceMultiplier) + randomVariance);
      
      // 満室判定（イベント日は満室になりやすい）
      const isFull = day.isEventDay ? Math.random() > 0.4 : Math.random() > 0.8;
      const status = isFull ? '満室' : '販売中';

      // その他の調査項目
      const hasCoupon = Math.random() > 0.7;
      const isPetFriendly = fac.name.includes('B') || fac.name.includes('E');
      
      dailyData.facilities.push({
        facilityName: fac.name,
        type: fac.type, // 'direct' or 'reference'
        
        // 6. 調査項目
        price: isFull ? null : price, // 満室の場合は価格なし
        status: status,
        planName: `【スタンダード】2食付きプラン`,
        roomType: '和室10畳',
        mealCondition: '1泊2食付',
        hasCoupon: hasCoupon,
        hasOtaCampaign: Math.random() > 0.8,
        hasPetPlan: isPetFriendly,
        hasCharacteristicPlan: Math.random() > 0.8,
        hasEarlyBird: !day.isEventDay && Math.random() > 0.5,
        hasLastMinute: Math.random() > 0.9,
        hasAnniversaryPlan: Math.random() > 0.5,
        hasPetCompanion: isPetFriendly,
        hasPrivateBath: fac.name.includes('A') || fac.name.includes('D'),
        hasOpenAirBathRoom: fac.name.includes('D')
      });
    }
    facilitiesData.push(dailyData);
  }

  return facilitiesData;
}

// ==========================================
// 3. データ集計ロジック（7. 集計方法）
// ==========================================
function aggregateData(marketData) {
  const aggregatedResults = [];
  
  // 通常日の平均価格（上昇幅計算用）
  let normalDayDirectPrices = [];

  // まず通常日の直接比較施設の価格を集める
  marketData.forEach(day => {
    if (!day.isEventDay) {
      day.facilities.forEach(fac => {
        if (fac.type === 'direct' && fac.price !== null) {
          normalDayDirectPrices.push(fac.price);
        }
      });
    }
  });

  const normalDayAvg = normalDayDirectPrices.length > 0 
    ? normalDayDirectPrices.reduce((a, b) => a + b, 0) / normalDayDirectPrices.length 
    : 0;

  marketData.forEach(day => {
    // 日別の集計
    const directPrices = day.facilities
      .filter(f => f.type === 'direct' && f.price !== null)
      .map(f => f.price)
      .sort((a, b) => a - b);
    
    const allPrices = day.facilities
      .filter(f => f.price !== null)
      .map(f => f.price)
      .sort((a, b) => a - b);

    const petPrices = day.facilities
      .filter(f => f.hasPetPlan && f.price !== null)
      .map(f => f.price)
      .sort((a, b) => a - b);

    // 満室施設数
    const fullFacilitiesCount = day.facilities.filter(f => f.status === '満室').length;
    
    // クーポン実施施設数
    const couponFacilitiesCount = day.facilities.filter(f => f.hasCoupon).length;

    // 計算
    const directAvg = directPrices.length > 0 
      ? Math.round(directPrices.reduce((a, b) => a + b, 0) / directPrices.length) 
      : null;
    
    const directMedian = directPrices.length > 0
      ? (directPrices.length % 2 !== 0 
        ? directPrices[Math.floor(directPrices.length / 2)] 
        : (directPrices[directPrices.length / 2 - 1] + directPrices[directPrices.length / 2]) / 2)
      : null;

    const directMin = directPrices.length > 0 ? directPrices[0] : null;
    const directMax = directPrices.length > 0 ? directPrices[directPrices.length - 1] : null;

    const allMin = allPrices.length > 0 ? allPrices[0] : null;
    const allMax = allPrices.length > 0 ? allPrices[allPrices.length - 1] : null;

    const petMin = petPrices.length > 0 ? petPrices[0] : null;
    const petMax = petPrices.length > 0 ? petPrices[petPrices.length - 1] : null;

    // イベント日の上昇幅
    let increaseRate = null;
    if (day.isEventDay && directAvg !== null && normalDayAvg > 0) {
      increaseRate = Math.round(((directAvg - normalDayAvg) / normalDayAvg) * 100);
    }

    aggregatedResults.push({
      date: day.date,
      isEventDay: day.isEventDay,
      summary: {
        "直接比較施設の平均価格": directAvg,
        "直接比較施設の中央値": directMedian,
        "直接比較施設の最安値": directMin,
        "直接比較施設の最高値": directMax,
        "市場全体の価格帯 (最安〜最高)": allMin !== null ? `${allMin}円 〜 ${allMax}円` : 'データなし',
        "満室施設数": fullFacilitiesCount,
        "クーポン実施施設数": couponFacilitiesCount,
        "ペット可施設の価格帯": petMin !== null ? `${petMin}円 〜 ${petMax}円` : '販売なし',
        "通常日比の上昇幅": increaseRate !== null ? `+${increaseRate}%` : '---'
      }
    });
  });

  return { aggregatedResults, rawData: marketData };
}

// ==========================================
// 4. メイン実行処理
// ==========================================
async function run() {
  console.log("市場調査スクリプトを開始します...");
  
  // 14日分のカレンダーを生成
  const calendar = generateCalendar(14);
  console.log(`対象期間: ${calendar[0].date} から ${calendar[calendar.length - 1].date} までの ${calendar.length}日間`);

  // スクレイピング実行（モック）
  console.log("各OTAから施設データを収集しています...");
  const marketData = scrapeMarketData(calendar);

  // データ集計
  console.log("要件に基づく集計処理を実行しています...");
  const { aggregatedResults, rawData } = aggregateData(marketData);

  // ファイルに出力
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `market_report_${timestamp}.json`);
  const finalOutput = {
    generatedAt: new Date().toISOString(),
    aggregatedData: aggregatedResults,
    rawFacilitiesData: rawData
  };

  fs.writeFileSync(outputPath, JSON.stringify(finalOutput, null, 2), 'utf-8');
  
  console.log(`\n=================================================`);
  console.log(`✅ 調査・集計が完了しました。`);
  console.log(`出力先: ${outputPath}`);
  console.log(`=================================================\n`);
  
  // サマリーをコンソールにも表示（オーナーがすぐ見れるように）
  console.log("【直近3日間の集計サマリー】");
  aggregatedResults.slice(0, 3).forEach(res => {
    console.log(`\n📅 日付: ${res.date} ${res.isEventDay ? '🔥(繁忙期/休前日)' : ''}`);
    for (const [key, val] of Object.entries(res.summary)) {
      console.log(`  - ${key}: ${val}`);
    }
  });
}

run();
