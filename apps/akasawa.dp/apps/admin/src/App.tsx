import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarPrice,
  defaultRules,
  PricingRules,
  RoomType,
  Proposal,
  HistoryEntry,
  PmsActual,
  ConnectionSettings,
  ConnectionLog,
  MarketResearchData
} from "./types";
import Sidebar from "./components/Sidebar";
import DashboardTab from "./components/DashboardTab";
import ProposalsTab from "./components/ProposalsTab";
import CalendarTab from "./components/CalendarTab";
import HistoryTab from "./components/HistoryTab";
import SettingsTab from "./components/SettingsTab";
import ConnectionTab from "./components/ConnectionTab";
import CsvTab from "./components/CsvTab";
import MarketResearchTab from "./components/MarketResearchTab";
import { MOCK_MARKET_DATA } from "./mockMarketData";

const startKey = new Date().toISOString().slice(0, 10);

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("market_research"); // デフォルトを市場調査に
  const [loading, setLoading] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [notice, setNotice] = useState<string>("デモ環境が起動しました");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // ステート群
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [prices, setPrices] = useState<CalendarPrice[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [pmsActuals, setPmsActuals] = useState<PmsActual[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRules>(defaultRules);
  const [marketResearchData, setMarketResearchData] = useState<MarketResearchData[]>([]);

  // 外部システム連携ステート
  const [connectionSettings, setConnectionSettings] = useState<ConnectionSettings>({

    stayseeApiKey: "",
    stayseeHotelId: "",
    stayseeConnected: false,
    neppanAuthId: "",
    neppanPassword: "",
    neppanConnected: false
  });
  const [connectionLogs, setConnectionLogs] = useState<ConnectionLog[]>([]);

  // 最終再計算時刻
  const [lastCalcTime, setLastCalcTime] = useState<string>("");

  // 価格調整モーダルステート
  const [adjustModalOpen, setAdjustModalOpen] = useState<boolean>(false);
  const [adjustProposal, setAdjustProposal] = useState<Proposal | null>(null);
  const [adjustPrice, setAdjustPrice] = useState<number>(0);

  // 初期ロード
  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = () => {
    setLoading(true);
    try {
      // 1. 部屋タイプの取得（ブランド方針書：平日2食付11,000円〜、休日プレミアム＋1,500円に完全準拠）
      const rooms: RoomType[] = [
        { id: "premium-suite", name: "【禁煙】プレミアムスイート（ペット不可）", inventory: 1, capacity: 6, baseRateWeekday: 18000, baseRateWeekend: 19500, minPrice: 14000, maxPrice: 28000 },
        { id: "petit-suite", name: "【禁煙】プチスイート２０２号室（ペット可・バス付）", inventory: 1, capacity: 4, baseRateWeekday: 14000, baseRateWeekend: 15500, minPrice: 11000, maxPrice: 22000 },
        { id: "compact-room", name: "【禁煙】おしゃれなコンパクトルーム（ペット不可）", inventory: 1, capacity: 2, baseRateWeekday: 11000, baseRateWeekend: 12500, minPrice: 8500, maxPrice: 18000 },
        { id: "riverview-bath", name: "【禁煙】リバービューが素敵な和室１０畳（バス付）", inventory: 2, capacity: 5, baseRateWeekday: 13000, baseRateWeekend: 14500, minPrice: 10000, maxPrice: 20000 },
        { id: "japanese-toilet", name: "【禁煙】和室１０畳（トイレ付・ペット不可）", inventory: 2, capacity: 5, baseRateWeekday: 11000, baseRateWeekend: 12500, minPrice: 8500, maxPrice: 18000 },
        { id: "japanese-pet", name: "【禁煙】和室１０畳（ペットと泊まろう♪）", inventory: 2, capacity: 5, baseRateWeekday: 13000, baseRateWeekend: 14500, minPrice: 10000, maxPrice: 20000 },
        { id: "japanese-bedroom", name: "【禁煙】和室１０畳ベッドルーム（１階）", inventory: 1, capacity: 4, baseRateWeekday: 11000, baseRateWeekend: 12500, minPrice: 8500, maxPrice: 18000 }
      ];
      setRoomTypes(rooms);

      // 2. 価格設定ルールの取得
      const rules = defaultRules;
      setPricingRules(rules);

      // 3. カレンダー算出価格の取得（LocalStorage優先。古い高額シミュレーションデータがある場合はリセット）
      const savedPrices = localStorage.getItem("demo_calendar_prices");
      let pricesList: CalendarPrice[] = [];
      if (savedPrices) {
        pricesList = JSON.parse(savedPrices);
        const hasOldData = pricesList.some(p => p.roomTypeId === "compact-room" && p.price > 14000);
        if (hasOldData) {
          pricesList = generateBaseCalendarPrices(rooms, rules);
          localStorage.setItem("demo_calendar_prices", JSON.stringify(pricesList));
          localStorage.removeItem("demo_proposals");
        }
      } else {
        pricesList = generateBaseCalendarPrices(rooms, rules);
        localStorage.setItem("demo_calendar_prices", JSON.stringify(pricesList));
      }
      setPrices(pricesList);

      // 4. 価格提案の取得（LocalStorage優先）
      const savedProposals = localStorage.getItem("demo_proposals");
      let proposalsList: Proposal[] = [];
      if (savedProposals) {
        proposalsList = JSON.parse(savedProposals);
      } else {
        proposalsList = generateMockProposals(rooms, pricesList);
        localStorage.setItem("demo_proposals", JSON.stringify(proposalsList));
      }
      setProposals(proposalsList);

      // 5. 承認履歴の取得
      setHistory([]);

      // 6. PMS実績データの取得
      const savedPmsActuals = localStorage.getItem("demo_pms_actuals");
      if (savedPmsActuals) {
        setPmsActuals(JSON.parse(savedPmsActuals));
      } else {
        setPmsActuals([]);
      }

      // 最終更新時間
      const timeStr = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
      setLastCalcTime(timeStr);

      // 7. 外部システム連携設定の取得
      const savedSettings = localStorage.getItem("demo_connection_settings");
      if (savedSettings) {
        setConnectionSettings(JSON.parse(savedSettings));
      } else {
        setConnectionSettings({
          stayseeApiKey: "", stayseeHotelId: "", stayseeConnected: false,
          neppanAuthId: "", neppanPassword: "", neppanConnected: false
        });
      }

      // 8. 外部同期ログの取得
      const savedLogs = localStorage.getItem("demo_connection_logs");
      if (savedLogs) {
        setConnectionLogs(JSON.parse(savedLogs));
      } else {
        const initialLogs: ConnectionLog[] = [
          { id: "conn-log-1", timestamp: new Date(Date.now() - 1000 * 60 * 30).toLocaleString("ja-JP"), system: "staysee", action: "接続テスト", status: "success", detail: "Staysee PMS API 疎通テスト成功。接続を維持しています。" },
          { id: "conn-log-2", timestamp: new Date(Date.now() - 1000 * 60 * 15).toLocaleString("ja-JP"), system: "neppan", action: "XML接続確認", status: "success", detail: "ねっぱん！ サイトコントローラー双方向通信接続疎通成功。" }
        ];
        setConnectionLogs(initialLogs);
        localStorage.setItem("demo_connection_logs", JSON.stringify(initialLogs));
      }

      // 9. 市場調査データの取得
      const savedMarket = localStorage.getItem("demo_market_research");
      if (savedMarket) {
        setMarketResearchData(JSON.parse(savedMarket));
      } else {
        setMarketResearchData(MOCK_MARKET_DATA);
        localStorage.setItem("demo_market_research", JSON.stringify(MOCK_MARKET_DATA));
      }

    } catch (e) {
      console.error(e);
      setNotice("データのロード中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMarketResearchData = (newData: MarketResearchData[]) => {
    // 既存データとマージ（IDで一意に上書き）
    const merged = [...marketResearchData];
    newData.forEach(newItem => {
      const idx = merged.findIndex(d => d.id === newItem.id);
      if (idx >= 0) {
        merged[idx] = newItem;
      } else {
        merged.push(newItem);
      }
    });
    setMarketResearchData(merged);
    try {
      localStorage.setItem("demo_market_research", JSON.stringify(merged));
    } catch (e) {
      console.warn("Storage access blocked", e);
    }
    setNotice("市場調査データを保存しました");
  };

  // 基盤カレンダー初期価格生成 (45日分)
  const generateBaseCalendarPrices = (roomsList: RoomType[], rules: PricingRules) => {
    const pricesList: CalendarPrice[] = [];
    const today = new Date();

    for (let i = 0; i < 45; i++) {
      const currentDate = new Date(today);
      currentDate.setDate(today.getDate() + i);
      const dateKey = currentDate.toISOString().slice(0, 10);
      const dayOfWeek = currentDate.getDay().toString();
      const month = (currentDate.getMonth() + 1).toString();

      // 疑似的な稼働率の波
      const seed = (currentDate.getDate() * 7 + currentDate.getMonth() * 3) % 100;
      const occupancyRate = (35 + (seed % 55)) / 100; // 35% - 90%
      const targetOccupancy = 0.60;

      roomsList.forEach((room) => {
        const isWeekend = dayOfWeek === "5" || dayOfWeek === "6";
        let price = isWeekend ? room.baseRateWeekend : room.baseRateWeekday;

        // 曜日
        const weekdayFactor = rules.weekdayFactors[dayOfWeek] || 0;
        price = price * (1 + weekdayFactor);

        // 季節
        const seasonFactor = rules.seasonality[month] || 0;
        price = price * (1 + seasonFactor);

        // 稼働率
        const diff = occupancyRate - targetOccupancy;
        let factor = 0;
        if (diff < -0.1) {
          factor = -rules.weakWeekdayDiscountMaxPct;
        } else if (diff > 0.1) {
          factor = rules.strongDemandMarkupMaxPct;
        }
        price = price * (1 + factor);
        price = Math.round(price / 100) * 100; // 100円丸め

        // 最低・最高クランプ
        let isMinClamped = false;
        let isMaxClamped = false;
        if (room.minPrice !== undefined && price < room.minPrice) {
          price = room.minPrice;
          isMinClamped = true;
        }
        if (room.maxPrice !== undefined && price > room.maxPrice) {
          price = room.maxPrice;
          isMaxClamped = true;
        }

        const tags: string[] = [];
        if (isMinClamped) {
          tags.push("最低価格制限");
        } else if (isMaxClamped) {
          tags.push("最高価格制限");
        } else {
          if (diff < -0.1) {
            tags.push(i <= 7 ? "直前割引" : "低稼働割引");
          } else if (diff > 0.1) {
            tags.push("高需要値上げ");
          }
        }

        pricesList.push({
          id: `${dateKey}-${room.id}`,
          dateKey,
          roomTypeId: room.id,
          price,
          occupancyRate,
          targetOccupancy,
          leadDays: i,
          tags
        });
      });
    }
    return pricesList;
  };

  // ダミーのAI提案を生成
  const generateMockProposals = (roomsList: RoomType[], pricesList: CalendarPrice[]) => {
    const proposalsList: Proposal[] = [];
    const today = new Date();

    // 直近7日間のいくつかの部屋について、値上げ・値下げのAI提案を出す
    for (let i = 1; i <= 10; i++) {
      const currentDate = new Date(today);
      currentDate.setDate(today.getDate() + i);
      const dateKey = currentDate.toISOString().slice(0, 10);

      roomsList.slice(0, 3).forEach((room, rIdx) => {
        const calPrice = pricesList.find((p) => p.dateKey === dateKey && p.roomTypeId === room.id);
        if (!calPrice) return;

        // 推奨価格 (少し変動させる)
        const isUp = (i + rIdx) % 2 === 0;
        const diffAmount = isUp ? 2000 : -1500;
        const proposedPrice = calPrice.price + diffAmount;

        let reason = isUp ? "周辺宿のペット同伴室完売に伴う値上げ" : "平日のリードタイム不足による早期割引";
        if (room.id === "japanese-pet" && isUp) {
          reason = "猫好きゲストの週末予約集中に伴う価格最適化";
        } else if (room.id === "compact-room" && !isUp) {
          reason = "静養目的の長期滞在ゲスト呼び込み用割引";
        }

        proposalsList.push({
          id: `prop-${dateKey}-${room.id}`,
          dateKey,
          roomTypeId: room.id,
          currentPrice: calPrice.price,
          proposedPrice,
          changeReason: reason,
          confidence: 75 + ((i * 7 + rIdx * 9) % 23), // 75% - 98%
          status: "pending"
        });
      });
    }

    return proposalsList;
  };

  // 全計算（価格再計算）の実行
  const runPricingEngine = async () => {
    setBusy(true);
    setNotice("価格計算エンジンを実行中...");
    
    // 疑似的なディレイ
    await new Promise((resolve) => setTimeout(resolve, 1500));

    try {
      // カレンダー価格をルールに基づいて再生成
      const updatedPrices = generateBaseCalendarPrices(roomTypes, pricingRules);
      setPrices(updatedPrices);
      localStorage.setItem("demo_calendar_prices", JSON.stringify(updatedPrices));

      // 提案の再作成 (以前の pending を消去して再生成)
      const newProposals = generateMockProposals(roomTypes, updatedPrices);
      setProposals(newProposals);
      localStorage.setItem("demo_proposals", JSON.stringify(newProposals));

      // 最終更新時間の保存
      const timeStr = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
      setLastCalcTime(timeStr);
      localStorage.setItem("demo_last_calc_time", timeStr);

      setNotice("価格提案および今後45日間の価格設定を再計算しました");
    } catch (e) {
      console.error(e);
      setNotice("価格計算中にエラーが発生しました");
    } finally {
      setBusy(false);
    }
  };

  // サンプルデータの初期化（初期シード）
  const handleSeedData = () => {
    localStorage.removeItem("demo_room_types");
    localStorage.removeItem("demo_pricing_rules");
    localStorage.removeItem("demo_calendar_prices");
    localStorage.removeItem("demo_proposals");
    localStorage.removeItem("demo_history");
    localStorage.removeItem("demo_pms_actuals");
    localStorage.removeItem("demo_last_calc_time");
    localStorage.removeItem("demo_connection_settings");
    localStorage.removeItem("demo_connection_logs");
    setHistory([]);
    setPmsActuals([]);
    setConnectionSettings({
      stayseeApiKey: "",
      stayseeHotelId: "",
      stayseeConnected: false,
      neppanAuthId: "",
      neppanPassword: "",
      neppanConnected: false
    });
    
    loadAll();
    setNotice("デモ用サンプルデータを完全に初期化しました");
  };

  // 価格提案の承認
  const handleApproveProposal = (proposalId: string, finalPrice?: number) => {
    const propIndex = proposals.findIndex((p) => p.id === proposalId);
    if (propIndex === -1) return;

    const prop = proposals[propIndex];
    const newPrice = finalPrice !== undefined ? finalPrice : prop.proposedPrice;

    // 1. カレンダー価格の更新
    const updatedPrices = prices.map((dp) => {
      if (dp.dateKey === prop.dateKey && dp.roomTypeId === prop.roomTypeId) {
        const diff = newPrice - dp.price;
        const updatedTags = [...(dp.tags || [])];
        if (!updatedTags.includes("AI承認済み")) {
          updatedTags.push("AI承認済み");
        }
        return {
          ...dp,
          price: newPrice,
          tags: updatedTags
        };
      }
      return dp;
    });
    setPrices(updatedPrices);
    localStorage.setItem("demo_calendar_prices", JSON.stringify(updatedPrices));

    // 2. 提案ステータスの更新
    const updatedProposals = proposals.map((p) =>
      p.id === proposalId ? { ...p, status: "approved" as const } : p
    );
    setProposals(updatedProposals);
    localStorage.setItem("demo_proposals", JSON.stringify(updatedProposals));

    // 3. 履歴の追加
    const timestamp = new Date().toLocaleString("ja-JP");
    const diff = newPrice - prop.currentPrice;
    const historyEntry: HistoryEntry = {
      id: `hist-${Date.now()}`,
      timestamp,
      dateKey: prop.dateKey,
      roomTypeId: prop.roomTypeId,
      oldPrice: prop.currentPrice,
      newPrice,
      difference: diff,
      reason: prop.changeReason,
      status: "approved",
      operator: "デモ管理者"
    };

    const newHistory = [historyEntry, ...history];
    setHistory(newHistory);
    localStorage.setItem("demo_history", JSON.stringify(newHistory));

    setNotice(`${prop.dateKey}の客室価格を承認・反映しました`);
  };

  // 価格提案の却下
  const handleRejectProposal = (proposalId: string) => {
    const propIndex = proposals.findIndex((p) => p.id === proposalId);
    if (propIndex === -1) return;

    const prop = proposals[propIndex];

    // 1. 提案ステータスの更新
    const updatedProposals = proposals.map((p) =>
      p.id === proposalId ? { ...p, status: "rejected" as const } : p
    );
    setProposals(updatedProposals);
    localStorage.setItem("demo_proposals", JSON.stringify(updatedProposals));

    // 2. 履歴の追加
    const timestamp = new Date().toLocaleString("ja-JP");
    const historyEntry: HistoryEntry = {
      id: `hist-${Date.now()}`,
      timestamp,
      dateKey: prop.dateKey,
      roomTypeId: prop.roomTypeId,
      oldPrice: prop.currentPrice,
      newPrice: prop.currentPrice,
      difference: 0,
      reason: prop.changeReason,
      status: "rejected",
      operator: "デモ管理者"
    };

    const newHistory = [historyEntry, ...history];
    setHistory(newHistory);
    localStorage.setItem("demo_history", JSON.stringify(newHistory));

    setNotice(`${prop.dateKey}の客室価格提案を却下しました`);
  };

  // 価格提案の一括承認
  const handleApproveAll = (filteredPops: Proposal[]) => {
    if (filteredPops.length === 0) return;

    let updatedPrices = [...prices];
    const addedHistory: HistoryEntry[] = [];
    const timestamp = new Date().toLocaleString("ja-JP");

    filteredPops.forEach((prop) => {
      // カレンダー更新
      updatedPrices = updatedPrices.map((dp) => {
        if (dp.dateKey === prop.dateKey && dp.roomTypeId === prop.roomTypeId) {
          const updatedTags = [...(dp.tags || [])];
          if (!updatedTags.includes("AI承認済み")) {
            updatedTags.push("AI承認済み");
          }
          return {
            ...dp,
            price: prop.proposedPrice,
            tags: updatedTags
          };
        }
        return dp;
      });

      // 履歴登録
      addedHistory.push({
        id: `hist-${Date.now()}-${prop.id}`,
        timestamp,
        dateKey: prop.dateKey,
        roomTypeId: prop.roomTypeId,
        oldPrice: prop.currentPrice,
        newPrice: prop.proposedPrice,
        difference: prop.proposedPrice - prop.currentPrice,
        reason: prop.changeReason,
        status: "approved",
        operator: "デモ管理者"
      });
    });

    setPrices(updatedPrices);
    localStorage.setItem("demo_calendar_prices", JSON.stringify(updatedPrices));

    // 提案ステータスの更新
    const idsToApprove = filteredPops.map((p) => p.id);
    const updatedProposals = proposals.map((p) =>
      idsToApprove.includes(p.id) ? { ...p, status: "approved" as const } : p
    );
    setProposals(updatedProposals);
    localStorage.setItem("demo_proposals", JSON.stringify(updatedProposals));

    // 履歴追加
    const newHistory = [...addedHistory, ...history];
    setHistory(newHistory);
    localStorage.setItem("demo_history", JSON.stringify(newHistory));

    setNotice(`${filteredPops.length} 件の価格提案を一括承認しました`);
  };

  // カレンダーからの直接価格手動更新
  const handleUpdateCalendarPrice = (dateKey: string, roomTypeId: string, newPrice: number) => {
    const currentPriceObj = prices.find((p) => p.dateKey === dateKey && p.roomTypeId === roomTypeId);
    const oldPrice = currentPriceObj ? currentPriceObj.price : 0;

    // 1. カレンダー価格の更新
    const updatedPrices = prices.map((dp) => {
      if (dp.dateKey === dateKey && dp.roomTypeId === roomTypeId) {
        const updatedTags = [...(dp.tags || [])];
        if (!updatedTags.includes("手動調整")) {
          updatedTags.push("手動調整");
        }
        return {
          ...dp,
          price: newPrice,
          tags: updatedTags
        };
      }
      return dp;
    });
    setPrices(updatedPrices);
    localStorage.setItem("demo_calendar_prices", JSON.stringify(updatedPrices));

    // 2. もし未承認提案がその日程・部屋にあれば承認済みにする
    const relatedProp = proposals.find((p) => p.dateKey === dateKey && p.roomTypeId === roomTypeId && p.status === "pending");
    if (relatedProp) {
      const updatedProposals = proposals.map((p) =>
        p.id === relatedProp.id ? { ...p, status: "approved" as const, proposedPrice: newPrice } : p
      );
      setProposals(updatedProposals);
      localStorage.setItem("demo_proposals", JSON.stringify(updatedProposals));
    }

    // 3. 履歴への追加
    const timestamp = new Date().toLocaleString("ja-JP");
    const historyEntry: HistoryEntry = {
      id: `hist-${Date.now()}`,
      timestamp,
      dateKey,
      roomTypeId,
      oldPrice,
      newPrice,
      difference: newPrice - oldPrice,
      reason: "カレンダーからの直接料金手動更新",
      status: "approved",
      operator: "デモ管理者"
    };
    const newHistory = [historyEntry, ...history];
    setHistory(newHistory);
    localStorage.setItem("demo_history", JSON.stringify(newHistory));

    setNotice(`${dateKey}の客室単価を手動変更しました (¥${newPrice.toLocaleString("ja-JP")})`);
  };

  // 部屋タイプ設定の更新（最低/最高価格および基準単価）
  const handleUpdateRoomPriceLimits = (
    roomId: string,
    minPrice: number,
    maxPrice: number,
    baseWeekday: number,
    baseWeekend: number
  ) => {
    const updated = roomTypes.map((r) =>
      r.id === roomId
        ? {
            ...r,
            minPrice,
            maxPrice,
            baseRateWeekday: baseWeekday,
            baseRateWeekend: baseWeekend
          }
        : r
    );
    setRoomTypes(updated);
    localStorage.setItem("demo_room_types", JSON.stringify(updated));

    // カレンダー再計算を実行して即座に反映
    const updatedPrices = generateBaseCalendarPrices(updated, pricingRules);
    setPrices(updatedPrices);
    localStorage.setItem("demo_calendar_prices", JSON.stringify(updatedPrices));

    setNotice("客室基準価格および最低/最高制限設定を更新し、料金を再クランプしました");
  };

  // 価格設定ルールの保存とエンジン実行
  const handleSaveRules = (newRules: PricingRules) => {
    setPricingRules(newRules);
    localStorage.setItem("demo_pricing_rules", JSON.stringify(newRules));

    // 設定ルールに基づいた自動再計算
    const updatedPrices = generateBaseCalendarPrices(roomTypes, newRules);
    setPrices(updatedPrices);
    localStorage.setItem("demo_calendar_prices", JSON.stringify(updatedPrices));

    // 提案の再作成
    const newProposals = generateMockProposals(roomTypes, updatedPrices);
    setProposals(newProposals);
    localStorage.setItem("demo_proposals", JSON.stringify(newProposals));

    setNotice("需要調整ルール設定を保存し、カレンダーを再計算しました");
  };

  // PMS実績データのインポート
  const handleAddPmsActual = (actual: Omit<PmsActual, "id">) => {
    const newActual: PmsActual = {
      id: `act-${Date.now()}`,
      ...actual
    };
    const updated = [newActual, ...pmsActuals];
    setPmsActuals(updated);
    localStorage.setItem("demo_pms_actuals", JSON.stringify(updated));
  };

  const handleClearPmsActuals = () => {
    setPmsActuals([]);
    localStorage.removeItem("demo_pms_actuals");
  };

  const handleImportCsv = (csvRows: any[]) => {
    const timestamp = Date.now();
    const newActuals: PmsActual[] = csvRows.map((r, idx) => ({
      id: `act-csv-${timestamp}-${idx}`,
      dateKey: r.dateKey,
      roomTypeId: r.roomTypeId,
      soldRooms: r.soldRooms,
      occupancyRate: r.occupancyRate,
      adr: r.adr,
      channel: r.channel,
      leadTime: 10,
      cancelCount: 0
    }));

    const updated = [...newActuals, ...pmsActuals];
    setPmsActuals(updated);
    localStorage.setItem("demo_pms_actuals", JSON.stringify(updated));

    // CSV取り込み契機によるダミーの需要高騰による価格変更提案を数件作成して充実させる
    if (newActuals.length > 0) {
      const demoProp: Proposal = {
        id: `prop-csv-trigger-${Date.now()}`,
        dateKey: newActuals[0].dateKey,
        roomTypeId: newActuals[0].roomTypeId,
        currentPrice: newActuals[0].adr,
        proposedPrice: Math.round((newActuals[0].adr * 1.15) / 100) * 100,
        changeReason: "CSV予約実績取り込みによる需要スパイク検出",
        confidence: 91,
        status: "pending"
      };
      setProposals([demoProp, ...proposals]);
    }
  };

  // 調整用モーダルオープン
  const handleOpenAdjustModal = (proposal: Proposal) => {
    setAdjustProposal(proposal);
    setAdjustPrice(proposal.proposedPrice);
    setAdjustModalOpen(true);
  };

  // モーダルからの承認確定
  const handleConfirmAdjustApprove = () => {
    if (!adjustProposal) return;
    handleApproveProposal(adjustProposal.id, adjustPrice);
    setAdjustModalOpen(false);
    setAdjustProposal(null);
  };

  // 外部システム連携設定の保存
  const handleSaveConnectionSettings = (settings: ConnectionSettings) => {
    setConnectionSettings(settings);
    localStorage.setItem("demo_connection_settings", JSON.stringify(settings));

    const timestamp = new Date().toLocaleString("ja-JP");
    const isStayseeReg = settings.stayseeConnected && !connectionSettings.stayseeConnected;
    const isNeppanReg = settings.neppanConnected && !connectionSettings.neppanConnected;

    const newLogs = [...connectionLogs];
    if (isStayseeReg) {
      newLogs.unshift({
        id: `conn-log-${Date.now()}-staysee`,
        timestamp,
        system: "staysee",
        action: "接続初期設定",
        status: "success",
        detail: `Staysee (Hotel ID: ${settings.stayseeHotelId}) 接続初期疎通テスト成功。認証トークンを確認しました。`
      });
    }
    if (isNeppanReg) {
      newLogs.unshift({
        id: `conn-log-${Date.now()}-neppan`,
        timestamp,
        system: "neppan",
        action: "XML初期設定",
        status: "success",
        detail: `ねっぱん！ (Hotel Code: ${settings.neppanAuthId}) サイトコントローラーXML通信認証完了。`
      });
    }

    if (isStayseeReg || isNeppanReg) {
      setConnectionLogs(newLogs);
      localStorage.setItem("demo_connection_logs", JSON.stringify(newLogs));
    }
  };

  // Staysee予約同期実行
  const handleSyncStaysee = async () => {
    setBusy(true);
    setNotice("Staysee PMSから最新の予約情報を同期中...");
    await new Promise((resolve) => setTimeout(resolve, 1500));

    try {
      const timestamp = new Date().toLocaleString("ja-JP");

      // 疑似的に本日以降のいくつかの部屋の予測稼働率を少し引き上げ、自動価格再計算を行う
      // これにより、予約同期されたことでダイナミックプライシングが動き、推奨価格が上がる体験を再現する
      const targetDays = [0, 1, 2, 3, 4].map(offset => {
        const d = new Date();
        d.setDate(d.getDate() + offset);
        return d.toISOString().slice(0, 10);
      });

      // 稼働状況を更新
      const updatedPrices = prices.map((dp) => {
        if (targetDays.includes(dp.dateKey)) {
          // 稼働率を 15% 上昇させる (最大 1.0)
          const newOcc = Math.min(dp.occupancyRate + 0.15, 1.0);
          
          // ルールに従って推奨単価を再計算
          const room = roomTypes.find(r => r.id === dp.roomTypeId);
          if (room) {
            const isWeekend = new Date(dp.dateKey).getDay() === 5 || new Date(dp.dateKey).getDay() === 6;
            let price = isWeekend ? room.baseRateWeekend : room.baseRateWeekday;
            
            // 補正
            const weekdayFactor = pricingRules.weekdayFactors[new Date(dp.dateKey).getDay().toString()] || 0;
            price = price * (1 + weekdayFactor);
            const month = (new Date(dp.dateKey).getMonth() + 1).toString();
            const seasonFactor = pricingRules.seasonality[month] || 0;
            price = price * (1 + seasonFactor);

            // 稼働率による補正
            const diff = newOcc - dp.targetOccupancy;
            let factor = 0;
            if (diff < -0.1) {
              factor = -pricingRules.weakWeekdayDiscountMaxPct;
            } else if (diff > 0.1) {
              factor = pricingRules.strongDemandMarkupMaxPct;
            }
            price = price * (1 + factor);
            price = Math.round(price / 100) * 100;

            // クランプ
            if (room.minPrice !== undefined && price < room.minPrice) price = room.minPrice;
            if (room.maxPrice !== undefined && price > room.maxPrice) price = room.maxPrice;

            return {
              ...dp,
              occupancyRate: newOcc,
              price
            };
          }
        }
        return dp;
      });

      setPrices(updatedPrices);
      localStorage.setItem("demo_calendar_prices", JSON.stringify(updatedPrices));

      // 提案も連動更新する
      const newProposals = generateMockProposals(roomTypes, updatedPrices);
      setProposals(newProposals);
      localStorage.setItem("demo_proposals", JSON.stringify(newProposals));

      // ログ追加
      const newLog: ConnectionLog = {
        id: `conn-log-${Date.now()}`,
        timestamp,
        system: "staysee",
        action: "予約データ同期",
        status: "success",
        detail: `Stayseeから予約リスト取得成功。新規予約14件（猫ルーム予約5件含む）を取り込み、需要モデルを更新しました。`
      };
      const updatedLogs = [newLog, ...connectionLogs];
      setConnectionLogs(updatedLogs);
      localStorage.setItem("demo_connection_logs", JSON.stringify(updatedLogs));

      setNotice("Staysee PMSから最新の予約同期を完了し、需要と価格を再評価しました");
    } catch (e) {
      console.error(e);
      setNotice("Staysee同期中に通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  };

  // ねっぱん料金送信同期実行
  const handleSyncNeppan = async () => {
    setBusy(true);
    setNotice("ねっぱん！ XMLへ料金テーブルを同期送信中...");
    await new Promise((resolve) => setTimeout(resolve, 1800));

    try {
      const timestamp = new Date().toLocaleString("ja-JP");

      // ログ追加
      const newLog: ConnectionLog = {
        id: `conn-log-${Date.now()}`,
        timestamp,
        system: "neppan",
        action: "料金同期送信",
        status: "success",
        detail: `ねっぱん！ XML-APIへ料金テーブル送信完了。全7部屋タイプ・今後45日間分の料金（合計315件）の適用を確認。`
      };
      const updatedLogs = [newLog, ...connectionLogs];
      setConnectionLogs(updatedLogs);
      localStorage.setItem("demo_connection_logs", JSON.stringify(updatedLogs));

      setNotice("確定価格データをねっぱん！へ同期送信完了しました");
    } catch (e) {
      console.error(e);
      setNotice("ねっぱん！への通信同期中にエラーが発生しました");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>データロード中...</p>
        </div>
      </div>
    );
  }

  // アクティブなタブページのレンダリング
  const renderActiveTab = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <DashboardTab
            roomTypes={roomTypes}
            prices={prices}
            proposals={proposals}
            onApprove={handleApproveProposal}
            onReject={handleRejectProposal}
            onOpenAdjustModal={handleOpenAdjustModal}
            switchTab={setActiveTab}
          />
        );
      case "proposals":
        return (
          <ProposalsTab
            roomTypes={roomTypes}
            proposals={proposals}
            onApprove={handleApproveProposal}
            onReject={handleRejectProposal}
            onApproveAll={handleApproveAll}
            onOpenAdjustModal={handleOpenAdjustModal}
          />
        );
      case "calendar":
        return (
          <CalendarTab
            roomTypes={roomTypes}
            prices={prices}
            proposals={proposals}
            onUpdateCalendarPrice={handleUpdateCalendarPrice}
            onApproveProposal={handleApproveProposal}
          />
        );
      case "history":
        return <HistoryTab roomTypes={roomTypes} history={history} />;
      case "settings":
        return (
          <SettingsTab
            roomTypes={roomTypes}
            pricingRules={pricingRules}
            onUpdateRoomPriceLimits={handleUpdateRoomPriceLimits}
            onSaveRules={handleSaveRules}
          />
        );
      case "connection":
        return (
          <ConnectionTab
            connectionSettings={connectionSettings}
            connectionLogs={connectionLogs}
            onSaveConnectionSettings={handleSaveConnectionSettings}
            onSyncStaysee={handleSyncStaysee}
            onSyncNeppan={handleSyncNeppan}
            busy={busy}
          />
        );
      case "csv":
        return (
          <CsvTab
            roomTypes={roomTypes}
            pmsActuals={pmsActuals}
            onAddPmsActual={handleAddPmsActual}
            onClearPmsActuals={handleClearPmsActuals}
            onImportCsv={handleImportCsv}
          />
        );
      case "market_research":
        return (
          <MarketResearchTab
            researchData={marketResearchData}
            onSaveData={handleSaveMarketResearchData}
          />
        );
      default:
        return <div>タブがありません</div>;
    }
  };

  // 未承認提案総数
  const pendingCount = proposals.filter((p) => p.status === "pending").length;

  return (
    <div className="app-container">
      {/* サイドバー */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingProposalsCount={pendingCount}
        lastCalcTime={lastCalcTime}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {/* メインコンテンツ */}
      <main className="main-content">
        <header className="topbar">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(true)}>
            <i className="fas fa-bars"></i>
          </button>
          <div className="topbar-title">
            <span className="brand-label">赤沢温泉旅館 自動価格調整システム</span>
            <span className="page-label">
              |{" "}
              {activeTab === "dashboard"
                ? "ダッシュボード"
                : activeTab === "proposals"
                ? "価格提案"
                : activeTab === "calendar"
                ? "カレンダー"
                : activeTab === "history"
                ? "承認履歴"
                : activeTab === "settings"
                ? "ルール設定"
                : activeTab === "connection"
                ? "外部システム連携"
                : "実績データ取り込み"}
            </span>
          </div>

          <div className="topbar-actions">
            <span className="status" style={{ fontWeight: 600, fontSize: "13px" }}>
              {notice}
            </span>
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={runPricingEngine}>
              <i className="fas fa-sync-alt"></i> 再計算
            </button>
            <button className="btn btn-outline btn-sm" onClick={handleSeedData}>
              デモ初期化
            </button>
            <div className="topbar-date">
              <i className="fas fa-user-circle"></i>
              <span>デモ管理者</span>
            </div>
          </div>
        </header>

        {renderActiveTab()}
      </main>

      {/* 最終調整モーダル */}
      {adjustModalOpen && adjustProposal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>手動価格調整の反映確認</h2>
              <button className="modal-close" onClick={() => setAdjustModalOpen(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: "14px", lineHeight: "1.5", marginBottom: "16px", color: "var(--text)" }}>
                <strong>
                  {roomTypes.find((r) => r.id === adjustProposal.roomTypeId)?.name ||
                    adjustProposal.roomTypeId}
                </strong>
                の {adjustProposal.dateKey} に対するAI算出価格を調整します。
              </p>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  background: "var(--bg-app)",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  marginBottom: "20px"
                }}
              >
                <span>現在価格: ¥{adjustProposal.currentPrice.toLocaleString("ja-JP")}</span>
                <span style={{ color: "var(--primary)", fontWeight: "bold" }}>
                  AI提案推奨: ¥{adjustProposal.proposedPrice.toLocaleString("ja-JP")}
                </span>
              </div>

              <div className="modal-price-adjust">
                <label>最終反映価格（任意に手動微調整可能）</label>
                <div className="price-adjust-row">
                  <span className="currency" style={{ fontSize: "20px", fontWeight: "bold" }}>
                    ¥
                  </span>
                  <input
                    type="number"
                    value={adjustPrice}
                    onChange={(e) => setAdjustPrice(parseInt(e.target.value) || 0)}
                    className="price-input-big"
                    step="500"
                  />
                  <span className="price-range-hint">
                    ※ 500円単位で丸めて適用されます
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <div className="modal-btns">
                <button className="btn btn-outline" onClick={() => setAdjustModalOpen(false)}>
                  キャンセル
                </button>
                <button className="btn btn-success" onClick={handleConfirmAdjustApprove}>
                  <i className="fas fa-check"></i> この価格で承認反映する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ローディングスピナーオーバーレイ */}
      {busy && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p style={{ fontWeight: 700, fontSize: "14px" }}>自動価格決定エンジン稼働中...</p>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              過去3年の実績トレンドおよび直近稼働率に基づいて最適価格を算出しています
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
