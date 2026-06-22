import React, { useEffect, useRef } from "react";
import { CalendarPrice, Proposal, RoomType } from "../types";

interface DashboardTabProps {
  roomTypes: RoomType[];
  prices: CalendarPrice[];
  proposals: Proposal[];
  onApprove: (proposalId: string, finalPrice?: number) => void;
  onReject: (proposalId: string) => void;
  onOpenAdjustModal: (proposal: Proposal) => void;
  switchTab: (tab: string) => void;
}

export default function DashboardTab({
  roomTypes,
  prices,
  proposals,
  onApprove,
  onReject,
  onOpenAdjustModal,
  switchTab
}: DashboardTabProps) {
  const demandChartRef = useRef<HTMLCanvasElement | null>(null);
  const channelChartRef = useRef<HTMLCanvasElement | null>(null);
  const trendChartRef = useRef<HTMLCanvasElement | null>(null);

  const demandChartInst = useRef<any>(null);
  const channelChartInst = useRef<any>(null);
  const trendChartInst = useRef<any>(null);

  // 統計集計
  const stats = React.useMemo(() => {
    const pendingCount = proposals.filter((p) => p.status === "pending").length;
    const avgPrice =
      prices.length > 0
        ? Math.round(prices.reduce((sum, item) => sum + item.price, 0) / prices.length)
        : 0;
    const avgOcc =
      prices.length > 0
        ? Math.round((prices.reduce((sum, item) => sum + item.occupancyRate, 0) / prices.length) * 100)
        : 0;
    const revpar = Math.round(avgPrice * (avgOcc / 100));

    return { pendingCount, avgPrice, avgOcc, revpar };
  }, [prices, proposals]);

  // 直近の未承認提案5件
  const recentPending = React.useMemo(() => {
    return proposals.filter((p) => p.status === "pending").slice(0, 5);
  }, [proposals]);

  // グラフの描画
  useEffect(() => {
    const Chart = (window as any).Chart;
    if (!Chart) return;

    // 1. 需要予測 & 推奨価格グラフ（今後15日分）
    if (demandChartRef.current) {
      if (demandChartInst.current) demandChartInst.current.destroy();

      const days = [...new Set(prices.map((p) => p.dateKey))].sort().slice(0, 15);
      const avgProposedPrices = days.map((day) => {
        const dayPrices = prices.filter((p) => p.dateKey === day);
        return dayPrices.length > 0
          ? Math.round(dayPrices.reduce((sum, p) => sum + p.price, 0) / dayPrices.length)
          : 0;
      });
      const avgOccupancies = days.map((day) => {
        const dayPrices = prices.filter((p) => p.dateKey === day);
        return dayPrices.length > 0
          ? Math.round(
              (dayPrices.reduce((sum, p) => sum + p.occupancyRate, 0) / dayPrices.length) * 100
            )
          : 0;
      });

      const ctx = demandChartRef.current.getContext("2d");
      if (ctx) {
        demandChartInst.current = new Chart(ctx, {
          type: "bar",
          data: {
            labels: days.map((d) => d.slice(5)), // MM-DD 形式
            datasets: [
              {
                type: "line" as const,
                label: "平均推奨価格 (円)",
                data: avgProposedPrices,
                borderColor: "#0d5c4b",
                backgroundColor: "rgba(13, 92, 75, 0.1)",
                borderWidth: 3,
                yAxisID: "y-price",
                tension: 0.3,
                fill: true
              },
              {
                type: "bar" as const,
                label: "予測稼働率 (%)",
                data: avgOccupancies,
                backgroundColor: "rgba(217, 119, 6, 0.4)",
                hoverBackgroundColor: "rgba(217, 119, 6, 0.7)",
                borderRadius: 4,
                yAxisID: "y-occ"
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: "top", labels: { font: { family: "Outfit" } } }
            },
            scales: {
              "y-price": {
                type: "linear" as const,
                position: "left" as const,
                title: { display: true, text: "価格 (円)" },
                grid: { drawOnChartArea: true }
              },
              "y-occ": {
                type: "linear" as const,
                position: "right" as const,
                title: { display: true, text: "稼働率 (%)" },
                min: 0,
                max: 100,
                grid: { drawOnChartArea: false }
              }
            }
          }
        });
      }
    }

    // 2. チャネル別予約比率グラフ
    if (channelChartRef.current) {
      if (channelChartInst.current) channelChartInst.current.destroy();

      const ctx = channelChartRef.current.getContext("2d");
      if (ctx) {
        channelChartInst.current = new Chart(ctx, {
          type: "doughnut",
          data: {
            labels: ["楽天トラベル", "じゃらんnet", "自社公式サイト", "Booking.com"],
            datasets: [
              {
                data: [38, 27, 20, 15],
                backgroundColor: ["#0d5c4b", "#c49a45", "#06b6d4", "#64748b"],
                borderWidth: 2,
                borderColor: "#ffffff"
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: "bottom" }
            },
            cutout: "60%"
          }
        });
      }
    }

    // 3. 年度別 稼働率推移比較
    if (trendChartRef.current) {
      if (trendChartInst.current) trendChartInst.current.destroy();

      const months = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
      const ctx = trendChartRef.current.getContext("2d");
      if (ctx) {
        trendChartInst.current = new Chart(ctx, {
          type: "line",
          data: {
            labels: months,
            datasets: [
              {
                label: "2024年度実績 (%)",
                data: [42, 45, 52, 58, 65, 50, 72, 85, 60, 58, 48, 70],
                borderColor: "#94a3b8",
                borderDash: [5, 5],
                borderWidth: 1.5,
                fill: false,
                tension: 0.2
              },
              {
                label: "2025年度実績 (%)",
                data: [48, 52, 58, 62, 70, 55, 78, 88, 64, 62, 54, 76],
                borderColor: "#3b82f6",
                borderWidth: 2,
                fill: false,
                tension: 0.2
              },
              {
                label: "2026年度（予測含む）(%)",
                data: [54, 58, 65, 72, 78, 60, 83, 92, 72, 70, 62, 82],
                borderColor: "#0d5c4b",
                borderWidth: 3,
                fill: false,
                tension: 0.2
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: "top" }
            },
            scales: {
              y: { min: 30, max: 100, title: { display: true, text: "平均稼働率 (%)" } }
            }
          }
        });
      }
    }

    return () => {
      if (demandChartInst.current) demandChartInst.current.destroy();
      if (channelChartInst.current) channelChartInst.current.destroy();
      if (trendChartInst.current) trendChartInst.current.destroy();
    };
  }, [prices]);

  return (
    <section className="page active" id="page-dashboard">
      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon blue"><i className="fas fa-bed"></i></div>
          <div className="kpi-body">
            <div className="kpi-label">予測平均稼働率 (45日)</div>
            <div className="kpi-value">{stats.avgOcc}<span className="kpi-unit">%</span></div>
            <div className="kpi-sub"><i className="fas fa-arrow-up green"></i> 前月比 +4.2%</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon green"><i className="fas fa-yen-sign"></i></div>
          <div className="kpi-body">
            <div className="kpi-label">予測平均客室単価 (ADR)</div>
            <div className="kpi-value">¥{stats.avgPrice.toLocaleString("ja-JP")}</div>
            <div className="kpi-sub"><i className="fas fa-arrow-up green"></i> 前月比 +¥1,120</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon orange"><i className="fas fa-chart-line"></i></div>
          <div className="kpi-body">
            <div className="kpi-label">予測RevPAR</div>
            <div className="kpi-value">¥{stats.revpar.toLocaleString("ja-JP")}</div>
            <div className="kpi-sub"><i className="fas fa-arrow-up green"></i> 前月比 +¥1,380</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon purple"><i className="fas fa-bell"></i></div>
          <div className="kpi-body">
            <div className="kpi-label">要承認の価格提案数</div>
            <div className={`kpi-value ${stats.pendingCount > 0 ? "pending-count" : ""}`} style={{ color: stats.pendingCount > 0 ? "var(--danger)" : "inherit" }}>
              {stats.pendingCount}
            </div>
            <div className="kpi-sub">最新AI計算より</div>
          </div>
        </div>
      </div>

      {/* 本日の5分タスク */}
      <div className="card" style={{ border: "2px solid var(--primary)", background: "var(--primary-light)", marginBottom: "24px" }}>
        <div className="card-header" style={{ background: "var(--primary)", color: "white" }}>
          <h2 style={{ color: "white" }}><i className="fas fa-check-circle"></i> 【本日の5分タスク】価格提案の承認・却下</h2>
          <span style={{ fontSize: "11px", opacity: 0.9 }}>毎日午前9時に価格提案が更新されます</span>
        </div>
        <div className="card-body" style={{ display: "flex", gap: "20px", alignItems: "stretch", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "280px", background: "white", padding: "18px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: "14px", marginBottom: "12px", color: "var(--primary)", fontWeight: 700 }}>
              <i className="fas fa-balance-scale"></i> 判断基準（迷った時のガイドライン）
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                <span style={{ width: "84px", padding: "2px 8px", background: "var(--danger-light)", color: "var(--danger)", borderRadius: "4px", fontWeight: 700, textAlign: "center" }}>信頼度80%+</span>
                <span>→ <strong>即決承認 (推奨)</strong></span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                <span style={{ width: "84px", padding: "2px 8px", background: "var(--warning-light)", color: "var(--warning)", borderRadius: "4px", fontWeight: 700, textAlign: "center" }}>70%〜79%</span>
                <span>→ イベント状況を鑑み微調整</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                <span style={{ width: "84px", padding: "2px 8px", background: "#f1f5f9", color: "#64748b", borderRadius: "4px", fontWeight: 700, textAlign: "center" }}>70%未満</span>
                <span>→ 却下または据え置き</span>
              </div>
            </div>
          </div>
          <div style={{ flex: 1.5, minWidth: "300px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
              <div style={{ textAlign: "center", flex: 1 }}>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>未対応の提案</div>
                <div style={{ fontSize: "38px", fontWeight: 800, color: "var(--danger)" }}>{stats.pendingCount} <span style={{ fontSize: "16px" }}>件</span></div>
              </div>
              <div style={{ width: "2px", height: "60px", background: "var(--border)" }}></div>
              <div style={{ flex: 2 }}>
                <p style={{ fontSize: "13px", color: "var(--text)", lineHeight: 1.6 }}>
                  本日の提案は、<strong>渓流トレッキング</strong>や<strong>週末の猫ルーム予約状況</strong>に基づく最適値です。信頼度の高い値を確認のうえ、反映してください。
                </p>
                <button className="btn btn-primary btn-sm" style={{ marginTop: "12px" }} onClick={() => switchTab("proposals")}>
                  <i className="fas fa-arrow-right"></i> 提案リストへ移動
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="chart-row">
        <div className="card chart-card">
          <div className="card-header">
            <h2><i className="fas fa-chart-bar"></i> 今後15日間の需要予測 &amp; 平均推奨価格</h2>
          </div>
          <div className="card-body" style={{ height: "300px", position: "relative" }}>
            <canvas ref={demandChartRef}></canvas>
          </div>
        </div>
        <div className="card chart-card">
          <div className="card-header">
            <h2><i className="fas fa-pie-chart"></i> チャネル別予約比率</h2>
          </div>
          <div className="card-body" style={{ height: "300px", position: "relative" }}>
            <canvas ref={channelChartRef}></canvas>
          </div>
        </div>
      </div>

      {/* Trend Chart */}
      <div className="card">
        <div className="card-header">
          <h2><i className="fas fa-history"></i> 年度別 稼働率推移比較 (過去3年間)</h2>
        </div>
        <div className="card-body" style={{ height: "280px", position: "relative" }}>
          <canvas ref={trendChartRef}></canvas>
        </div>
      </div>

      {/* Featured Room Section */}
      <div className="card" style={{ marginTop: "24px" }}>
        <div className="card-header">
          <h2><i className="fas fa-gem"></i> 本日の注目客室（要価格強化）</h2>
        </div>
        <div className="card-body" style={{ display: "flex", gap: "24px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "300px", maxHeight: "220px", overflow: "hidden", borderRadius: "var(--radius-sm)", boxShadow: "var(--shadow-md)" }}>
            <img src="/cat_room_thermal.png" alt="渓流側和洋室 (猫ルーム)" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div style={{ flex: 1.5, minWidth: "300px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--primary)", marginBottom: "8px" }}>
              渓流側和洋室 (猫ルーム)
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", lineHeight: 1.6, marginBottom: "16px" }}>
              本日、猫ルームの空室お問合せが急増しています。周辺宿の類似ペット宿泊プランもほぼ完売しているため、自動価格エンジンにより<strong>平日基準価格から+¥3,000アップ</strong>での販売を推奨します。信頼度は<strong>94%</strong>と極めて高く、機会損失を防ぎ売上を最大化するチャンスです。
            </p>
            <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
              <div style={{ background: "var(--bg-app)", padding: "8px 14px", borderRadius: "var(--radius-sm)", flex: 1 }}>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>基準平日価格</div>
                <div style={{ fontSize: "16px", fontWeight: 700 }}>¥22,000</div>
              </div>
              <div style={{ background: "var(--success-light)", border: "1px solid var(--success)", padding: "8px 14px", borderRadius: "var(--radius-sm)", flex: 1 }}>
                <div style={{ fontSize: "11px", color: "var(--success)", fontWeight: 600 }}>本日AI推奨価格</div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--primary)" }}>¥25,000</div>
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => switchTab("proposals")}>
              <i className="fas fa-check-circle"></i> この提案を確認する
            </button>
          </div>
        </div>
      </div>

      {/* Recent Proposals Table */}
      <div className="card">
        <div className="card-header">
          <h2><i className="fas fa-list-alt"></i> 最近の価格提案（未承認の抜粋）</h2>
          <button className="btn btn-sm btn-outline" onClick={() => switchTab("proposals")}>全て見る</button>
        </div>
        <div className="card-body">
          {recentPending.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", fontSize: "14px" }}>
              <i className="fas fa-check-double" style={{ fontSize: "24px", color: "var(--success)", marginBottom: "8px" }}></i>
              <p>承認待ちの価格提案はすべて処理済みです！</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>日付</th>
                    <th>部屋タイプ</th>
                    <th>現在価格</th>
                    <th>提案価格</th>
                    <th>変動</th>
                    <th>理由</th>
                    <th>信頼度</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPending.map((p) => {
                    const room = roomTypes.find((r) => r.id === p.roomTypeId);
                    const diff = p.proposedPrice - p.currentPrice;
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 700 }}>{p.dateKey}</td>
                        <td style={{ fontWeight: 600 }}>{room?.name || p.roomTypeId}</td>
                        <td>¥{p.currentPrice.toLocaleString("ja-JP")}</td>
                        <td style={{ fontWeight: 700, color: "var(--primary)" }}>¥{p.proposedPrice.toLocaleString("ja-JP")}</td>
                        <td className={`change-amount ${diff > 0 ? "up" : "down"}`}>
                          {diff > 0 ? `+¥${diff.toLocaleString("ja-JP")}` : `-¥${Math.abs(diff).toLocaleString("ja-JP")}`}
                        </td>
                        <td>
                          <span className="badge-tag info">{p.changeReason}</span>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontWeight: 700, width: "30px" }}>{p.confidence}%</span>
                            <div className="confidence-bar-wrap">
                              <div className="confidence-bar" style={{ width: `${p.confidence}%`, background: p.confidence >= 80 ? "var(--primary)" : "var(--warning)" }}></div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button className="btn btn-success btn-sm" onClick={() => onApprove(p.id)}>
                              承認
                            </button>
                            <button className="btn btn-outline btn-sm" onClick={() => onOpenAdjustModal(p)}>
                              調整
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => onReject(p.id)}>
                              却下
                            </button>
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
    </section>
  );
}
