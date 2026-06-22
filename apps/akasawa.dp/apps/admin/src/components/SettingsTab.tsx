import React, { useState, useEffect } from "react";
import { PricingRules, RoomType } from "../types";

interface SettingsTabProps {
  roomTypes: RoomType[];
  pricingRules: PricingRules;
  onUpdateRoomPriceLimits: (
    roomId: string,
    minPrice: number,
    maxPrice: number,
    baseWeekday: number,
    baseWeekend: number
  ) => void;
  onSaveRules: (newRules: PricingRules) => void;
}

interface EventItem {
  id: string;
  name: string;
  factor: number;
}

export default function SettingsTab({
  roomTypes,
  pricingRules,
  onUpdateRoomPriceLimits,
  onSaveRules
}: SettingsTabProps) {
  // 曜日係数ステート
  const [weekdayFactors, setWeekdayFactors] = useState<Record<string, number>>({});
  // 稼働率連動価格設定ステート
  const [weakDiscount, setWeakDiscount] = useState(0);
  const [strongMarkup, setStrongMarkup] = useState(0);
  // 変更幅制限ステート
  const [maxChangeUp, setMaxChangeUp] = useState(5000);
  const [maxChangeDown, setMaxChangeDown] = useState(3000);

  // イベント特日設定（モック用）
  const [events, setEvents] = useState<EventItem[]>([
    { id: "e1", name: "紅葉シーズン (11月)", factor: 0.15 },
    { id: "e2", name: "ねこ温泉WEEK (2月)", factor: 0.1 },
    { id: "e3", name: "GW・お盆休み", factor: 0.25 }
  ]);

  // 初期値の同期
  useEffect(() => {
    if (pricingRules) {
      setWeekdayFactors(pricingRules.weekdayFactors || {});
      setWeakDiscount(Math.round((pricingRules.weakWeekdayDiscountMaxPct || 0) * 100));
      setStrongMarkup(Math.round((pricingRules.strongDemandMarkupMaxPct || 0) * 100));
      setMaxChangeUp(pricingRules.maxChangeUp || 5000);
      setMaxChangeDown(pricingRules.maxChangeDown || 3000);
    }
  }, [pricingRules]);

  // 曜日係数の編集
  const handleWeekdayFactorChange = (dayKey: string, valStr: string) => {
    const val = parseFloat(valStr) || 0;
    setWeekdayFactors((prev) => ({
      ...prev,
      [dayKey]: val / 100 // %表記から少数へ変換 (例: 10% -> 0.1)
    }));
  };

  // イベント追加
  const handleAddEvent = () => {
    const name = prompt("イベント名を入力してください (例: 年末年始特日)");
    if (!name) return;
    const factorPctInput = prompt("需要補正率を入力してください (%)", "15");
    if (factorPctInput === null) return;
    const factorPct = parseFloat(factorPctInput) || 0;
    const newEvent: EventItem = {
      id: `e-${Date.now()}`,
      name,
      factor: factorPct / 100
    };
    setEvents((prev) => [...prev, newEvent]);
  };

  // イベント削除
  const handleDeleteEvent = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  // 設定の保存
  const handleSaveAllRules = () => {
    const updatedRules: PricingRules = {
      ...pricingRules,
      weekdayFactors,
      weakWeekdayDiscountMaxPct: weakDiscount / 100,
      strongDemandMarkupMaxPct: strongMarkup / 100,
      maxChangeUp,
      maxChangeDown
    };
    onSaveRules(updatedRules);
    alert("ルール設定を保存し、自動価格を再計算しました。");
  };

  return (
    <section className="page active" id="page-settings">
      <div className="settings-grid">
        {/* 部屋タイプ別 基準価格・上下限設定 */}
        <div className="card">
          <div className="card-header">
            <h2><i className="fas fa-tag"></i> 部屋タイプ別 基準価格・上下限設定</h2>
          </div>
          <div className="card-body">
            <div className="table-container">
              <table className="data-table settings-table">
                <thead>
                  <tr>
                    <th>部屋タイプ</th>
                    <th>平日基準</th>
                    <th>休前日基準</th>
                    <th>最低下限</th>
                    <th>最高上限</th>
                    <th>客室情報</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {roomTypes.map((room) => {
                    const rowKey = `${room.id}-${room.minPrice || 0}-${room.maxPrice || 0}-${room.baseRateWeekday}-${room.baseRateWeekend}`;
                    return (
                      <tr key={rowKey}>
                        <td style={{ fontWeight: 700 }}>{room.name}</td>
                        <td>
                          <input
                            type="number"
                            id={`weekday-${room.id}`}
                            defaultValue={room.baseRateWeekday}
                            step="500"
                            style={{ width: "90px", padding: "6px", borderRadius: "6px", border: "1px solid var(--border)" }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            id={`weekend-${room.id}`}
                            defaultValue={room.baseRateWeekend}
                            step="500"
                            style={{ width: "90px", padding: "6px", borderRadius: "6px", border: "1px solid var(--border)" }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            id={`min-${room.id}`}
                            defaultValue={room.minPrice || 0}
                            step="1000"
                            style={{ width: "90px", padding: "6px", borderRadius: "6px", border: "1px solid var(--border)" }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            id={`max-${room.id}`}
                            defaultValue={room.maxPrice || 0}
                            step="1000"
                            style={{ width: "90px", padding: "6px", borderRadius: "6px", border: "1px solid var(--border)" }}
                          />
                        </td>
                        <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                          在庫 {room.inventory} / 定員 {room.capacity}名
                        </td>
                        <td>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              const weekday = parseInt((document.getElementById(`weekday-${room.id}`) as HTMLInputElement).value) || 0;
                              const weekend = parseInt((document.getElementById(`weekend-${room.id}`) as HTMLInputElement).value) || 0;
                              const min = parseInt((document.getElementById(`min-${room.id}`) as HTMLInputElement).value) || 0;
                              const max = parseInt((document.getElementById(`max-${room.id}`) as HTMLInputElement).value) || 0;
                              onUpdateRoomPriceLimits(room.id, min, max, weekday, weekend);
                              alert(`${room.name.replace(/【禁煙】/, "")} の価格設定を更新しました`);
                            }}
                          >
                            保存
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 需要係数・ルール設定 */}
        <div className="card">
          <div className="card-header">
            <h2><i className="fas fa-cogs"></i> 需要係数・ルール設定</h2>
          </div>
          <div className="card-body">
            <div className="settings-form">
              {/* 曜日別係数 */}
              <div className="settings-section">
                <h3><i className="fas fa-calendar-week"></i> 曜日別需要係数 (%)</h3>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
                  曜日に応じた基本料金の補正比率を設定します（例: 土曜日は +10%、火曜日は -5% 等）。
                </p>
                <div className="coeff-grid">
                  {[
                    { key: "0", label: "日曜日" },
                    { key: "1", label: "月曜日" },
                    { key: "2", label: "火曜日" },
                    { key: "3", label: "水曜日" },
                    { key: "4", label: "木曜日" },
                    { key: "5", label: "金曜日" },
                    { key: "6", label: "土曜日" }
                  ].map((day) => {
                    const factorVal = Math.round((weekdayFactors[day.key] || 0) * 100);
                    return (
                      <div key={day.key} className="coeff-card">
                        <span className="coeff-day" style={{ color: day.key === "0" ? "var(--danger)" : day.key === "6" ? "#2563eb" : "inherit" }}>
                          {day.label}
                        </span>
                        <input
                          type="number"
                          value={factorVal}
                          onChange={(e) => handleWeekdayFactorChange(day.key, e.target.value)}
                          className="coeff-input"
                          step="1"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 稼働率連動価格設定 */}
              <div className="settings-section">
                <h3><i className="fas fa-percentage"></i> 稼働率連動価格補正</h3>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
                  需要（予測稼働率）に合わせた最大値上げ・最大割引制限を設定します。
                </p>
                <div className="range-setting">
                  <div className="range-row">
                    <label>高需要時の最大値上げ比率（稼働率高）</label>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <input
                        type="number"
                        value={strongMarkup}
                        onChange={(e) => setStrongMarkup(parseInt(e.target.value) || 0)}
                      />
                      <span>% アップ</span>
                    </div>
                  </div>
                  <div className="range-row" style={{ marginTop: "8px" }}>
                    <label>低稼働時の最大割引比率（稼働率低）</label>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <input
                        type="number"
                        value={weakDiscount}
                        onChange={(e) => setWeakDiscount(parseInt(e.target.value) || 0)}
                      />
                      <span>% 割引</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* イベント・特日設定 */}
              <div className="settings-section">
                <h3><i className="fas fa-star"></i> イベント・シーズン特日設定</h3>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
                  シーズンや特有イベントに伴う固定の追加係数を設定します。
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
                  {events.map((e) => (
                    <div
                      key={e.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        background: "var(--bg-app)",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        fontSize: "13px"
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>{e.name}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ fontWeight: 600, color: "var(--primary)" }}>+{Math.round(e.factor * 100)}%</span>
                        <button
                          className="btn btn-danger btn-sm"
                          style={{ padding: "4px 8px", fontSize: "10px" }}
                          onClick={() => handleDeleteEvent(e.id)}
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="btn btn-outline btn-sm" onClick={handleAddEvent}>
                  <i className="fas fa-plus"></i> 特日の追加
                </button>
              </div>

              {/* 変更幅制限 */}
              <div className="settings-section">
                <h3><i className="fas fa-shield-alt"></i> 1回の価格変更幅の制限 (安全装置)</h3>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
                  AI提案が急激な値上げ/値下げを行わないための安全リミッターです。
                </p>
                <div className="range-setting">
                  <div className="range-row">
                    <label>1回の変更で上げられる最大額</label>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <input
                        type="number"
                        value={maxChangeUp}
                        onChange={(e) => setMaxChangeUp(parseInt(e.target.value) || 0)}
                        step="500"
                      />
                      <span>円</span>
                    </div>
                  </div>
                  <div className="range-row" style={{ marginTop: "8px" }}>
                    <label>1回の変更で下げられる最大額</label>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <input
                        type="number"
                        value={maxChangeDown}
                        onChange={(e) => setMaxChangeDown(parseInt(e.target.value) || 0)}
                        step="500"
                      />
                      <span>円</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "24px", textAlign: "right" }}>
                <button className="btn btn-primary" onClick={handleSaveAllRules}>
                  <i className="fas fa-save"></i> 設定を保存して価格を再計算
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
