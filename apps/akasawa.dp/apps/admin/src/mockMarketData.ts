import { MarketResearchData } from "./types";

export const MOCK_MARKET_DATA: MarketResearchData[] = [
  // 7/22 (通常日) - 楽天トラベル
  { id: "2026-07-22-rakuten-majimaso", dateKey: "2026-07-22", ota: "rakuten", hotelId: "majimaso", status: "available", price: 11000, planName: "スタンダード2食付", roomType: "和室", meals: "1泊2食", hasCoupon: false, hasCampaign: false, hasPetPlan: false, features: ["源泉かけ流し"], updatedAt: "2026-07-12T10:00:00Z" },
  { id: "2026-07-22-rakuten-yamaguciya", dateKey: "2026-07-22", ota: "rakuten", hotelId: "yamaguciya", status: "available", price: 12500, planName: "基本プラン", roomType: "和室10畳", meals: "1泊2食", hasCoupon: true, hasCampaign: false, hasPetPlan: false, features: [], updatedAt: "2026-07-12T10:00:00Z" },
  { id: "2026-07-22-rakuten-kamiaizuya", dateKey: "2026-07-22", ota: "rakuten", hotelId: "kamiaizuya", status: "available", price: 14000, planName: "【基本】会津屋御膳", roomType: "和室", meals: "1泊2食", hasCoupon: false, hasCampaign: false, hasPetPlan: false, features: [], updatedAt: "2026-07-12T10:00:00Z" },
  { id: "2026-07-22-rakuten-nuriya", dateKey: "2026-07-22", ota: "rakuten", hotelId: "nuriya", status: "few", price: 13200, planName: "1泊2食付スタンダード", roomType: "和室", meals: "1泊2食", hasCoupon: false, hasCampaign: true, hasPetPlan: false, features: [], updatedAt: "2026-07-12T10:00:00Z" },
  { id: "2026-07-22-rakuten-tokiwa", dateKey: "2026-07-22", ota: "rakuten", hotelId: "tokiwa", status: "available", price: 10500, planName: "お手軽プラン", roomType: "和室", meals: "1泊2食", hasCoupon: false, hasCampaign: false, hasPetPlan: false, features: [], updatedAt: "2026-07-12T10:00:00Z" },
  
  { id: "2026-07-22-rakuten-okukogen", dateKey: "2026-07-22", ota: "rakuten", hotelId: "okukogen", status: "available", price: 18000, planName: "高原リゾート満喫", roomType: "洋室", meals: "1泊2食", hasCoupon: true, hasCampaign: false, hasPetPlan: false, features: [], updatedAt: "2026-07-12T10:00:00Z" },
  { id: "2026-07-22-rakuten-shimofujiya", dateKey: "2026-07-22", ota: "rakuten", hotelId: "shimofujiya", status: "few", price: 16500, planName: "山菜づくし", roomType: "和室", meals: "1泊2食", hasCoupon: false, hasCampaign: false, hasPetPlan: false, features: [], updatedAt: "2026-07-12T10:00:00Z" },
  { id: "2026-07-22-rakuten-shofuro", dateKey: "2026-07-22", ota: "rakuten", hotelId: "shofuro", status: "full", price: 22000, planName: "特選牛プラン", roomType: "露天風呂付客室", meals: "1泊2食", hasCoupon: false, hasCampaign: false, hasPetPlan: false, features: [], updatedAt: "2026-07-12T10:00:00Z" },
  
  { id: "2026-07-22-rakuten-gensenkan", dateKey: "2026-07-22", ota: "rakuten", hotelId: "gensenkan", status: "few", price: 15000, planName: "秘湯満喫", roomType: "和室", meals: "1泊2食", hasCoupon: false, hasCampaign: false, hasPetPlan: false, features: ["にごり湯"], updatedAt: "2026-07-12T10:00:00Z" },
  { id: "2026-07-22-rakuten-wanwan", dateKey: "2026-07-22", ota: "rakuten", hotelId: "wanwan", status: "available", price: 19800, planName: "愛犬同伴プラン", roomType: "ツイン", meals: "1泊2食", hasCoupon: true, hasCampaign: false, hasPetPlan: true, features: ["ドッグラン"], updatedAt: "2026-07-12T10:00:00Z" },

  // 8/13 (お盆) - 楽天トラベル
  { id: "2026-08-13-rakuten-majimaso", dateKey: "2026-08-13", ota: "rakuten", hotelId: "majimaso", status: "full", price: 18000, planName: "お盆特別プラン", roomType: "和室", meals: "1泊2食", hasCoupon: false, hasCampaign: false, hasPetPlan: false, features: [], updatedAt: "2026-07-12T10:00:00Z" },
  { id: "2026-08-13-rakuten-yamaguciya", dateKey: "2026-08-13", ota: "rakuten", hotelId: "yamaguciya", status: "full", price: 19500, planName: "お盆限定", roomType: "和室10畳", meals: "1泊2食", hasCoupon: false, hasCampaign: false, hasPetPlan: false, features: [], updatedAt: "2026-07-12T10:00:00Z" },
  { id: "2026-08-13-rakuten-kamiaizuya", dateKey: "2026-08-13", ota: "rakuten", hotelId: "kamiaizuya", status: "few", price: 21000, planName: "お盆会津屋御膳", roomType: "和室", meals: "1泊2食", hasCoupon: false, hasCampaign: false, hasPetPlan: false, features: [], updatedAt: "2026-07-12T10:00:00Z" },
  { id: "2026-08-13-rakuten-nuriya", dateKey: "2026-08-13", ota: "rakuten", hotelId: "nuriya", status: "full", price: 20500, planName: "お盆1泊2食付", roomType: "和室", meals: "1泊2食", hasCoupon: false, hasCampaign: false, hasPetPlan: false, features: [], updatedAt: "2026-07-12T10:00:00Z" },
  { id: "2026-08-13-rakuten-tokiwa", dateKey: "2026-08-13", ota: "rakuten", hotelId: "tokiwa", status: "full", price: 17500, planName: "お盆プラン", roomType: "和室", meals: "1泊2食", hasCoupon: false, hasCampaign: false, hasPetPlan: false, features: [], updatedAt: "2026-07-12T10:00:00Z" },
  
  { id: "2026-08-13-rakuten-okukogen", dateKey: "2026-08-13", ota: "rakuten", hotelId: "okukogen", status: "full", price: 32000, planName: "お盆リゾート", roomType: "洋室", meals: "1泊2食", hasCoupon: false, hasCampaign: false, hasPetPlan: false, features: [], updatedAt: "2026-07-12T10:00:00Z" },
  { id: "2026-08-13-rakuten-shimofujiya", dateKey: "2026-08-13", ota: "rakuten", hotelId: "shimofujiya", status: "full", price: 28000, planName: "お盆特選", roomType: "和室", meals: "1泊2食", hasCoupon: false, hasCampaign: false, hasPetPlan: false, features: [], updatedAt: "2026-07-12T10:00:00Z" },
  { id: "2026-08-13-rakuten-shofuro", dateKey: "2026-08-13", ota: "rakuten", hotelId: "shofuro", status: "full", price: 38000, planName: "お盆極上ステイ", roomType: "露天風呂付客室", meals: "1泊2食", hasCoupon: false, hasCampaign: false, hasPetPlan: false, features: [], updatedAt: "2026-07-12T10:00:00Z" },
  
  { id: "2026-08-13-rakuten-gensenkan", dateKey: "2026-08-13", ota: "rakuten", hotelId: "gensenkan", status: "few", price: 25000, planName: "お盆秘湯", roomType: "和室", meals: "1泊2食", hasCoupon: false, hasCampaign: false, hasPetPlan: false, features: ["にごり湯"], updatedAt: "2026-07-12T10:00:00Z" },
  { id: "2026-08-13-rakuten-wanwan", dateKey: "2026-08-13", ota: "rakuten", hotelId: "wanwan", status: "full", price: 35000, planName: "お盆愛犬同伴", roomType: "ツイン", meals: "1泊2食", hasCoupon: false, hasCampaign: false, hasPetPlan: true, features: ["ドッグラン"], updatedAt: "2026-07-12T10:00:00Z" },
];
