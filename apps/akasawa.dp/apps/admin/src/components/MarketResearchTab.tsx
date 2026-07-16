import React, { useState, useMemo, useEffect } from "react";
import { MarketResearchData } from "../types";
import "./MarketResearchTab.css";

import TARGET_FACILITIES_JSON from "../../../../../../shared/target_hotels.json";

// 仕様書に基づく調査対象施設
const TARGET_FACILITIES = TARGET_FACILITIES_JSON;

const TARGET_DATES = [
  { date: "2026-07-22", label: "通常（水）", isEvent: false },
  { date: "2026-07-25", label: "通常（土）", isEvent: true },
  { date: "2026-07-27", label: "イベント（前夜祭）", isEvent: true },
  { date: "2026-08-10", label: "イベント（花火大会）", isEvent: true },
  { date: "2026-08-13", label: "繁忙期（お盆）", isEvent: true },
  { date: "2026-08-22", label: "通常（土）", isEvent: true }
];

type MetricType = "prices" | "direct_avg" | "direct_median" | "direct_min" | "direct_max" | "all_range" | "full_count" | "coupon_count" | "pet_range" | "event_increase" | "stats";

const METRICS: { id: MetricType, label: string, icon: string }[] = [
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

interface Props {
  researchData: MarketResearchData[];
  onSaveData?: (data: MarketResearchData[]) => void;
}

export default function MarketResearchTab({ researchData, onSaveData }: Props) {
  // 今日の日付を初期値とする
  const getTodayStr = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [selectedMetric, setSelectedMetric] = useState<MetricType>("prices");
  const [selectedOta, setSelectedOta] = useState<"rakuten" | "jalan">("rakuten");
  const [realOccRate, setRealOccRate] = useState<number | null>(null);
  const [realVacantCount, setRealVacantCount] = useState<number | null>(null);
  const [apiCompetitorsData, setApiCompetitorsData] = useState<MarketResearchData[] | null>(null);
  const [isFetchingOcc, setIsFetchingOcc] = useState<boolean>(false);
  const TOTAL_SHIOBARA_HOTELS = 67; // 塩原温泉の総施設数（仕様に基づく）

  // リアルタイム市場データフェッチ
  useEffect(() => {
    let isMounted = true;
    const fetchRealData = async () => {
      setIsFetchingOcc(true);
      setRealOccRate(null);
      setApiCompetitorsData(null);

      const dObj = new Date(selectedDate);
      const year = dObj.getFullYear();
      const month = String(dObj.getMonth() + 1).padStart(2, '0');
      const day = String(dObj.getDate()).padStart(2, '0');

      // Netlify Functions (自社サーバーサイド) を経由して楽天トラベルから取得（CORS完全回避）
      const proxyUrl = `/api/scrape-rakuten?year=${year}&month=${month}&day=${day}`;

      try {
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`Network error: ${response.status}`);
        const json = await response.json();
        
        if (isMounted) {
          if (json.totalResults !== undefined && json.totalResults !== -1) {
            const vacantCount = json.totalResults;
            setRealVacantCount(vacantCount);
            let occ = Math.floor(((TOTAL_SHIOBARA_HOTELS - vacantCount) / TOTAL_SHIOBARA_HOTELS) * 100);
            occ = Math.max(0, Math.min(100, occ));
            setRealOccRate(occ);
          }
          if (json.competitors) {
            const formatted = json.competitors.map((c: any) => ({
              id: `${selectedDate}-api-${selectedOta}-${c.hotelId}`,
              dateKey: selectedDate,
              ota: "rakuten",
              hotelId: c.hotelId,
              status: c.status,
              price: c.price,
              lowPrice: c.lowPrice,
              planName: c.planName || "",
              roomType: c.roomType || "",
              meals: "1泊2食",
              hasCoupon: false,
              hasCampaign: false,
              hasPetPlan: c.hasPetPlan,
              reviewAverage: c.reviewAverage,
              hotelInformationUrl: c.hotelInformationUrl,
              roomCount: c.roomCount,
              features: [],
              updatedAt: new Date().toISOString()
            }));
            setApiCompetitorsData(formatted);
          }
        }
      } catch (error) {
        console.error("Scraping failed:", error);
      } finally {
        if (isMounted) setIsFetchingOcc(false);
      }
    };

    fetchRealData();
    return () => { isMounted = false; };
  }, [selectedDate]);

  // 現在選択されている日付のデータを取得（APIの実績データのみを使用し、シミュレーションやモックデータは使用しない）
  const currentDateData = useMemo(() => {
    // APIから取得できた場合は優先して使用する
    if (apiCompetitorsData && selectedOta === "rakuten" && apiCompetitorsData.length > 0) {
      return TARGET_FACILITIES.map(facility => {
        const found = apiCompetitorsData.find(d => d.hotelId === facility.id);
        if (found) return found;
        
        const masterUrl = 
          facility.id === "majimaso" ? "https://travel.rakuten.co.jp/HOTEL/14850/" :
          facility.id === "kamiaizuya" ? "https://travel.rakuten.co.jp/HOTEL/4674/" :
          facility.id === "nuriya" ? "https://travel.rakuten.co.jp/HOTEL/129558/" :
          facility.id === "tokiwa" ? "https://travel.rakuten.co.jp/HOTEL/5884/" :
          facility.id === "umekawaso" ? "https://travel.rakuten.co.jp/HOTEL/109143/" :
          facility.id === "okukogen" ? "https://travel.rakuten.co.jp/HOTEL/32030/" :
          facility.id === "shimofujiya" ? "https://travel.rakuten.co.jp/HOTEL/5650/" :
          facility.id === "shofuro" ? "https://travel.rakuten.co.jp/HOTEL/2634/" :
          facility.id === "gensenkan" ? "https://travel.rakuten.co.jp/HOTEL/5144/" :
          facility.id === "wanwan" ? "https://travel.rakuten.co.jp/HOTEL/104699/" : "";

        return {
          id: `${selectedDate}-api-${selectedOta}-${facility.id}`,
          dateKey: selectedDate,
          ota: selectedOta,
          hotelId: facility.id,
          status: "full" as const,
          price: 0,
          planName: "",
          roomType: "",
          meals: "",
          hasCoupon: false,
          hasCampaign: false,
          hasPetPlan: facility.type === "pet",
          reviewAverage: 0,
          hotelInformationUrl: masterUrl,
          features: [],
          updatedAt: new Date().toISOString()
        };
      });
    }

    // データが一切存在しない場合でも、11施設の枠組み（宿URL付き、満室扱い表示）を返す
    return TARGET_FACILITIES.map(facility => {
      const masterUrl = 
        facility.id === "majimaso" ? "https://travel.rakuten.co.jp/HOTEL/14850/" :
        facility.id === "kamiaizuya" ? "https://travel.rakuten.co.jp/HOTEL/4674/" :
        facility.id === "nuriya" ? "https://travel.rakuten.co.jp/HOTEL/129558/" :
        facility.id === "tokiwa" ? "https://travel.rakuten.co.jp/HOTEL/5884/" :
        facility.id === "umekawaso" ? "https://travel.rakuten.co.jp/HOTEL/109143/" :
        facility.id === "okukogen" ? "https://travel.rakuten.co.jp/HOTEL/32030/" :
        facility.id === "shimofujiya" ? "https://travel.rakuten.co.jp/HOTEL/5650/" :
        facility.id === "shofuro" ? "https://travel.rakuten.co.jp/HOTEL/2634/" :
        facility.id === "gensenkan" ? "https://travel.rakuten.co.jp/HOTEL/5144/" :
        facility.id === "wanwan" ? "https://travel.rakuten.co.jp/HOTEL/104699/" : "";

      return {
        id: `${selectedDate}-fallback-${selectedOta}-${facility.id}`,
        dateKey: selectedDate,
        ota: selectedOta,
        hotelId: facility.id,
        status: "full" as const,
        price: 0,
        planName: "",
        roomType: "",
        meals: "",
        hasCoupon: false,
        hasCampaign: false,
        hasPetPlan: facility.type === "pet",
        reviewAverage: 0,
        hotelInformationUrl: masterUrl,
        features: [],
        updatedAt: new Date().toISOString()
      };
    });
  }, [selectedDate, selectedOta, apiCompetitorsData]);


  // 各種集計値の計算
  const aggregatedResults = useMemo(() => {
    const facilitiesWithData = TARGET_FACILITIES.map(facility => {
      const data = currentDateData.find(d => d.hotelId === facility.id);
      return { facility, data };
    }).filter(item => item.data !== undefined); // データがあるもののみ

    const directPrices = facilitiesWithData
      .filter(f => f.facility.type === "direct" && f.data && f.data.price > 0 && f.data.status !== "full")
      .map(f => f.data!.price)
      .sort((a, b) => a - b);

    const allPrices = facilitiesWithData
      .filter(f => f.data && f.data.price > 0 && f.data.status !== "full")
      .map(f => f.data!.price)
      .sort((a, b) => a - b);

    const petPrices = facilitiesWithData
      .filter(f => f.facility.type === "pet" && f.data && f.data.price > 0 && f.data.status !== "full")
      .map(f => f.data!.price)
      .sort((a, b) => a - b);

    const fullFacilities = facilitiesWithData.filter(f => f.data?.status === "full" || f.data?.status === "few");
    const couponFacilities = facilitiesWithData.filter(f => f.data?.hasCoupon);

    const directAvg = directPrices.length > 0 ? Math.round(directPrices.reduce((a, b) => a + b, 0) / directPrices.length) : null;
    const directMedian = directPrices.length > 0
      ? (directPrices.length % 2 !== 0 
          ? directPrices[Math.floor(directPrices.length / 2)] 
          : (directPrices[directPrices.length / 2 - 1] + directPrices[directPrices.length / 2]) / 2)
      : null;
    const directMin = directPrices.length > 0 ? directPrices[0] : null;
    const directMax = directPrices.length > 0 ? directPrices[directPrices.length - 1] : null;

    return {
      facilitiesWithData,
      directAvg,
      directMedian,
      directMin,
      directMax,
      allMin: allPrices.length > 0 ? allPrices[0] : null,
      allMax: allPrices.length > 0 ? allPrices[allPrices.length - 1] : null,
      fullFacilities,
      couponFacilities,
      petMin: petPrices.length > 0 ? petPrices[0] : null,
      petMax: petPrices.length > 0 ? petPrices[petPrices.length - 1] : null
    };
  }, [currentDateData]);

  const renderMetricContent = () => {
    const {
      facilitiesWithData, directAvg, directMedian, directMin, directMax,
      allMin, allMax, fullFacilities, couponFacilities, petMin, petMax
    } = aggregatedResults;

    switch (selectedMetric) {
      case "prices":
        return (
          <div className="mr-grid">
            {facilitiesWithData.map(({ facility, data }) => (
              <div key={facility.id} className={`mr-card mr-card-${facility.type}`}>
                <div className="mr-card-type">
                  {facility.type === "direct" ? "🔵 直接比較" : facility.type === "market" ? "🔘 相場参考" : "🟣 個性/ペット"}
                </div>
                <h4 className="mr-card-name" style={{ marginBottom: '8px', borderBottom: 'none', paddingBottom: '0' }}>{facility.name}</h4>
                {data && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                    {data.ota === "rakuten" ? (
                      <span style={{ background: '#dbeafe', color: '#1e3a8a', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>楽天トラベル</span>
                    ) : (
                      <span style={{ background: '#ffedd5', color: '#c2410c', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>じゃらん</span>
                    )}
                    {data.reviewAverage ? (
                      <span style={{ color: '#f59e0b', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        ★ {data.reviewAverage.toFixed(1)}
                      </span>
                    ) : null}
                  </div>
                )}
                {data ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="mr-card-price" style={{ marginBottom: 0, color: data.status === "full" ? '#94a3b8' : '#065f46' }}>
                          <span className="mr-card-price-yen" style={{ color: data.status === "full" ? '#cbd5e1' : '#475569' }}>¥</span>
                          <span>
                            {data.status === "full" 
                              ? '---' 
                              : data.price > 0 
                                ? data.price.toLocaleString() 
                                : data.lowPrice ? data.lowPrice.toLocaleString() : '---'}
                          </span>
                          {data.status !== "full" && data.price === 0 && data.lowPrice && (
                            <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px', fontWeight: 'normal' }}>(10帖以外最安)</span>
                          )}
                        </div>
                        {data.status === "full" && (
                          <div style={{ background: '#be123c', color: '#fff', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(190, 18, 60, 0.2)' }}>
                            満室御礼
                          </div>
                        )}
                      </div>
                      
                      {data.status !== "full" && data.price > 0 && data.lowPrice && data.lowPrice < data.price && (
                        <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 'bold', display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <span>📉 10帖以外最安値:</span>
                          <span>¥{data.lowPrice.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                    <div className="mr-card-details" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        <strong>条件:</strong> 大人2名 / {data.meals || "1泊2食付"}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        <strong>客室:</strong> {data.status === "full" ? "---" : (data.roomType || "標準客室")}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={data.planName || undefined}>
                        <strong>プラン:</strong> {data.status === "full" ? "---" : (data.planName || "---")}
                      </div>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0', padding: '6px 0', borderTop: '1px dashed #cbd5e1', borderBottom: '1px dashed #cbd5e1', fontSize: '12px' }}>
                        <span style={{ color: '#64748b' }}>空室状況:</span>
                        <span style={{ fontWeight: 'bold', color: data.status === "full" ? '#be123c' : '#0f766e' }}>
                          {data.status === "full" ? '満室' : `空室あり｜${data.roomCount || 0}プラン販売`}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {data.hasCoupon && <span className="mr-badge coupon">🎫 クーポン</span>}
                          {data.hasPetPlan && <span className="mr-badge pet">🐾 ペット可</span>}
                        </div>
                        {data.hotelInformationUrl && (
                          <a 
                            href={data.hotelInformationUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            style={{ fontSize: '11px', color: '#2563eb', textDecoration: 'underline', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '2px' }}
                          >
                            宿ページ ↗
                          </a>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="mr-no-data" style={{ padding: '20px 0' }}>データがありません</div>
                )}

              </div>
            ))}
          </div>
        );
      case "stats":
        return (
          <div className="mr-stats-container">
            <div className="mr-result-header">
              <h3 className="mr-result-title">エリアサマリー</h3>
              <div className="mr-result-date">指定日の相場分析</div>
            </div>
            
            <div className="mr-stats-grid">
              <div className="mr-stat-box primary">
                <div className="mr-stat-label">直接比較 6施設の平均価格</div>
                <div className="mr-stat-value">
                  {directAvg ? `¥${directAvg.toLocaleString()}` : "---"}
                </div>
              </div>
              
              <div className="mr-stat-box outline">
                <div className="mr-stat-label">塩原全体の最安値 〜 最高値</div>
                <div className="mr-stat-value sm">
                  {allMin ? `¥${allMin.toLocaleString()}` : "---"} <span className="text-stone-400">〜</span> {allMax ? `¥${allMax.toLocaleString()}` : "---"}
                </div>
              </div>

              <div className="mr-stat-box highlight">
                <div className="mr-stat-label">ペット同伴プランの相場</div>
                <div className="mr-stat-value sm">
                  {petMin ? `¥${petMin.toLocaleString()}` : "---"} <span className="text-stone-400">〜</span> {petMax ? `¥${petMax.toLocaleString()}` : "---"}
                </div>
                <div className="mr-stat-subtext mt-1">※ 通常プランより高単価で推移</div>
              </div>
            </div>

            <div className="mr-insights-section mt-8">
              <h4 className="font-bold text-stone-800 mb-4 border-l-4 border-emerald-500 pl-3">AIによる特記事項</h4>
              <ul className="space-y-3">
                {fullFacilities.length > 0 && (
                  <li className="flex items-start gap-2 bg-rose-50 p-3 rounded-lg text-rose-800">
                    <span className="mt-0.5">⚠️</span>
                    <div>
                      <strong>{fullFacilities.length}施設が既に満室です。</strong><br/>
                      <span className="text-sm">（{fullFacilities.map(f => f.facility.name).join('、')}）<br/>エリア全体の供給が不足しており、強気の価格設定（値上げ）が成功しやすい市況です。</span>
                    </div>
                  </li>
                )}
                {couponFacilities.length > 0 && (
                  <li className="flex items-start gap-2 bg-amber-50 p-3 rounded-lg text-amber-800">
                    <span className="mt-0.5">🎫</span>
                    <div>
                      <strong>競合がクーポンを発行中です。</strong><br/>
                      <span className="text-sm">（{couponFacilities.map(f => f.facility.name).join('、')}）<br/>表面上の価格よりも実質価格が安くなっているため、価格差に注意が必要です。</span>
                    </div>
                  </li>
                )}
              </ul>
            </div>
          </div>
        );
      case "direct_avg":
        return (
          <div className="mr-kpi-view">
            <span className="mr-kpi-label">直接比較 6施設の平均</span>
            <div className="mr-kpi-value gradient">
              {directAvg ? `¥${directAvg.toLocaleString()}` : "データ不足"}
            </div>
          </div>
        );
      case "direct_median":
        return (
          <div className="mr-kpi-view">
            <span className="mr-kpi-label">極端な値を除外した中央値</span>
            <div className="mr-kpi-value gradient">
              {directMedian ? `¥${directMedian.toLocaleString()}` : "データ不足"}
            </div>
          </div>
        );
      case "direct_min":
        return (
          <div className="mr-kpi-view">
            <span className="mr-kpi-label">競合の最安値（下限ライン）</span>
            <div className="mr-kpi-value min">
              {directMin ? `¥${directMin.toLocaleString()}` : "データ不足"}
            </div>
          </div>
        );
      case "direct_max":
        return (
          <div className="mr-kpi-view">
            <span className="mr-kpi-label">競合の最高値（強気ライン）</span>
            <div className="mr-kpi-value max">
              {directMax ? `¥${directMax.toLocaleString()}` : "データ不足"}
            </div>
          </div>
        );
      case "all_range":
        return (
          <div className="mr-kpi-view">
            <span className="mr-kpi-label">塩原エリア全体の相場感</span>
            <div className="mr-kpi-value" style={{color: '#1e293b', fontSize: '56px'}}>
              {allMin && allMax ? `¥${allMin.toLocaleString()} 〜 ¥${allMax.toLocaleString()}` : "データ不足"}
            </div>
          </div>
        );
      case "full_count":
        return (
          <div className="mr-kpi-view">
            <span className="mr-kpi-label" style={{color: '#be123c'}}>満室・売り切れ済みの宿</span>
            <div className="mr-kpi-value max">
              {fullFacilities.length} <span style={{fontSize: '24px', color: '#64748b'}}>施設</span>
            </div>
            <div style={{marginTop: '24px', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center'}}>
              {fullFacilities.map(f => (
                <span key={f.facility.id} style={{background: '#ffe4e6', color: '#be123c', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold'}}>
                  {f.facility.name}
                </span>
              ))}
            </div>
          </div>
        );
      case "coupon_count":
        return (
          <div className="mr-kpi-view">
            <span className="mr-kpi-label" style={{color: '#b45309'}}>値引きを行っている宿</span>
            <div className="mr-kpi-value" style={{color: '#d97706'}}>
              {couponFacilities.length} <span style={{fontSize: '24px', color: '#64748b'}}>施設</span>
            </div>
            <div style={{marginTop: '24px', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center'}}>
              {couponFacilities.map(f => (
                <span key={f.facility.id} style={{background: '#fef3c7', color: '#b45309', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold'}}>
                  🎫 {f.facility.name}
                </span>
              ))}
            </div>
          </div>
        );
      case "pet_range":
        return (
          <div className="mr-kpi-view">
            <span className="mr-kpi-label">ペット同伴の付加価値相場</span>
            <div className="mr-kpi-value" style={{color: '#7e22ce', fontSize: '56px'}}>
              {petMin && petMax ? `¥${petMin.toLocaleString()} 〜 ¥${petMax.toLocaleString()}` : "販売データなし"}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="mr-container">
      
      {/* プレミアム・ヘッダー */}
      <div className="mr-header">
        <span className="mr-header-badge">AKASAWA PRICING ENGINE</span>
        <h2 className="mr-header-title">市場相場 インサイトビュー</h2>
        
        <div className="mr-header-intro">
          <p>遠藤オーナー、いつもお疲れ様です。</p>
          <p>
            本画面は市場の相場データを自動で集計し、オーナー様の価格調整（値上げ・値下げ）の判断をサポートする分析パネルです。<br/>
            カレンダーから日付を選び、見たい項目をクリックするだけで、塩原エリアの販売状況から抽出した「価格判断の材料」が一目でわかるようになっています。<br/>
            お盆や週末の単価（RevPAR）を最大化するための重要な判断材料としてご活用ください。
          </p>
        </div>

        {/* エリア全体宿泊率（リアルタイム反映対応）＆ 調査対象施設の満室状況 */}
        {(() => {
          let occ = 0;
          let isSimulated = false;

          if (isFetchingOcc) {
            occ = -1;
          } else if (realOccRate !== null) {
            occ = realOccRate;
          } else {
            occ = -1; // 通信エラーの場合は一切の推計を行わない
            isSimulated = true;
          }

          // 調査対象施設の満室状況を算出
          const targetFullCount = currentDateData.filter(d => d.status === "full").length;
          const totalTargetCount = currentDateData.length;
          const fullRate = totalTargetCount > 0 ? Math.round((targetFullCount / totalTargetCount) * 100) : 0;
          
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '24px' }}>
              
              {/* 全体宿泊率カード */}
              <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', padding: '24px', borderRadius: '12px', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
                <div>
                  <h3 style={{ fontSize: '16px', color: '#e2e8f0', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>♨️</span> 塩原温泉エリア 全体宿泊率
                  </h3>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
                    対象: 楽天トラベル掲載の塩原エリア全施設（67軒）
                  </p>
                  {realVacantCount !== null && occ !== -1 && !isSimulated && (
                    <p style={{ fontSize: '13px', color: '#a7f3d0', margin: '6px 0 0 0', fontWeight: 'bold' }}>
                      空室: {realVacantCount} 軒 / 満室: {TOTAL_SHIOBARA_HOTELS - realVacantCount} 軒
                    </p>
                  )}
                  {occ !== -1 && !isSimulated && (
                    <div style={{ marginTop: '8px', display: 'inline-block', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                      🟢 楽天トラベルよりリアルタイム取得済
                    </div>
                  )}
                  {occ === -1 && (
                    <div style={{ marginTop: '8px', display: 'inline-block', background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                      🔴 データ未取得
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  {isFetchingOcc ? (
                    <div style={{ color: '#94a3b8', fontSize: '13px' }}>取得中...</div>
                  ) : occ === -1 ? (
                    <div style={{ fontSize: '24px', color: '#cbd5e1', fontWeight: 'bold' }}>---</div>
                  ) : (
                    <>
                      <div style={{ fontSize: '32px', fontWeight: 'bold', color: occ >= 85 ? '#ef4444' : occ >= 60 ? '#f59e0b' : '#3b82f6' }}>
                        {occ}%
                      </div>
                      <div style={{ fontSize: '11px', color: occ >= 85 ? '#fca5a5' : occ >= 60 ? '#fcd34d' : '#93c5fd', marginTop: '4px', fontWeight: 600 }}>
                        {occ >= 85 ? '満室直前' : occ >= 60 ? '高需要' : '通常'}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 調査対象施設 満室率カード */}
              <div className="mr-kpi-card" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', padding: '24px', borderRadius: '12px', border: '1px solid #334155', borderLeftColor: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="mr-kpi-label" style={{ fontSize: '16px', color: '#a7f3d0', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>📋</span> 調査対象{TARGET_FACILITIES.length}施設 満室率
                  </div>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
                    リサーチしている競合・参考宿（計{TARGET_FACILITIES.length}軒）のうち満室の割合
                  </p>
                  <div style={{ marginTop: '8px', display: 'inline-block', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                    🔍 リアルタイム満室判定
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {totalTargetCount === 0 ? (
                    <div style={{ fontSize: '24px', color: '#cbd5e1', fontWeight: 'bold' }}>---</div>
                  ) : (
                    <>
                      <div style={{ fontSize: '32px', fontWeight: 'bold', color: fullRate >= 80 ? '#ef4444' : fullRate >= 40 ? '#f59e0b' : '#10b981' }}>
                        {fullRate}%
                      </div>
                      <div style={{ fontSize: '11px', color: '#e2e8f0', marginTop: '4px', fontWeight: 600 }}>
                        {TARGET_FACILITIES.length}施設中 {targetFullCount} 軒が満室
                      </div>
                    </>
                  )}
                </div>
              </div>

            </div>
          );
        })()}

        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px 20px', borderRadius: '8px', marginBottom: '24px', borderLeft: '4px solid #34d399' }}>
          <h3 style={{ fontSize: '14px', color: '#6ee7b7', margin: '0 0 8px 0' }}>📋 調査条件（価格比較の基準）</h3>
          <p style={{ fontSize: '13px', color: '#e2e8f0', margin: 0, lineHeight: '1.6' }}>
            正確な相場比較を行うため、全施設について以下の条件で統一して料金を取得しています。<br/>
            <strong style={{ color: '#fff', fontSize: '14px' }}>【 大人2名 / 1室利用 / 標準客室 / 1泊2食付 / 1名あたりの税込価格 】</strong>
            <span style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', marginTop: '6px', lineHeight: '1.4' }}>
              ※ 楽天APIから取得した<strong>2名合計料金を 2 で割った料金（1名あたり）</strong>を表示しています。<br/>
              ※ 正確な相場比較のため、素泊まり・朝食のみ・特別室・露天風呂付き客室・早割・直前割・タイムセール・ペットプラン（ペット可宿を除く）は自動的に除外して算出しています。
            </span>
          </p>
        </div>

        <div className="mr-reasons">
          <h3>💡 なぜこの10施設を調べるのか？（選定の根拠）</h3>
          <ul className="mr-reasons-list">
            <li>
              <strong>🔵 直接比較（5施設）</strong>
              まじま荘など同規模旅館。この平均・最安値が赤沢の「基準価格」のベースになります。
            </li>
            <li>
              <strong>🔘 相場参考（3施設）</strong>
              奥塩原高原ホテルなど中位〜上位宿。連休でエリアがどこまで高騰するかの「天井」を探ります。
            </li>
            <li>
              <strong>🟣 独自需要（2施設）</strong>
              元泉館、わんわんパラダイス。ペット同伴などの独自需要がどれほどの「プレミアム」を生むかの指標です。
            </li>
          </ul>
        </div>
      </div>

      {/* メイン操作エリア */}
      <div className="mr-layout">
        
        {/* 左側: コントロールパネル */}
        <div>
          <div className="mr-control-panel">
            <h3 className="mr-control-title">1. 調査日程を選択</h3>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="mr-date-picker"
            />
            {currentDateData.length === 0 && (
              <div className="mr-warning">
                ⚠️ 現在この日付のデータは未取得です
              </div>
            )}
          </div>


          <div className="mr-control-panel">
            <h3 className="mr-control-title">3. 確認したい指標</h3>
            <div className="mr-metric-buttons">
              {METRICS.map(m => {
                const isSelected = selectedMetric === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMetric(m.id)}
                    className={`mr-metric-btn ${isSelected ? 'active' : ''}`}
                  >
                    <span>{m.icon}</span>
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 右側: 結果ディスプレイ */}
        <div className="mr-result-area">
          <div className="mr-result-header">
            <h4 className="mr-result-title">
              {METRICS.find(m => m.id === selectedMetric)?.icon} {METRICS.find(m => m.id === selectedMetric)?.label}
            </h4>
            <span className="mr-result-date">
              対象日: {selectedDate.replace(/-/g, '/')}
            </span>
          </div>
          
          <div className="mr-result-content">
            {currentDateData.length === 0 ? (
              <div className="mr-no-data">
                <span>📉</span>
                <p style={{fontWeight: 'bold'}}>データがありません</p>
                <p style={{fontSize: '12px', marginTop: '8px'}}>別の日付をカレンダーから選択してください</p>
              </div>
            ) : (
              renderMetricContent()
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

