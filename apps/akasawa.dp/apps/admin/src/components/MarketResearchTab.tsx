import React, { useState, useEffect } from "react";
import { MarketResearchData } from "../types";

// 仕様書に基づく調査対象施設
const TARGET_FACILITIES = [
  { id: "majimaso", name: "旅館まじま荘", type: "direct" },
  { id: "yamaguciya", name: "山口屋旅館", type: "direct" },
  { id: "kamiaizuya", name: "上会津屋", type: "direct" },
  { id: "nuriya", name: "心づくしの宿 ぬりや", type: "direct" },
  { id: "tokiwa", name: "常盤ホテル", type: "direct" },
  { id: "okukogen", name: "奥塩原高原ホテル", type: "market" },
  { id: "shimofujiya", name: "やまの宿 下藤屋", type: "market" },
  { id: "shofuro", name: "松楓楼 松屋", type: "market" },
  { id: "gensenkan", name: "秘湯の宿 元泉館", type: "pet" },
  { id: "wanwan", name: "わんわんパラダイス", type: "pet" }
];

// 仕様書に基づく調査対象日 (初期設定)
const TARGET_DATES = [
  { date: "2026-07-22", label: "通常（水）" },
  { date: "2026-07-25", label: "通常（土）" },
  { date: "2026-07-27", label: "イベント（前夜祭）" },
  { date: "2026-08-10", label: "イベント（花火大会）" },
  { date: "2026-08-13", label: "繁忙期（お盆）" },
  { date: "2026-08-22", label: "通常（土）" }
];

interface Props {
  researchData: MarketResearchData[];
  onSaveData: (data: MarketResearchData[]) => void;
}

