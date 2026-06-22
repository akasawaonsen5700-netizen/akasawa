import React, { useState, useMemo } from "react";
import { CalendarPrice, Proposal, RoomType } from "../types";

interface CalendarTabProps {
  roomTypes: RoomType[];
  prices: CalendarPrice[];
  proposals: Proposal[];
  onUpdateCalendarPrice: (dateKey: string, roomTypeId: string, newPrice: number) => void;
  onApproveProposal: (proposalId: string) => void;
}

export default function CalendarTab({
  roomTypes,
  prices,
  proposals,
  onUpdateCalendarPrice,
  onApproveProposal
}: CalendarTabProps) {
  // 現在表示している年月（カレンダー基準月）
  const [currentYearMonth, setCurrentYearMonth] = useState(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  });

  // 詳細表示中の日付
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // 月移動
  const handlePrevMonth = () => {
    setCurrentYearMonth((prev) => {
      let m = prev.month - 1;
      let y = prev.year;
      if (m < 0) {
        m = 11;
        y -= 1;
      }
      return { year: y, month: m };
    });
  };

  const handleNextMonth = () => {
    setCurrentYearMonth((prev) => {
      let m = prev.month + 1;
      let y = prev.year;
      if (m > 11) {
        m = 0;
        y += 1;
      }
      return { year: y, month: m };
    });
  };

  // 表示対象の月の日付配列を生成
  const calendarCells = useMemo(() => {
    const { year, month } = currentYearMonth;
    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 (日) 〜 6 (土)
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();

    const cells = [];

    // 先頭の空セル（前月の日付分）
    for (let i = 0; i < startDayOfWeek; i++) {
      cells.push({ isOtherMonth: true, date: null, dateKey: "" });
    }

    // 今月の日付セル
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month, day);
      // ローカル日付キー
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      const dateKey = `${yyyy}-${mm}-${dd}`;

      cells.push({
        isOtherMonth: false,
        date,
        dateKey
      });
    }

    return cells;
  }, [currentYearMonth]);

  const monthLabel = `${currentYearMonth.year}年 ${currentYearMonth.month + 1}月`;

  // 選択日の詳細情報
  const selectedDayDetails = useMemo(() => {
    if (!selectedDate) return null;
    const dayPrices = prices.filter((p) => p.dateKey === selectedDate);
    const dayProposals = proposals.filter((p) => p.dateKey === selectedDate);
    return {
      dateKey: selectedDate,
      prices: dayPrices,
      proposals: dayProposals
    };
  }, [selectedDate, prices, proposals]);

  return (
    <section className="page active" id="page-calendar">
      <div className="card">
        <div className="card-header">
          <h2><i className="fas fa-calendar-alt"></i> 変動価格カレンダー</h2>
          <div className="filter-bar" style={{ gap: "8px" }}>
            <button className="btn btn-outline btn-sm" onClick={handlePrevMonth}>
              <i className="fas fa-chevron-left"></i>
            </button>
            <span style={{ fontSize: "16px", fontWeight: "bold", minWidth: "100px", textAlign: "center" }}>
              {monthLabel}
            </span>
            <button className="btn btn-outline btn-sm" onClick={handleNextMonth}>
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>
        <div className="card-body">
          {/* 凡例 */}
          <div className="cal-legend" style={{ marginBottom: "16px" }}>
            <span className="legend-item"><span className="legend-dot approved"></span>承認済み価格</span>
            <span className="legend-item"><span className="legend-dot pending"></span>提案中（未承認）</span>
            <span className="legend-item"><span className="legend-dot high-demand"></span>高需要 (稼働70%+)</span>
            <span className="legend-item"><span className="legend-dot low-demand"></span>低稼働 (稼働50%未満)</span>
          </div>

          <div className="price-calendar">
            {["日", "月", "火", "水", "木", "金", "土"].map((dayName) => (
              <div key={dayName} className="cal-day-header">
                {dayName}
              </div>
            ))}

            {calendarCells.map((cell, index) => {
              if (cell.isOtherMonth || !cell.date) {
                return <div key={`empty-${index}`} className="cal-cell other-month"></div>;
              }

              // その日の価格データ
              const dayPrices = prices.filter((p) => p.dateKey === cell.dateKey);
              const dayProposals = proposals.filter((p) => p.dateKey === cell.dateKey);

              // 代表稼働率
              const avgOcc =
                dayPrices.length > 0
                  ? dayPrices.reduce((sum, p) => sum + p.occupancyRate, 0) / dayPrices.length
                  : 0.5;

              let occClass = "mid";
              let occLabel = "通常";
              if (avgOcc >= 0.7) {
                occClass = "high";
                occLabel = `高稼働 ${Math.round(avgOcc * 100)}%`;
              } else if (avgOcc < 0.5) {
                occClass = "low";
                occLabel = `低稼働 ${Math.round(avgOcc * 100)}%`;
              } else {
                occLabel = `${Math.round(avgOcc * 100)}%`;
              }

              return (
                <div
                  key={cell.dateKey}
                  className={`cal-cell ${selectedDate === cell.dateKey ? "active" : ""}`}
                  onClick={() => setSelectedDate(cell.dateKey)}
                  style={{
                    borderColor: selectedDate === cell.dateKey ? "var(--primary)" : "var(--border)",
                    boxShadow: selectedDate === cell.dateKey ? "var(--shadow-md)" : "none"
                  }}
                >
                  <div className="cal-cell-header">
                    <span className="cal-date-num" style={{ color: cell.date.getDay() === 0 ? "var(--danger)" : cell.date.getDay() === 6 ? "#2563eb" : "inherit" }}>
                      {cell.date.getDate()}
                    </span>
                    <span className={`cal-occ ${occClass}`} style={{ fontSize: "9px" }}>
                      {occLabel}
                    </span>
                  </div>

                  <div className="cal-room-prices">
                    {dayPrices.slice(0, 3).map((dp) => {
                      const room = roomTypes.find((r) => r.id === dp.roomTypeId);
                      const prop = dayProposals.find((p) => p.roomTypeId === dp.roomTypeId);
                      const isPending = prop && prop.status === "pending";

                      return (
                        <div
                          key={dp.id}
                          className={`cal-room-price-item ${isPending ? "pending" : "approved"}`}
                        >
                          <span className="cal-room-name">
                            {room?.name.replace(/【禁煙】/, "").slice(0, 5)}
                          </span>
                          <span>
                            ¥{(dp.price / 1000).toFixed(1)}k
                          </span>
                        </div>
                      );
                    })}
                    {dayPrices.length > 3 && (
                      <div style={{ fontSize: "8px", color: "var(--text-muted)", textAlign: "center", marginTop: "2px" }}>
                        他 {dayPrices.length - 3} 部屋
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* セルクリック詳細パネル */}
      {selectedDayDetails && (
        <div className="card animate-fade-in" style={{ marginTop: "20px", border: "1px solid var(--primary)" }}>
          <div className="card-header" style={{ background: "var(--primary-light)" }}>
            <h2 style={{ color: "var(--primary)" }}>
              <i className="far fa-clock"></i> {selectedDayDetails.dateKey} の詳細価格設定
            </h2>
            <button className="btn btn-sm btn-outline" onClick={() => setSelectedDate(null)}>
              閉じる
            </button>
          </div>
          <div className="card-body">
            {selectedDayDetails.prices.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "14px", textAlign: "center" }}>
                この日の算出価格データはありません。「再計算」を行うか「サンプル初期化」を実行してください。
              </p>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>部屋タイプ</th>
                      <th>販売ステータス</th>
                      <th>現在価格</th>
                      <th>AI推奨価格</th>
                      <th>適用タグ</th>
                      <th>手動変更 / 承認操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDayDetails.prices.map((dp) => {
                      const room = roomTypes.find((r) => r.id === dp.roomTypeId);
                      const prop = selectedDayDetails.proposals.find(
                        (p) => p.roomTypeId === dp.roomTypeId
                      );
                      const isPending = prop && prop.status === "pending";

                      return (
                        <tr key={dp.id}>
                          <td style={{ fontWeight: 700 }}>{room?.name || dp.roomTypeId}</td>
                          <td>
                            <span className={`badge-tag ${isPending ? "warning" : "success"}`}>
                              {isPending ? "AI価格提案中" : "料金設定済み"}
                            </span>
                          </td>
                          <td style={{ fontSize: "15px", fontWeight: 700 }}>
                            ¥{dp.price.toLocaleString("ja-JP")}
                          </td>
                          <td>
                            {prop ? (
                              <strong style={{ color: "var(--primary)", fontSize: "15px" }}>
                                ¥{prop.proposedPrice.toLocaleString("ja-JP")}
                              </strong>
                            ) : (
                              <span style={{ color: "var(--text-muted)" }}>--</span>
                            )}
                          </td>
                          <td>
                            {dp.tags && dp.tags.length > 0 ? (
                              <div style={{ display: "flex", gap: "4px" }}>
                                {dp.tags.map((t) => (
                                  <span
                                    key={t}
                                    className={`badge-tag ${
                                      t.includes("制限")
                                        ? "danger"
                                        : t.includes("割引")
                                        ? "success"
                                        : "info"
                                    }`}
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="badge-tag muted">補正なし</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              {isPending && prop ? (
                                <>
                                  <button
                                    className="btn btn-success btn-sm"
                                    onClick={() => onApproveProposal(prop.id)}
                                  >
                                    AI価格を承認
                                  </button>
                                  <span style={{ color: "var(--border)" }}>|</span>
                                </>
                              ) : null}
                              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <input
                                  type="number"
                                  defaultValue={dp.price}
                                  step="500"
                                  style={{
                                    width: "100px",
                                    padding: "4px 8px",
                                    borderRadius: "4px",
                                    border: "1px solid var(--border)",
                                    fontSize: "13px"
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      const val = parseInt((e.target as HTMLInputElement).value) || 0;
                                      if (val > 0) {
                                        onUpdateCalendarPrice(dp.dateKey, dp.roomTypeId, val);
                                        alert("価格を手動変更しました");
                                      }
                                    }
                                  }}
                                />
                                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                  円 [Enter]
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
