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
        <h2 className="text-xl font-bold mb-4 text-gray-800">市場調査データ入力（手動モード）</h2>
        <p className="text-sm text-gray-600 mb-6">
          仕様書に基づき、指定された対象日の価格と空室状況をOTAから転記します。<br/>
          ※9月の正式版リリース以降は、この入力作業はシステムによって自動化されます。
        </p>

        <div className="flex space-x-4 mb-6 bg-gray-50 p-4 rounded-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">調査対象日</label>
            <select 
              value={selectedDate} 
              onChange={e => setSelectedDate(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {TARGET_DATES.map(d => (
                <option key={d.date} value={d.date}>{d.date} - {d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">調査OTA</label>
            <select 
              value={selectedOta} 
              onChange={e => setSelectedOta(e.target.value as any)}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="rakuten">楽天トラベル</option>
              <option value="jalan">じゃらんnet</option>
            </select>
          </div>
          <div className="flex items-end">
            <button 
              onClick={handleSave}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded text-sm transition-colors"
            >
              この日のデータを保存
            </button>
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
