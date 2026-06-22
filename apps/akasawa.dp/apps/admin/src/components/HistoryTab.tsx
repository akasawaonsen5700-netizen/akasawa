import React, { useState, useMemo } from "react";
import { HistoryEntry, RoomType } from "../types";

interface HistoryTabProps {
  roomTypes: RoomType[];
  history: HistoryEntry[];
}

export default function HistoryTab({ roomTypes, history }: HistoryTabProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // 検索フィルタリング
  const filteredHistory = useMemo(() => {
    if (!searchTerm.trim()) return history;
    const term = searchTerm.toLowerCase();
    return history.filter((h) => {
      const room = roomTypes.find((r) => r.id === h.roomTypeId);
      const roomName = room?.name.toLowerCase() || "";
      return (
        h.dateKey.includes(term) ||
        roomName.includes(term) ||
        h.reason.toLowerCase().includes(term) ||
        h.operator.toLowerCase().includes(term)
      );
    });
  }, [history, roomTypes, searchTerm]);

  // CSVエクスポート機能 (実ファイルダウンロード)
  const handleExportCSV = () => {
    if (filteredHistory.length === 0) {
      alert("エクスポートするデータがありません");
      return;
    }

    // CSVヘッダー
    let csvContent = "\uFEFF"; // BOMを追加して日本語文字化けを防ぐ
    csvContent += "操作日時,対象日,部屋タイプ,旧価格,新価格,変動額,理由,ステータス,担当者\n";

    // データ行
    filteredHistory.forEach((h) => {
      const room = roomTypes.find((r) => r.id === h.roomTypeId);
      const roomName = room?.name || h.roomTypeId;
      const statusText = h.status === "approved" ? "承認" : "却下";
      const row = [
        h.timestamp,
        h.dateKey,
        `"${roomName.replace(/"/g, '""')}"`,
        h.oldPrice,
        h.newPrice,
        h.difference,
        `"${h.reason.replace(/"/g, '""')}"`,
        statusText,
        h.operator
      ].join(",");
      csvContent += row + "\n";
    });

    // ダウンロード処理
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `akasawa_price_history_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section className="page active" id="page-history">
      <div className="card">
        <div className="card-header">
          <h2><i className="fas fa-history"></i> 承認・却下操作履歴</h2>
          <div className="filter-bar">
            <input
              type="text"
              placeholder="日付、客室名、理由などで検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <button className="btn btn-outline btn-sm" onClick={handleExportCSV}>
              <i className="fas fa-download"></i> CSVエクスポート
            </button>
          </div>
        </div>

        <div className="card-body">
          {filteredHistory.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
              <i className="fas fa-inbox" style={{ fontSize: "40px", marginBottom: "12px" }}></i>
              <p>操作履歴はありません</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>操作日時</th>
                    <th>対象日</th>
                    <th>部屋タイプ</th>
                    <th>旧価格</th>
                    <th>新価格</th>
                    <th>変動額</th>
                    <th>理由</th>
                    <th>ステータス</th>
                    <th>担当者</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((h) => {
                    const room = roomTypes.find((r) => r.id === h.roomTypeId);
                    const isApp = h.status === "approved";
                    return (
                      <tr key={h.id}>
                        <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                          {h.timestamp}
                        </td>
                        <td style={{ fontWeight: 700 }}>{h.dateKey}</td>
                        <td style={{ fontWeight: 600 }}>{room?.name || h.roomTypeId}</td>
                        <td>¥{h.oldPrice.toLocaleString("ja-JP")}</td>
                        <td style={{ fontWeight: 700, color: isApp ? "var(--primary)" : "inherit" }}>
                          ¥{h.newPrice.toLocaleString("ja-JP")}
                        </td>
                        <td className={`change-amount ${h.difference > 0 ? "up" : h.difference < 0 ? "down" : ""}`}>
                          {h.difference > 0
                            ? `+¥${h.difference.toLocaleString("ja-JP")}`
                            : h.difference < 0
                            ? `-¥${Math.abs(h.difference).toLocaleString("ja-JP")}`
                            : "¥0"}
                        </td>
                        <td>
                          <span className="badge-tag info">{h.reason}</span>
                        </td>
                        <td>
                          <span className={`badge-tag ${isApp ? "success" : "muted"}`}>
                            {isApp ? "承認反映" : "却下"}
                          </span>
                        </td>
                        <td style={{ fontSize: "13px", fontWeight: 500 }}>
                          {h.operator}
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
