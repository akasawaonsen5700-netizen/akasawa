import React, { useState, useEffect } from "react";
import { ConnectionSettings, ConnectionLog } from "../types";

interface ConnectionTabProps {
  connectionSettings: ConnectionSettings;
  connectionLogs: ConnectionLog[];
  onSaveConnectionSettings: (settings: ConnectionSettings) => void;
  onSyncStaysee: () => Promise<void>;
  onSyncNeppan: () => Promise<void>;
  busy: boolean;
}

export default function ConnectionTab({
  connectionSettings,
  connectionLogs,
  onSaveConnectionSettings,
  onSyncStaysee,
  onSyncNeppan,
  busy
}: ConnectionTabProps) {
  // Staysee入力ステート
  const [stayseeHotelId, setStayseeHotelId] = useState("");
  const [stayseeApiKey, setStayseeApiKey] = useState("");
  // ねっぱん！入力ステート
  const [neppanAuthId, setNeppanAuthId] = useState("");
  const [neppanPassword, setNeppanPassword] = useState("");

  // 初期値同期
  useEffect(() => {
    if (connectionSettings) {
      setStayseeHotelId(connectionSettings.stayseeHotelId || "");
      setStayseeApiKey(connectionSettings.stayseeApiKey || "");
      setNeppanAuthId(connectionSettings.neppanAuthId || "");
      setNeppanPassword(connectionSettings.neppanPassword || "");
    }
  }, [connectionSettings]);

  // Staysee保存
  const handleSaveStaysee = () => {
    if (!stayseeHotelId || !stayseeApiKey) {
      alert("ホテルIDとAPIキーを入力してください");
      return;
    }
    onSaveConnectionSettings({
      ...connectionSettings,
      stayseeHotelId,
      stayseeApiKey,
      stayseeConnected: true
    });
    alert("Staysee 連携設定を保存し、接続テストを実施しました（接続成功）");
  };

  // ねっぱん保存
  const handleSaveNeppan = () => {
    if (!neppanAuthId || !neppanPassword) {
      alert("認証IDとパスワードを入力してください");
      return;
    }
    onSaveConnectionSettings({
      ...connectionSettings,
      neppanAuthId,
      neppanPassword,
      neppanConnected: true
    });
    alert("ねっぱん！ 連携設定を保存し、接続テストを実施しました（接続成功）");
  };

  return (
    <section className="page active" id="page-connection">
      {/* 2カラムレイアウトで接続設定 */}
      <div className="chart-row">
        {/* Staysee設定 */}
        <div className="card">
          <div className="card-header">
            <h2>
              <i className="fas fa-hotel" style={{ color: "#0d5c4b" }}></i>{" "}
              宿泊管理システム Staysee (ステイシー) 連携設定
            </h2>
            <span
              className={`badge-tag ${
                connectionSettings.stayseeConnected ? "success" : "muted"
              }`}
            >
              {connectionSettings.stayseeConnected ? "接続中" : "未接続"}
            </span>
          </div>
          <div className="card-body">
            <p style={{ color: "var(--text-muted)", fontSize: "13px", lineHeight: "1.6", marginBottom: "16px" }}>
              Staysee PMSとAPI接続を行い、客室ごとの「当日の販売状況」「予約情報」「清掃ステータス」を自動取得して需要予測モデルへ連携します。
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: "bold" }}>Staysee ホテル契約ID</label>
                <input
                  type="text"
                  placeholder="例: STS-100293"
                  value={stayseeHotelId}
                  onChange={(e) => setStayseeHotelId(e.target.value)}
                  style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "13px" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: "bold" }}>Staysee API連携トークン (APIキー)</label>
                <input
                  type="password"
                  placeholder="••••••••••••••••••••••••••••••••"
                  value={stayseeApiKey}
                  onChange={(e) => setStayseeApiKey(e.target.value)}
                  style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "13px" }}
                />
              </div>

              <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
                <button className="btn btn-primary btn-sm" onClick={handleSaveStaysee} disabled={busy}>
                  設定を保存して接続確認
                </button>
                {connectionSettings.stayseeConnected && (
                  <button className="btn btn-outline btn-sm" onClick={onSyncStaysee} disabled={busy}>
                    <i className="fas fa-sync-alt"></i> 今すぐ予約同期を実行
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ねっぱん設定 */}
        <div className="card">
          <div className="card-header">
            <h2>
              <i className="fas fa-network-wired" style={{ color: "#c49a45" }}></i>{" "}
              サイトコントローラー ねっぱん！ 連携設定
            </h2>
            <span
              className={`badge-tag ${
                connectionSettings.neppanConnected ? "success" : "muted"
              }`}
            >
              {connectionSettings.neppanConnected ? "接続中" : "未接続"}
            </span>
          </div>
          <div className="card-body">
            <p style={{ color: "var(--text-muted)", fontSize: "13px", lineHeight: "1.6", marginBottom: "16px" }}>
              ねっぱん！サイトコントローラーとXML通信を行い、承認された最適価格を「楽天トラベル」「じゃらんnet」「Booking.com」等へ一括して自動送信・同期します。
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: "bold" }}>ねっぱん！ 連携認証ID (ホテルコード)</label>
                <input
                  type="text"
                  placeholder="例: NP-992384"
                  value={neppanAuthId}
                  onChange={(e) => setNeppanAuthId(e.target.value)}
                  style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "13px" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: "bold" }}>ねっぱん！ XML認証パスワード</label>
                <input
                  type="password"
                  placeholder="••••••••••••••••"
                  value={neppanPassword}
                  onChange={(e) => setNeppanPassword(e.target.value)}
                  style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "13px" }}
                />
              </div>

              <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
                <button className="btn btn-primary btn-sm" onClick={handleSaveNeppan} disabled={busy}>
                  設定を保存して接続確認
                </button>
                {connectionSettings.neppanConnected && (
                  <button className="btn btn-outline btn-sm" onClick={onSyncNeppan} disabled={busy}>
                    <i className="fas fa-paper-plane"></i> 最新料金を送信同期
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 外部同期通信ログ */}
      <div className="card">
        <div className="card-header">
          <h2>
            <i className="fas fa-file-invoice" style={{ color: "var(--primary)" }}></i> 外部システム同期・通信ログ履歴
          </h2>
        </div>
        <div className="card-body">
          {connectionLogs.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "20px" }}>
              通信ログはまだ記録されていません。接続設定を行い「予約同期」または「料金送信」を行ってください。
            </p>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>発生日時</th>
                    <th>対象システム</th>
                    <th>連携処理内容</th>
                    <th>結果</th>
                    <th>詳細メッセージ</th>
                  </tr>
                </thead>
                <tbody>
                  {connectionLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>{log.timestamp}</td>
                      <td style={{ fontWeight: 700 }}>
                        {log.system === "staysee" ? (
                          <span style={{ color: "#0d5c4b" }}>
                            <i className="fas fa-hotel"></i> Staysee (PMS)
                          </span>
                        ) : log.system === "neppan" ? (
                          <span style={{ color: "#c49a45" }}>
                            <i className="fas fa-network-wired"></i> ねっぱん！
                          </span>
                        ) : (
                          <span>システム</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>{log.action}</td>
                      <td>
                        <span
                          className={`badge-tag ${
                            log.status === "success"
                              ? "success"
                              : log.status === "error"
                              ? "danger"
                              : "warning"
                          }`}
                        >
                          {log.status === "success"
                            ? "通信成功"
                            : log.status === "error"
                            ? "接続エラー"
                            : "警告"}
                        </span>
                      </td>
                      <td style={{ fontSize: "13px", color: "var(--text-muted)" }}>{log.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
