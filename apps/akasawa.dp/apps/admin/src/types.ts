export type RoomType = {
  id: string;
  name: string;
  inventory: number;
  capacity: number;
  baseRateWeekday: number;
  baseRateWeekend: number;
  minPrice?: number;
  maxPrice?: number;
  active?: boolean;
  manualBoostPct?: number;
};

export type PricingRules = {
  horizonDays: number;
  defaultMinPriceMultiplier: number;
  defaultMaxPriceMultiplier: number;
  weakWeekdayDiscountMaxPct: number;
  strongDemandMarkupMaxPct: number;
  earlyBirdWeekdayPct: number;
  lastMinuteWeekdayPct: number;
  earlyBirdWindowStart: number;
  earlyBirdWindowEnd: number;
  weekdayFactors: Record<string, number>;
  seasonality: Record<string, number>;
  targetOccupancyByLead: Record<string, { weekday: number; weekend: number }>;
  maxChangeUp?: number;
  maxChangeDown?: number;
};

export type CalendarPrice = {
  id: string;
  dateKey: string;
  roomTypeId: string;
  price: number;
  occupancyRate: number;
  targetOccupancy: number;
  leadDays: number;
  tags: string[];
};

export type Proposal = {
  id: string;
  dateKey: string;
  roomTypeId: string;
  currentPrice: number;
  proposedPrice: number;
  changeReason: string;
  confidence: number; // 0 to 100
  status: "pending" | "approved" | "rejected";
};

export type HistoryEntry = {
  id: string;
  timestamp: string;
  dateKey: string;
  roomTypeId: string;
  oldPrice: number;
  newPrice: number;
  difference: number;
  reason: string;
  status: "approved" | "rejected";
  operator: string;
};

export type PmsActual = {
  id: string;
  dateKey: string;
  roomTypeId: string;
  soldRooms: number;
  occupancyRate: number;
  adr: number;
  channel: string;
  leadTime: number;
  cancelCount: number;
};

export type ConnectionSettings = {
  stayseeApiKey: string;
  stayseeHotelId: string;
  stayseeConnected: boolean;
  neppanAuthId: string;
  neppanPassword: string;
  neppanConnected: boolean;
};

export type ConnectionLog = {
  id: string;
  timestamp: string;
  system: "staysee" | "neppan" | "system";
  action: string;
  status: "success" | "error" | "warning";
  detail: string;
};

export const defaultRules: PricingRules = {
  horizonDays: 120,
  defaultMinPriceMultiplier: 0.86,
  defaultMaxPriceMultiplier: 1.35,
  weakWeekdayDiscountMaxPct: 0.12,
  strongDemandMarkupMaxPct: 0.25,
  earlyBirdWeekdayPct: -0.05,
  lastMinuteWeekdayPct: -0.06,
  earlyBirdWindowStart: 21,
  earlyBirdWindowEnd: 45,
  maxChangeUp: 5000,
  maxChangeDown: 3000,
  weekdayFactors: {
    "0": -0.02,
    "1": -0.05,
    "2": -0.04,
    "3": -0.03,
    "4": 0,
    "5": 0.08,
    "6": 0.1
  },
  seasonality: {
    "1": -0.02,
    "2": -0.03,
    "3": 0,
    "4": 0.02,
    "5": 0.05,
    "6": 0,
    "7": 0.08,
    "8": 0.15,
    "9": 0.03,
    "10": 0.02,
    "11": -0.02,
    "12": 0.12
  },
  targetOccupancyByLead: {
    "0-3": { weekday: 0.68, weekend: 0.9 },
    "4-7": { weekday: 0.58, weekend: 0.82 },
    "8-14": { weekday: 0.48, weekend: 0.72 },
    "15-30": { weekday: 0.42, weekend: 0.62 },
    "31-60": { weekday: 0.35, weekend: 0.54 },
    "61+": { weekday: 0.28, weekend: 0.46 }
  }
};

export type MarketResearchData = {
  id: string;                // Uniquely identifies the record (e.g. "2026-08-13-rakuten-majimaso")
  dateKey: string;           // Target date (e.g., "2026-08-13")
  ota: "rakuten" | "jalan";  // The OTA used
  hotelId: string;           // Competitor ID (e.g., "majimaso", "oku-kogen")
  price: number;             // 1名あたりの販売価格（税込。大人2名・1室利用時）
  lowPrice?: number;         // 10帖以外を含む1泊2食最安値価格
  status: "available" | "full" | "no_sales" | "few"; // Vacancy status
  planName: string;          // Name of the plan
  roomType: string;          // Room type name
  meals: string;             // Meals condition
  hasCoupon: boolean;        // Whether coupon exists
  hasCampaign: boolean;      // Whether OTA campaign exists
  hasPetPlan: boolean;       // Pet plan availability
  reviewAverage?: number;    // 顧客評価 (楽天評価)
  hotelInformationUrl?: string; // 楽天の旅館URL
  roomCount?: number;        // 販売部屋(プラン)数
  features: string[];        // Array of features (e.g., early_bird, last_minute)
  updatedAt: string;         // Timestamp of data collection
};
