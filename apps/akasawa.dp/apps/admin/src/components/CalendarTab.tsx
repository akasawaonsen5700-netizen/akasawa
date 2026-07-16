import React, { useState, useMemo, useEffect } from "react";
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

  // 競合11施設のリアルタイムデータ
  const [competitors, setCompetitors] = useState<any[] | null>(null);
  const [loadingCompetitors, setLoadingCompetitors] = useState<boolean>(false);
  const [areaVacantCount, setAreaVacantCount] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedDate) {
      setCompetitors(null);
      setAreaVacantCount(null);
      return;
    }

    const dObj = new Date(selectedDate);
    const year = dObj.getFullYear();
    const month = String(dObj.getMonth() + 1).padStart(2, '0');
    const day = String(dObj.getDate()).padStart(2, '0');

    setLoadingCompetitors(true);
    setCompetitors(null);

    fetch(`/api/scrape-rakuten?year=${year}&month=${month}&day=${day}`)
      .then(res => res.json())
      .then(json => {
        if (json.totalResults !== undefined) {
          setAreaVacantCount(json.totalResults);
        }
        if (json.competitors) {
          const TARGET_HOTELS = [
            { id: "majimaso", name: "旅館まじま荘", rating: 4.2, url: "https://travel.rakuten.co.jp/HOTEL/14850/" },
            { id: "yamaguciya", name: "山口屋旅館", rating: 4.1, url: "https://travel.rakuten.co.jp/HOTEL/9304/" },
            { id: "kamiaizuya", name: "上会津屋", rating: 4.4, url: "https://travel.rakuten.co.jp/HOTEL/4674/" },
            { id: "nuriya", name: "心づくしの宿 ぬりや", rating: 4.3, url: "https://travel.rakuten.co.jp/HOTEL/129558/" },
            { id: "tokiwa", name: "常盤ホテル", rating: 4.0, url: "https://travel.rakuten.co.jp/HOTEL/5884/" },
            { id: "umekawaso", name: "塩原温泉梅川壮", rating: 4.4, url: "https://travel.rakuten.co.jp/HOTEL/109143/" },
            { id: "okukogen", name: "奥塩原高原ホテル", rating: 4.2, url: "https://travel.rakuten.co.jp/HOTEL/32030/" },
            { id: "shimofujiya", name: "やまの宿 下藤屋", rating: 4.5, url: "https://travel.rakuten.co.jp/HOTEL/5650/" },
            { id: "shofuro", name: "松楓楼 松屋", rating: 4.5, url: "https://travel.rakuten.co.jp/HOTEL/2634/" },
            { id: "gensenkan", name: "秘湯の宿 元泉館", rating: 4.2, url: "https://travel.rakuten.co.jp/HOTEL/5144/" },
            { id: "wanwan", name: "わんわんパラダイス", rating: 4.2, url: "https://travel.rakuten.co.jp/HOTEL/104699/" }
          ];

          const formatted = json.competitors.map((c: any) => {
            const matched = TARGET_HOTELS.find(h => h.id === c.hotelId);
            return {
              hotelId: c.hotelId,
              hotelName: c.hotelName || (matched ? matched.name : c.hotelId),
              reviewAverage: c.reviewAverage || (matched ? matched.rating : 0),
              hotelInformationUrl: c.hotelInformationUrl || (matched ? matched.url : ""),
              status: c.status,
              price: c.price,
              planName: c.planName,
              roomType: c.roomType
            };
          });
          setCompetitors(formatted);
        }
      })
      .catch(err => console.error("Failed to fetch competitors:", err))
      .finally(() => setLoadingCompetitors(false));
  }, [selectedDate]);

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

  const selectedDayStats = useMemo(() => {
    if (!selectedDayDetails || selectedDayDetails.prices.length === 0) return null;
    const dayPrices = selectedDayDetails.prices;
    const avgOcc =
      dayPrices.length > 0
        ? dayPrices.reduce((sum, p) => sum + p.occupancyRate, 0) / dayPrices.length
        : 0.5;

    const totalRooms = 67;
    // 部屋を販売してるのが空室数
    const vacantRooms = Math.round(totalRooms * (1 - avgOcc));
    // 67件 - 空室数 ＝ 満室数
    const occupiedRooms = totalRooms - vacantRooms;
    // 満室率
    const occupancyPercentage = Math.round((occupiedRooms / totalRooms) * 100);

    return {
      totalRooms,
      vacantRooms,
      occupiedRooms,
      occupancyPercentage
    };
  }, [selectedDayDetails]);

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

              // 67室を母数とした計算
              const totalRooms = 67;
              const cellVacant = Math.round(totalRooms * (1 - avgOcc));
              const cellOccupied = totalRooms - cellVacant;
              const cellOccPct = Math.round((cellOccupied / totalRooms) * 100);

              let occClass = "mid";
              if (cellOccPct >= 70) {
                occClass = "high";
              } else if (cellOccPct < 50) {
                occClass = "low";
              }
              const occLabel = `満室 ${cellOccPct}% (空室 ${cellVacant}室)`;

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
            {selectedDayStats && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "16px",
                  marginBottom: "20px",
                  padding: "16px",
                  background: "var(--bg-app)",
                  borderRadius: "8px",
                  border: "1px solid var(--border)"
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>総客室数（母数）</div>
                  <div style={{ fontSize: "20px", fontWeight: "bold", color: "var(--text)" }}>{selectedDayStats.totalRooms} 室</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>空室数（販売中）</div>
                  <div style={{ fontSize: "20px", fontWeight: "bold", color: "var(--success)" }}>{selectedDayStats.vacantRooms} 室</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>満室数</div>
                  <div style={{ fontSize: "20px", fontWeight: "bold", color: "var(--primary)" }}>{selectedDayStats.occupiedRooms} 室</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>満室率</div>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: "var(--primary)" }}>{selectedDayStats.occupancyPercentage}%</div>
                </div>
              </div>
            )}

            {/* ♨️ 塩原温泉エリア 全体宿泊率 */}
            {areaVacantCount !== null && areaVacantCount >= 0 && (
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "8px",
                  padding: "20px",
                  marginBottom: "20px"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "24px", marginBottom: "4px" }}>♨️</div>
                    <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#166534", margin: "0 0 4px 0" }}>
                      塩原温泉エリア 全体宿泊率
                    </h3>
                    <div style={{ fontSize: "12px", color: "#15803d", marginBottom: "16px" }}>
                      対象: 楽天トラベル掲載の塩原エリア全施設（67軒）
                    </div>
                    
                    <div style={{ fontSize: "16px", fontWeight: "bold", color: "#166534", marginBottom: "12px" }}>
                      空室: <span style={{ fontSize: "18px", color: "#15803d" }}>{areaVacantCount}</span> 軒 / 
                      満室: <span style={{ fontSize: "18px", color: "#b91c1c" }}>{Math.max(0, 67 - areaVacantCount)}</span> 軒
                    </div>
                    
                    <div style={{ fontSize: "12px", color: "#16a34a", fontWeight: "bold", display: "flex", alignItems: "center", gap: "4px" }}>
                      <span>🟢</span> 楽天トラベルよりリアルタイム取得済
                    </div>
                  </div>
                  
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "36px", fontWeight: "900", color: "#166534", lineHeight: "1" }}>
                      {Math.round(((67 - areaVacantCount) / 67) * 100)}%
                    </div>
                    <div
                      style={{
                        display: "inline-block",
                        marginTop: "8px",
                        background: "#166534",
                        color: "#ffffff",
                        padding: "4px 12px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: "bold"
                      }}
                    >
                      {Math.round(((67 - areaVacantCount) / 67) * 100) >= 60 ? "高需要" : Math.round(((67 - areaVacantCount) / 67) * 100) >= 40 ? "中需要" : "低需要"}
                    </div>
                  </div>
                </div>
              </div>
            )}

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

            {/* なぜこの11施設を調べるのか？（選定の根拠） */}
            <div
              style={{
                marginTop: "24px",
                padding: "16px",
                background: "var(--bg-app)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "13px",
                lineHeight: "1.6",
                color: "var(--text)"
              }}
            >
              <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "bold", color: "var(--primary)" }}>
                💡 なぜこの11施設を調べるのか？（選定の根拠）
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div>
                  <strong style={{ color: "#1e3a8a" }}>🔵 直接比較（6施設）</strong><br />
                  まじま荘、山口屋など同規模旅館。この平均・最安値が赤沢の「基準価格」のベースになります。
                </div>
                <div>
                  <strong style={{ color: "#4b5563" }}>🔘 相場参考（3施設）</strong><br />
                  奥塩原高原ホテルなど中位〜上位宿。連休でエリアがどこまで高騰するかの「天井」を探ります。
                </div>
                <div>
                  <strong style={{ color: "#6d28d9" }}>🟣 独自状態（2施設）</strong><br />
                  元泉館、わんわんパラダイス。ペット同伴などの独自需要がどれほどの「プレミアム」を生むかの指標です。
                </div>
              </div>
            </div>

            {/* 競合11施設のリアルタイム調査状況 */}
            <div style={{ marginTop: "32px", borderTop: "2px solid var(--border)", paddingTop: "24px" }}>
              <h4 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "16px", color: "var(--text)", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🔍</span> 競合11施設のリアルタイム調査状況
              </h4>
              {loadingCompetitors ? (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
                  <span className="spinner-small" style={{ display: "inline-block", marginRight: "8px" }}></span>
                  楽天トラベルから最新の実データを取得中...
                </div>
              ) : competitors && competitors.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
                  {competitors.map((comp) => (
                    <div
                      key={comp.hotelId}
                      style={{
                        background: "var(--bg-app)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        padding: "16px",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                        transition: "all 0.2s ease"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                        <h5 style={{ margin: 0, fontSize: "14px", fontWeight: "bold", color: "var(--text)" }}>{comp.hotelName}</h5>
                        <span style={{ fontSize: "11px", color: "#eab308", fontWeight: "bold", background: "rgba(234, 179, 8, 0.1)", padding: "2px 6px", borderRadius: "4px" }}>
                          ⭐ {comp.reviewAverage > 0 ? `${comp.reviewAverage.toFixed(1)} (評価・クチコミ)` : "評価なし"}
                        </span>
                      </div>
                      
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", fontSize: "11px", color: "var(--text-muted)", marginBottom: "12px" }}>
                        <span style={{ background: "var(--border)", padding: "2px 6px", borderRadius: "4px" }}>🍴 プランの基本:一泊二食</span>
                        <span style={{ background: "var(--border)", padding: "2px 6px", borderRadius: "4px" }}>👤 ２名</span>
                        <span style={{ background: "var(--border)", padding: "2px 6px", borderRadius: "4px" }}>🚪 部屋情報10帖</span>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        {comp.status === "full" ? (
                          <>
                            <span style={{ color: "#ef4444", fontWeight: "bold", fontSize: "14px", background: "rgba(239, 68, 68, 0.1)", padding: "4px 8px", borderRadius: "4px" }}>
                              満室
                            </span>
                            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>
                              表示なし
                            </span>
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: "18px", fontWeight: "bold", color: "#10b981" }}>
                              ¥{comp.price.toLocaleString()}
                            </span>
                            <span style={{ fontSize: "11px", color: "#10b981", background: "rgba(16, 185, 129, 0.1)", padding: "4px 8px", borderRadius: "4px", fontWeight: "bold" }}>
                              空室あり
                            </span>
                          </>
                        )}
                      </div>

                      {comp.hotelInformationUrl && (
                        <div style={{ marginTop: "12px", textAlign: "right", borderTop: "1px dashed var(--border)", paddingTop: "8px" }}>
                          <a
                            href={comp.hotelInformationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: "12px",
                              color: "#3b82f6",
                              textDecoration: "none",
                              fontWeight: "bold",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                          >
                            楽天トラベルで見る ↗
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--text-muted)", fontSize: "14px", textAlign: "center", padding: "20px" }}>
                  リアルタイムデータがありません。
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