export default function MarketResearchTab({ researchData, onSaveData }: Props) {
  const [selectedDate, setSelectedDate] = useState<string>(TARGET_DATES[0].date);
  const [selectedOta, setSelectedOta] = useState<"rakuten" | "jalan">("rakuten");
  const [formData, setFormData] = useState<Record<string, Partial<MarketResearchData>>>({});

  // 選択日とOTAが切り替わったときに、既存のデータをフォームにセットする
  useEffect(() => {
    const currentData: Record<string, Partial<MarketResearchData>> = {};
    TARGET_FACILITIES.forEach(facility => {
      const existing = researchData.find(d => d.dateKey === selectedDate && d.ota === selectedOta && d.hotelId === facility.id);
      if (existing) {
        currentData[facility.id] = { ...existing };
      } else {
        currentData[facility.id] = {
          dateKey: selectedDate,
          ota: selectedOta,
          hotelId: facility.id,
          status: "available",
          price: 0,
          planName: "",
          roomType: "",
          meals: "1泊2食",
          hasCoupon: false,
          hasCampaign: false,
          hasPetPlan: false,
          features: []
        };
      }
    });
    setFormData(currentData);
  }, [selectedDate, selectedOta, researchData]);

  const handleChange = (hotelId: string, field: keyof MarketResearchData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [hotelId]: {
        ...prev[hotelId],
        [field]: value
      }
    }));
  };

  const handleSave = () => {
    const newDataList: MarketResearchData[] = [];
    Object.keys(formData).forEach(hotelId => {
      const data = formData[hotelId];
      if (data && data.price && data.price > 0) {
        newDataList.push({
          id: `${selectedDate}-${selectedOta}-${hotelId}`,
          dateKey: data.dateKey!,
          ota: data.ota!,
          hotelId: data.hotelId!,
          status: data.status! as any,
          price: Number(data.price),
          planName: data.planName || "",
          roomType: data.roomType || "",
          meals: data.meals || "1泊2食",
          hasCoupon: Boolean(data.hasCoupon),
          hasCampaign: Boolean(data.hasCampaign),
          hasPetPlan: Boolean(data.hasPetPlan),
          features: data.features || [],
          updatedAt: new Date().toISOString()
        });
      }
    });
    onSaveData(newDataList);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold mb-4 text-gray-800">市場調査データ入力（2026夏・簡易版）</h2>
        
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
          <p className="text-sm text-blue-800 font-medium mb-2">
            遠藤オーナー、いつもお疲れ様です。
          </p>
          <p className="text-sm text-blue-800 leading-relaxed">
            ここは9月に完成する「自動価格調整システム」へ繋ぐための、この夏限定のデータ蓄積画面です。<br/>
            日々の業務でお忙しい中恐縮ですが、毎朝以下の「調査対象日」から特定の日付を選び、楽天やじゃらんを見ながら10施設の販売状況（空室・価格）をご入力ください。<br/>
            ここで集めたデータが、お盆や週末の単価（RevPAR）を最大化するための重要な判断材料となります。<br/>
            <span className="font-bold text-blue-900">（※9月以降は、この面倒な入力作業はすべてAIプログラムが自動で代行しますのでご安心ください！）</span>
          </p>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6">
          <h3 className="text-sm font-bold text-gray-800 mb-2">💡 なぜこの10施設を調べるのか？（選定の根拠）</h3>
          <ul className="text-xs text-gray-700 space-y-2 list-disc pl-5">
            <li>
              <strong className="text-blue-700">直接比較（5施設）</strong>：旅館まじま荘、山口屋旅館など。赤沢温泉旅館と同じ「小〜中規模」の旅館です。この5施設の平均価格や最安値が、赤沢の基本となる<strong className="text-red-600">「基準価格」</strong>のベースになります。
            </li>
            <li>
              <strong className="text-gray-700">相場参考（3施設）</strong>：奥塩原高原ホテルなど。塩原温泉の「中〜上位価格帯」の宿です。連休やお盆で塩原エリア全体がどこまで高騰しているか（強気に攻められるか）の<strong className="text-red-600">「天井」</strong>を見るための指標です。
            </li>
            <li>
              <strong className="text-purple-700">個性/ペット需要（2施設）</strong>：秘湯の宿 元泉館、わんわんパラダイス。赤沢の強みである「ペット同伴」「猫宿」という独自需要が活きる日に、一般旅館よりどれだけ高いプレミアム価格（付加価値）で売れているかの<strong className="text-red-600">「強気ライン」</strong>を探るための参考です。
            </li>
          </ul>
        </div>

        <div className="mb-6 bg-white p-4 rounded-md border border-gray-100 shadow-sm">
          <div className="flex flex-wrap items-center justify-between mb-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">📅 調査対象日をカレンダーから選択</label>
              <p className="text-xs text-gray-500">色が付いている日が、仕様書で指定された「必ず調査すべき代表日」です。</p>
            </div>
            <div className="flex items-center space-x-4 bg-gray-50 p-2 rounded">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">調査OTA</label>
                <select 
                  value={selectedOta} 
                  onChange={e => setSelectedOta(e.target.value as any)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="rakuten">楽天トラベル</option>
                  <option value="jalan">じゃらんnet</option>
                </select>
              </div>
              <div className="flex items-end">
                <button 
                  onClick={handleSave}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-1 px-4 rounded text-sm transition-colors mt-5"
                >
                  この日のデータを保存
                </button>
              </div>
            </div>
          </div>

          <div className="flex space-x-8 justify-center border-t border-gray-100 pt-4">
            {[
              { year: 2026, month: 7, days: 31, startDay: 3 }, // 水曜始まり
              { year: 2026, month: 8, days: 31, startDay: 6 }, // 土曜始まり
            ].map(m => {
              const blanks = Array(m.startDay).fill(null);
              const dates = Array.from({length: m.days}, (_, i) => {
                  const d = i + 1;
                  const mm = String(m.month).padStart(2, '0');
                  const dd = String(d).padStart(2, '0');
                  return `${m.year}-${mm}-${dd}`;
              });

              return (
                <div key={m.month} className="w-64">
                  <h4 className="text-center font-bold text-gray-700 mb-2">{m.month}月</h4>
                  <div className="grid grid-cols-7 gap-1 text-center text-xs">
                    <div className="text-red-500 font-bold">日</div><div className="font-bold">月</div><div className="font-bold">火</div><div className="font-bold">水</div><div className="font-bold">木</div><div className="font-bold">金</div><div className="text-blue-500 font-bold">土</div>
                    {blanks.map((_, i) => <div key={`b-${i}`}></div>)}
                    {dates.map(date => {
                      const target = TARGET_DATES.find(t => t.date === date);
                      const isTarget = !!target;
                      const isSelected = selectedDate === date;
                      
                      let btnClass = "p-1 rounded cursor-pointer transition-all border border-transparent ";
                      if (isSelected) {
                        btnClass += "bg-amber-600 text-white font-bold shadow-md transform scale-110 border-amber-700";
                      } else if (isTarget) {
                        btnClass += "bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200 font-bold";
                      } else {
                        btnClass += "text-gray-600 hover:bg-gray-100 border-gray-100";
                      }

                      return (
                        <div 
                          key={date} 
                          onClick={() => setSelectedDate(date)}
                          className={btnClass}
                          title={target ? target.label : ""}
                        >
                          {parseInt(date.split('-')[2])}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-4 text-center">
            {TARGET_DATES.find(t => t.date === selectedDate) ? (
              <span className="inline-block bg-amber-100 text-amber-900 px-3 py-1 rounded-full text-sm font-bold border border-amber-300 shadow-sm">
                📌 現在選択中: {selectedDate} 【{TARGET_DATES.find(t => t.date === selectedDate)?.label}】
              </span>
            ) : (
              <span className="inline-block bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium border border-gray-300">
                選択中: {selectedDate} (通常日)
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-gray-100 text-gray-700 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">施設分類</th>
                <th className="px-4 py-3">施設名</th>
                <th className="px-4 py-3">販売状況</th>
                <th className="px-4 py-3">価格(2名1室)</th>
                <th className="px-4 py-3">クーポン</th>
                <th className="px-4 py-3">ペット可</th>
              </tr>
            </thead>
            <tbody>
              {TARGET_FACILITIES.map(facility => {
                const data = formData[facility.id] || {};
                const typeLabel = facility.type === "direct" ? "直接比較" : facility.type === "market" ? "相場参考" : "個性/ペット";
                const typeColor = facility.type === "direct" ? "bg-blue-100 text-blue-800" : facility.type === "market" ? "bg-gray-100 text-gray-800" : "bg-purple-100 text-purple-800";

                return (
                  <tr key={facility.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${typeColor}`}>
                        {typeLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{facility.name}</td>
                    <td className="px-4 py-3">
                      <select 
                        value={data.status || "available"} 
                        onChange={e => handleChange(facility.id, "status", e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        <option value="available">販売中</option>
                        <option value="full">満室</option>
                        <option value="no_sales">販売なし</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <span className="mr-1">¥</span>
                        <input 
                          type="number" 
                          value={data.price || ""} 
                          onChange={e => handleChange(facility.id, "price", e.target.value)}
                          placeholder="-"
                          className="border border-gray-300 rounded px-2 py-1 text-sm w-24 text-right focus:outline-none focus:ring-1 focus:ring-amber-500"
                          disabled={data.status !== "available"}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input 
                        type="checkbox" 
                        checked={data.hasCoupon || false}
                        onChange={e => handleChange(facility.id, "hasCoupon", e.target.checked)}
                        className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input 
                        type="checkbox" 
                        checked={data.hasPetPlan || false}
                        onChange={e => handleChange(facility.id, "hasPetPlan", e.target.checked)}
                        className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
