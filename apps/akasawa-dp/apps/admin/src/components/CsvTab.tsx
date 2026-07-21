import React, { useState } from "react";
import { PmsActual, RoomType } from "../types";

interface CsvTabProps {
  roomTypes: RoomType[];
  pmsActuals: PmsActual[];
  onAddPmsActual: (actual: Omit<PmsActual, "id">) => void;
  onClearPmsActuals: () => void;
  onImportCsv: (csvRows: any[]) => void;
}

export default function CsvTab({
  roomTypes,
  pmsActuals,
  onAddPmsActual,
  onClearPmsActuals,
  onImportCsv
}: CsvTabProps) {
  const [csvPreview, setCsvPreview] = useState<any[] | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // 手動入力フォームステート
  const [manualDate, setManualDate] = useState("");
  const [manualRoom, setManualRoom] = useState(roomTypes[0]?.id || "");
  const [manualSold, setManualSold] = useState(1);
  const [manualOcc, setManualOcc] = useState(70);
  const [manualAdr, setManualAdr] = useState(18000);
  const [manualChannel, setManualChannel] = useState("楽天トラベル");

  // サンプルCSVダウンロード
  const handleDownloadSampleCSV = () => {
    let csvContent = "\uFEFF"; // BOM
    csvContent += "日付,部屋タイプID,販売室数,稼働率(%),平均単価(ADR),チャネル,リードタイム,キャンセル数\n";
    csvContent += `2026-06-01,premium-suite,1,100,28000,楽天トラベル,14,0\n`;
    csvContent += `2026-06-01,compact-room,1,100,16000,じゃらんnet,7,1\n`;
    csvContent += `2026-06-02,petit-suite,1,100,22000,公式サイト,21,0\n`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "akasawa_pms_sample.csv";
    link.click();
  };

  // CSVのファイル読み込み処理 (疑似パース)
  const processCSVFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim() !== "");
      if (lines.length <= 1) {
        alert("有効なCSVデータが見つかりません");
        return;
      }

      // ヘッダー行を除いてパース
      const parsedRows = [];
      for (let i = 1; i < Math.min(lines.length, 6); i++) {
        const cols = lines[i].split(",");
        if (cols.length >= 6) {
          parsedRows.push({
            dateKey: cols[0]?.trim(),
            roomTypeId: cols[1]?.trim(),
            soldRooms: parseInt(cols[2]) || 0,
            occupancyRate: (parseFloat(cols[3]) || 0) / 100,
            adr: parseInt(cols[4]) || 0,
            channel: cols[5]?.trim()
          });
        }
      }
      setCsvPreview(parsedRows);
    };
    reader.readAsText(file);
  };

  // ドラッグ＆ドロップイベント
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processCSVFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processCSVFile(e.target.files[0]);
    }
  };

  // CSVインポート実行
  const handleExecuteImport = () => {
    if (!csvPreview) return;
    onImportCsv(csvPreview);
    setCsvPreview(null);
    alert("実績CSVデータを解析し、ダイナミックプライシングの需要予測モデルへ統合しました！");
  };

  // 手動データ追加
  const handleAddManualData = () => {
    if (!manualDate) {
      alert("日付を選択してください");
      return;
    }

    onAddPmsActual({
      dateKey: manualDate,
      roomTypeId: manualRoom,
      soldRooms: manualSold,
      occupancyRate: manualOcc / 100,
      adr: manualAdr,
      channel: manualChannel,
      leadTime: 12,
      cancelCount: 0
    });

    alert("実績データを追加しました");
  };

  return (
    <section className="page active" id="page-csv">
      <div className="card">
        <div className="card-header">
          <h2><i className="fas fa-file-csv"></i> PMS/OTA実績CSVデータインポート</h2>
        </div>
        <div className="card-body">
          <p style={{ color: "var(--text-muted)", fontSize: "13px", lineHeight: "1.6", marginBottom: "20px" }}>
            過去実績データを取り込み、予約需要モデルの精度を向上させます。PMSや主要チャネルからダウンロードしたCSVファイルを選択してください。
          </p>

          <div
            className={`csv-upload-area ${dragActive ? "drag-active" : ""}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            style={{
              borderColor: dragActive ? "var(--primary)" : "var(--border)",
              background: dragActive ? "var(--primary-light)" : "#fafcfa"
            }}
          >
            <i className="fas fa-cloud-upload-alt" style={{ fontSize: "36px", color: "var(--primary)", marginBottom: "10px" }}></i>
            <p style={{ fontSize: "14px", fontWeight: "bold" }}>CSVファイルをドラッグ&amp;ドロップ</p>
            <small style={{ display: "block", color: "var(--text-muted)", margin: "4px 0 12px" }}>または</small>
            <label className="btn btn-primary btn-sm" htmlFor="csv-file-input" style={{ cursor: "pointer" }}>
              ファイルを選択
            </label>
            <input
              type="file"
              id="csv-file-input"
              accept=".csv"
              style={{ display: "none" }}
              onChange={handleFileSelect}
            />
          </div>

          <div style={{ textAlign: "left", marginBottom: "24px" }}>
            <button className="btn btn-outline btn-sm" onClick={handleDownloadSampleCSV}>
              <i className="fas fa-download"></i> サンプルCSVをダウンロード
            </button>
          </div>

          {/* インポートプレビュー */}
          {csvPreview && (
            <div className="card" style={{ border: "1px solid var(--primary)", marginBottom: "0" }}>
              <div className="card-header" style={{ background: "var(--primary-light)" }}>
                <h3 style={{ fontSize: "14px", color: "var(--primary)" }}>インポートデータのプレビュー (先頭5行)</h3>
              </div>
              <div className="card-body">
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>日付</th>
                        <th>部屋タイプID</th>
                        <th>販売室数</th>
                        <th>稼働率</th>
                        <th>平均単価(ADR)</th>
                        <th>チャネル</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((row, idx) => (
                        <tr key={idx}>
                          <td>{row.dateKey}</td>
                          <td>{row.roomTypeId}</td>
                          <td>{row.soldRooms}室</td>
                          <td>{Math.round(row.occupancyRate * 100)}%</td>
                          <td>¥{row.adr.toLocaleString("ja-JP")}</td>
                          <td>{row.channel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: "16px", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                  <button className="btn btn-outline btn-sm" onClick={() => setCsvPreview(null)}>
                    キャンセル
                  </button>
                  <button className="btn btn-success btn-sm" onClick={handleExecuteImport}>
                    インポートを実行する
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 手動データ入力 */}
      <div className="card">
        <div className="card-header">
          <h2><i className="fas fa-keyboard"></i> 手動データ入力（テスト用）</h2>
        </div>
        <div className="card-body">
          <div className="manual-form" style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: "140px" }}>
              <label style={{ fontSize: "12px", fontWeight: "bold" }}>利用日</label>
              <input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1.5, minWidth: "160px" }}>
              <label style={{ fontSize: "12px", fontWeight: "bold" }}>部屋タイプ</label>
              <select
                value={manualRoom}
                onChange={(e) => setManualRoom(e.target.value)}
                style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", background: "#fff" }}
              >
                {roomTypes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 0.8, minWidth: "80px" }}>
              <label style={{ fontSize: "12px", fontWeight: "bold" }}>販売室数</label>
              <input
                type="number"
                value={manualSold}
                onChange={(e) => setManualSold(parseInt(e.target.value) || 1)}
                min="1"
                style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 0.8, minWidth: "80px" }}>
              <label style={{ fontSize: "12px", fontWeight: "bold" }}>稼働率 (%)</label>
              <input
                type="number"
                value={manualOcc}
                onChange={(e) => setManualOcc(parseInt(e.target.value) || 0)}
                min="0"
                max="100"
                style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: "100px" }}>
              <label style={{ fontSize: "12px", fontWeight: "bold" }}>平均単価 (ADR)</label>
              <input
                type="number"
                value={manualAdr}
                onChange={(e) => setManualAdr(parseInt(e.target.value) || 0)}
                step="500"
                style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: "120px" }}>
              <label style={{ fontSize: "12px", fontWeight: "bold" }}>チャネル</label>
              <select
                value={manualChannel}
                onChange={(e) => setManualChannel(e.target.value)}
                style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", background: "#fff" }}
              >
                <option value="楽天トラベル">楽天トラベル</option>
                <option value="じゃらんnet">じゃらんnet</option>
                <option value="公式サイト">公式サイト</option>
                <option value="Booking.com">Booking.com</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={handleAddManualData} style={{ padding: "10px 20px" }}>
              実績を追加
            </button>
          </div>

          {/* 追加データ一覧 */}
          {pmsActuals.length > 0 && (
            <div style={{ marginTop: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 700 }}>追加済みの実績データ ({pmsActuals.length} 件)</h3>
                <button className="btn btn-outline btn-sm" onClick={onClearPmsActuals} style={{ color: "var(--danger)" }}>
                  データを全て消去
                </button>
              </div>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>利用日</th>
                      <th>部屋タイプ</th>
                      <th>販売室数</th>
                      <th>稼働率</th>
                      <th>平均単価(ADR)</th>
                      <th>予約チャネル</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pmsActuals.map((act) => {
                      const room = roomTypes.find((r) => r.id === act.roomTypeId);
                      return (
                        <tr key={act.id}>
                          <td style={{ fontWeight: 700 }}>{act.dateKey}</td>
                          <td>{room?.name || act.roomTypeId}</td>
                          <td>{act.soldRooms} 室</td>
                          <td>{Math.round(act.occupancyRate * 100)}%</td>
                          <td>¥{act.adr.toLocaleString("ja-JP")}</td>
                          <td>{act.channel}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
