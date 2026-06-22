import React, { useState, useMemo } from "react";
import { Proposal, RoomType } from "../types";

interface ProposalsTabProps {
  roomTypes: RoomType[];
  proposals: Proposal[];
  onApprove: (proposalId: string, finalPrice?: number) => void;
  onReject: (proposalId: string) => void;
  onApproveAll: (filteredProposals: Proposal[]) => void;
  onOpenAdjustModal: (proposal: Proposal) => void;
}

export default function ProposalsTab({
  roomTypes,
  proposals,
  onApprove,
  onReject,
  onApproveAll,
  onOpenAdjustModal
}: ProposalsTabProps) {
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [roomFilter, setRoomFilter] = useState<string>("all");

  // フィルタリング処理
  const filteredProposals = useMemo(() => {
    return proposals.filter((p) => {
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      const matchRoom = roomFilter === "all" || p.roomTypeId === roomFilter;
      return matchStatus && matchRoom;
    });
  }, [proposals, statusFilter, roomFilter]);

  const pendingFilteredCount = useMemo(() => {
    return filteredProposals.filter((p) => p.status === "pending").length;
  }, [filteredProposals]);

  return (
    <section className="page active" id="page-proposals">
      {/* フィルターバー */}
      <div className="card" style={{ marginBottom: "20px" }}>
        <div className="card-body" style={{ padding: "16px 20px" }}>
          <div className="filter-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label htmlFor="status-filter">ステータス:</label>
                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">全て</option>
                  <option value="pending">承認待ち</option>
                  <option value="approved">承認済み</option>
                  <option value="rejected">却下済み</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label htmlFor="room-filter">客室タイプ:</label>
                <select
                  id="room-filter"
                  value={roomFilter}
                  onChange={(e) => setRoomFilter(e.target.value)}
                >
                  <option value="all">全室タイプ</option>
                  {roomTypes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name.replace(/【禁煙】/, "")}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {statusFilter === "pending" && pendingFilteredCount > 0 && (
              <button
                className="btn btn-success btn-sm"
                onClick={() => onApproveAll(filteredProposals.filter((p) => p.status === "pending"))}
              >
                <i className="fas fa-check-double"></i> 画面上の {pendingFilteredCount} 件を一括承認
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 提案カードグリッド */}
      {filteredProposals.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
          <div className="card-body">
            <i className="fas fa-inbox" style={{ fontSize: "48px", color: "var(--text-muted)", marginBottom: "16px" }}></i>
            <p style={{ fontSize: "16px", fontWeight: "bold", color: "var(--text-muted)" }}>
              該当する価格提案はありません
            </p>
          </div>
        </div>
      ) : (
        <div className="proposal-grid">
          {filteredProposals.map((p) => {
            const room = roomTypes.find((r) => r.id === p.roomTypeId);
            const diff = p.proposedPrice - p.currentPrice;
            const isPending = p.status === "pending";
            const isApproved = p.status === "approved";
            const isRejected = p.status === "rejected";

            return (
              <div key={p.id} className="proposal-card">
                <div className={`proposal-card-header ${isPending && p.confidence >= 85 ? "urgent" : ""}`}>
                  <span className="proposal-date">
                    <i className="far fa-calendar-alt" style={{ marginRight: "6px" }}></i>
                    {p.dateKey}
                  </span>
                  {isPending ? (
                    <span className={`badge-tag ${p.confidence >= 80 ? "danger" : "warning"}`}>
                      {p.confidence >= 80 ? "推奨度高" : "要検討"}
                    </span>
                  ) : isApproved ? (
                    <span className="badge-tag success">承認済み</span>
                  ) : (
                    <span className="badge-tag muted">却下済み</span>
                  )}
                </div>

                <div className="proposal-card-body">
                  <div>
                    <h3 className="proposal-room-type">
                      {room?.name || p.roomTypeId}
                    </h3>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      在庫 {room?.inventory} / 定員 {room?.capacity}名
                    </span>
                  </div>

                  <div className="price-compare">
                    <div className="compare-box">
                      <span className="compare-label">現在価格</span>
                      <span className="compare-price">¥{p.currentPrice.toLocaleString("ja-JP")}</span>
                    </div>
                    <div className="compare-arrow">
                      <i className="fas fa-arrow-right"></i>
                    </div>
                    <div className="compare-box" style={{ textAlign: "right" }}>
                      <span className="compare-label" style={{ color: "var(--primary)", fontWeight: 700 }}>提案価格</span>
                      <span className="compare-price proposed">¥{p.proposedPrice.toLocaleString("ja-JP")}</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", fontWeight: "bold", color: "var(--text-muted)" }}>変動額</span>
                    <span className={`change-amount ${diff > 0 ? "up" : "down"}`} style={{ fontSize: "15px" }}>
                      {diff > 0 ? `+¥${diff.toLocaleString("ja-JP")}` : `-¥${Math.abs(diff).toLocaleString("ja-JP")}`}
                    </span>
                  </div>

                  <div className="proposal-reason">
                    <i className="fas fa-info-circle" style={{ marginRight: "6px" }}></i>
                    {p.changeReason}
                  </div>

                  <div className="proposal-meta">
                    <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>
                      算出信頼度: <strong style={{ color: p.confidence >= 80 ? "var(--primary)" : "var(--warning)" }}>{p.confidence}%</strong>
                    </span>
                    <div className="confidence-bar-wrap">
                      <div
                        className="confidence-bar"
                        style={{
                          width: `${p.confidence}%`,
                          backgroundColor: p.confidence >= 80 ? "var(--primary)" : "var(--warning)"
                        }}
                      ></div>
                    </div>
                  </div>
                </div>

                {isPending && (
                  <div className="proposal-actions">
                    <button
                      className="btn btn-success btn-sm"
                      style={{ flex: 1.5 }}
                      onClick={() => onApprove(p.id)}
                    >
                      承認して反映
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => onOpenAdjustModal(p)}
                    >
                      価格調整
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => onReject(p.id)}
                    >
                      却下
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
