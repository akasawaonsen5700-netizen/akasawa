import React from "react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingProposalsCount: number;
  lastCalcTime: string;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  pendingProposalsCount,
  lastCalcTime,
  sidebarOpen,
  setSidebarOpen
}: SidebarProps) {
  const menuItems = [
    { id: "dashboard", label: "ダッシュボード", icon: "fas fa-tachometer-alt" },
    { id: "market_research", label: "市場調査 (簡易版)", icon: "fas fa-search-dollar" },
    { id: "proposals", label: "価格提案", icon: "fas fa-lightbulb", badge: pendingProposalsCount },
    { id: "calendar", label: "カレンダー", icon: "fas fa-calendar-alt" },
    { id: "history", label: "承認履歴", icon: "fas fa-history" },
    { id: "settings", label: "価格設定", icon: "fas fa-sliders-h" },
    { id: "connection", label: "外部システム連携", icon: "fas fa-plug" },
    { id: "csv", label: "CSVインポート", icon: "fas fa-file-csv" }
  ];

  return (
    <>
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <div className="hotel-logo">
            <i className="fas fa-spa"></i>
          </div>
          <div className="hotel-name">
            <span className="hotel-name-main">赤沢温泉旅館</span>
            <span className="hotel-name-sub">価格管理システム</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <ul>
            {menuItems.map((item) => (
              <li
                key={item.id}
                className={`nav-item ${activeTab === item.id ? "active" : ""}`}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false); // モバイル時は自動で閉じる
                }}
              >
                <a href={`#${item.id}`}>
                  <i className={item.icon}></i>
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="badge">{item.badge}</span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <div className="system-status">
            <span className="status-dot"></span>
            <span>エンジン稼働中</span>
          </div>
          <div className="ai-trained-badge">
            <i className="fas fa-brain"></i> 過去3年分データ学習済み
          </div>
          <div className="last-calc">
            最終計算: <span id="last-calc-time">{lastCalcTime || "--:--"}</span>
          </div>
        </div>
      </aside>
      {sidebarOpen && (
        <div
          className="sidebar-overlay open"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}
    </>
  );
}
