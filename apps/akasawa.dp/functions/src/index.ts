import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

admin.initializeApp();
const db = admin.firestore();

const REGION = "asia-northeast1";
const BRAND_NOTICES = [
  "当館は38〜40℃前後のぬる湯中心です。熱湯好きの方には向かない場合があります。",
  "館内に猫がいます。動物が苦手な方は事前にご確認ください。",
  "送迎は事前予約制です。公共交通は本数が少ないため、予約前確認を推奨します。"
];

type RoomType = {
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

type PricingRules = {
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
};

type Booking = {
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  status: string;
  adults?: number;
  channel?: string;
  totalAmount?: number;
};

type EventItem = {
  dateKey: string;
  name: string;
  demandBoostPct: number;
};

type Override = {
  dateKey: string;
  roomTypeId: string;
  closed?: boolean;
  manualPrice?: number;
  note?: string;
};

const DEFAULT_RULES: PricingRules = {
  horizonDays: 120,
  defaultMinPriceMultiplier: 0.86,
  defaultMaxPriceMultiplier: 1.35,
  weakWeekdayDiscountMaxPct: 0.12,
  strongDemandMarkupMaxPct: 0.25,
  earlyBirdWeekdayPct: -0.05,
  lastMinuteWeekdayPct: -0.06,
  earlyBirdWindowStart: 21,
  earlyBirdWindowEnd: 45,
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

function setCors(res: any) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function sendJson(res: any, status: number, body: unknown) {
  setCors(res);
  res.status(status).json(body);
}

function parseDateKey(input: string): Date {
  return new Date(`${input}T00:00:00.000Z`);
}

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const clone = new Date(date.getTime());
  clone.setUTCDate(clone.getUTCDate() + days);
  return clone;
}

function diffDays(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

function enumerateStayDates(checkIn: string, checkOut: string): string[] {
  const start = parseDateKey(checkIn);
  const end = parseDateKey(checkOut);
  const result: string[] = [];
  let cursor = new Date(start.getTime());
  while (cursor < end) {
    result.push(formatDateKey(cursor));
    cursor = addDays(cursor, 1);
  }
  return result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToHundred(value: number): number {
  return Math.round(value / 100) * 100;
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 5 || day === 6;
}

function leadBucket(leadDays: number): keyof PricingRules["targetOccupancyByLead"] {
  if (leadDays <= 3) return "0-3";
  if (leadDays <= 7) return "4-7";
  if (leadDays <= 14) return "8-14";
  if (leadDays <= 30) return "15-30";
  if (leadDays <= 60) return "31-60";
  return "61+";
}

async function verifyAdmin(req: any): Promise<{ ok: boolean; uid?: string; message?: string }> {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, message: "Authorization ヘッダーが必要です。" };
  }

  const idToken = authHeader.replace("Bearer ", "").trim();
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const adminDoc = await db.collection("admins").doc(decoded.uid).get();
    if (!adminDoc.exists) {
      return { ok: false, message: "admins/{uid} が未登録です。" };
    }
    return { ok: true, uid: decoded.uid };
  } catch (error) {
    logger.error("verifyAdmin failed", error as Error);
    return { ok: false, message: "トークン検証に失敗しました。" };
  }
}

async function fetchRoomTypes(): Promise<RoomType[]> {
  const snap = await db.collection("roomTypes").get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<RoomType, "id">) }))
    .filter((item) => item.active !== false);
}

async function fetchRules(): Promise<PricingRules> {
  const snap = await db.collection("pricingRules").doc("default").get();
  if (!snap.exists) return DEFAULT_RULES;
  const raw = snap.data() as Partial<PricingRules>;
  return {
    ...DEFAULT_RULES,
    ...raw,
    weekdayFactors: { ...DEFAULT_RULES.weekdayFactors, ...(raw.weekdayFactors || {}) },
    seasonality: { ...DEFAULT_RULES.seasonality, ...(raw.seasonality || {}) },
    targetOccupancyByLead: {
      ...DEFAULT_RULES.targetOccupancyByLead,
      ...(raw.targetOccupancyByLead || {})
    }
  };
}

async function fetchBookings(): Promise<Booking[]> {
  const snap = await db.collection("bookings").get();
  return snap.docs.map((doc) => doc.data() as Booking);
}

async function fetchEvents(): Promise<Map<string, EventItem>> {
  const snap = await db.collection("events").get();
  return new Map(snap.docs.map((doc) => {
    const data = doc.data() as EventItem;
    return [data.dateKey || doc.id, data];
  }));
}

async function fetchOverrides(): Promise<Map<string, Override>> {
  const snap = await db.collection("overrides").get();
  return new Map(snap.docs.map((doc) => {
    const data = doc.data() as Override;
    return [`${data.dateKey}_${data.roomTypeId}`, data];
  }));
}

function buildOccupancy(bookings: Booking[]): Map<string, number> {
  const occupancy = new Map<string, number>();
  for (const booking of bookings) {
    if (!["confirmed", "booked", "paid"].includes(booking.status)) continue;
    for (const dateKey of enumerateStayDates(booking.checkIn, booking.checkOut)) {
      const key = `${dateKey}_${booking.roomTypeId}`;
      occupancy.set(key, (occupancy.get(key) || 0) + 1);
    }
  }
  return occupancy;
}

function computeTargetOccupancy(rules: PricingRules, leadDays: number, weekend: boolean): number {
  const bucket = rules.targetOccupancyByLead[leadBucket(leadDays)];
  return weekend ? bucket.weekend : bucket.weekday;
}

function computePrice(params: {
  date: Date;
  roomType: RoomType;
  rules: PricingRules;
  occupancyRooms: number;
  eventBoostPct: number;
  override?: Override;
}): {
  price: number;
  occupancyRate: number;
  targetOccupancy: number;
  leadDays: number;
  tags: string[];
  closed: boolean;
} {
  const { date, roomType, rules, occupancyRooms, eventBoostPct, override } = params;
  const today = parseDateKey(formatDateKey(new Date()));
  const leadDays = diffDays(today, date);
  const weekend = isWeekend(date);
  const base = weekend ? roomType.baseRateWeekend : roomType.baseRateWeekday;
  const inventory = Math.max(1, roomType.inventory || 1);
  const occupancyRate = clamp(occupancyRooms / inventory, 0, 1);
  const targetOccupancy = computeTargetOccupancy(rules, leadDays, weekend);
  const monthFactor = rules.seasonality[String(date.getUTCMonth() + 1)] || 0;
  const weekdayFactor = rules.weekdayFactors[String(date.getUTCDay())] || 0;
  const occupancyGap = occupancyRate - targetOccupancy;

  let delta = monthFactor + weekdayFactor + eventBoostPct + (roomType.manualBoostPct || 0);
  const tags: string[] = [];

  if (eventBoostPct > 0) tags.push("event");
  if (monthFactor !== 0) tags.push("seasonal");

  if (occupancyGap > 0) {
    delta += Math.min(rules.strongDemandMarkupMaxPct, occupancyGap * 0.55);
    tags.push("high_demand");
  } else {
    delta += Math.max(-rules.weakWeekdayDiscountMaxPct, occupancyGap * 0.35);
    tags.push("base_discount");
  }

  if (!weekend && leadDays >= 7 && leadDays <= 35 && occupancyRate < targetOccupancy - 0.2) {
    delta -= Math.min(rules.weakWeekdayDiscountMaxPct, 0.04 + (targetOccupancy - occupancyRate - 0.2) * 0.25);
    tags.push("weekday_fill");
  }

  if (!weekend && leadDays >= rules.earlyBirdWindowStart && leadDays <= rules.earlyBirdWindowEnd && occupancyRate < targetOccupancy - 0.15) {
    delta += rules.earlyBirdWeekdayPct;
    tags.push("early_bird");
  }

  if (!weekend && leadDays <= 3 && occupancyRate < 0.35) {
    delta += rules.lastMinuteWeekdayPct;
    tags.push("last_minute");
  }

  const minPrice = roomType.minPrice || Math.round(base * rules.defaultMinPriceMultiplier);
  const maxPrice = roomType.maxPrice || Math.round(base * rules.defaultMaxPriceMultiplier);
  const computed = clamp(roundToHundred(base * (1 + delta)), minPrice, maxPrice);

  if (override?.manualPrice) {
    return {
      price: override.manualPrice,
      occupancyRate,
      targetOccupancy,
      leadDays,
      tags: ["manual_override"],
      closed: override.closed === true
    };
  }

  return {
    price: computed,
    occupancyRate,
    targetOccupancy,
    leadDays,
    tags,
    closed: override?.closed === true
  };
}

async function recomputeCalendar(horizonDays?: number) {
  const [roomTypes, rules, bookings, events, overrides] = await Promise.all([
    fetchRoomTypes(),
    fetchRules(),
    fetchBookings(),
    fetchEvents(),
    fetchOverrides()
  ]);

  const occupancy = buildOccupancy(bookings);
  const today = parseDateKey(formatDateKey(new Date()));
  const days = horizonDays || rules.horizonDays;

  const writes: Array<ReturnType<typeof db.collection>> = [];
  let batch = db.batch();
  let operations = 0;
  let changed = 0;
  let lowWeekdayCandidates = 0;

  for (let offset = 0; offset < days; offset += 1) {
    const date = addDays(today, offset);
    const dateKey = formatDateKey(date);
    const eventBoostPct = events.get(dateKey)?.demandBoostPct || 0;

    for (const roomType of roomTypes) {
      const key = `${dateKey}_${roomType.id}`;
      const override = overrides.get(key);
      const occupancyRooms = occupancy.get(key) || 0;
      const result = computePrice({
        date,
        roomType,
        rules,
        occupancyRooms,
        eventBoostPct,
        override
      });

      if (date.getUTCDay() >= 1 && date.getUTCDay() <= 4 && result.occupancyRate < 0.35 && result.leadDays <= 30) {
        lowWeekdayCandidates += 1;
      }

      const ref = db.collection("calendar_prices").doc(key);
      batch.set(ref, {
        dateKey,
        roomTypeId: roomType.id,
        roomName: roomType.name,
        price: result.price,
        occupancyRate: result.occupancyRate,
        targetOccupancy: result.targetOccupancy,
        bookedRooms: occupancyRooms,
        inventory: roomType.inventory,
        leadDays: result.leadDays,
        tags: result.tags,
        closed: result.closed,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      operations += 1;
      changed += 1;

      if (operations === 450) {
        writes.push(db.collection("_batchMarkers"));
        await batch.commit();
        batch = db.batch();
        operations = 0;
      }
    }
  }

  if (operations > 0) {
    await batch.commit();
  }

  const suggestionRef = db.collection("campaign_suggestions").doc("latest");
  await suggestionRef.set({
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lowWeekdayCandidates,
    suggestedSegments: ["猫好き", "ひとり静養", "長湯ウェルネス", "平日ワーケーション"],
    suggestedOffers: [
      "平日限定のレイトチェックアウト",
      "LINE友だち限定の館内利用券",
      "公式予約限定の貸切風呂優先案内"
    ]
  }, { merge: true });

  logger.info("recomputeCalendar finished", { changed, lowWeekdayCandidates });
  return { changed, lowWeekdayCandidates, days, rooms: roomTypes.length };
}

export const adminRecalculate = onRequest({ region: REGION }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { message: "POST only" });
    return;
  }

  const verified = await verifyAdmin(req);
  if (!verified.ok) {
    sendJson(res, 401, { message: verified.message });
    return;
  }

  try {
    const result = await recomputeCalendar();
    sendJson(res, 200, {
      message: `価格再計算が完了しました。${result.days}日 × ${result.rooms}客室タイプ`,
      result
    });
  } catch (error) {
    logger.error("adminRecalculate failed", error as Error);
    sendJson(res, 500, { message: "価格再計算に失敗しました。" });
  }
});

export const seedBaseData = onRequest({ region: REGION }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { message: "POST only" });
    return;
  }

  const verified = await verifyAdmin(req);
  if (!verified.ok) {
    sendJson(res, 401, { message: verified.message });
    return;
  }

  const batch = db.batch();
  const roomSeed: RoomType[] = [
    {
      id: "river_japanese_10",
      name: "リバービュー和室10畳",
      inventory: 4,
      capacity: 5,
      baseRateWeekday: 15800,
      baseRateWeekend: 18800,
      minPrice: 13800,
      maxPrice: 22800,
      active: true
    },
    {
      id: "compact_room",
      name: "おしゃれなコンパクトルーム",
      inventory: 2,
      capacity: 2,
      baseRateWeekday: 12800,
      baseRateWeekend: 15800,
      minPrice: 10800,
      maxPrice: 19800,
      active: true
    },
    {
      id: "premium_suite",
      name: "プレミアムスイート",
      inventory: 1,
      capacity: 4,
      baseRateWeekday: 23800,
      baseRateWeekend: 28800,
      minPrice: 20800,
      maxPrice: 35800,
      active: true
    }
  ];

  for (const room of roomSeed) {
    const { id, ...payload } = room;
    batch.set(db.collection("roomTypes").doc(id), payload, { merge: true });
  }
  batch.set(db.collection("pricingRules").doc("default"), DEFAULT_RULES, { merge: true });
  batch.set(db.collection("events").doc("sample_holiday"), {
    dateKey: formatDateKey(addDays(parseDateKey(formatDateKey(new Date())), 28)),
    name: "サンプル連休",
    demandBoostPct: 0.12
  }, { merge: true });
  await batch.commit();

  sendJson(res, 200, { message: "サンプルデータを投入しました。次に価格再計算を実行してください。" });
});

export const publicQuote = onRequest({ region: REGION }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "GET") {
    sendJson(res, 405, { message: "GET only" });
    return;
  }

  const roomTypeId = String(req.query.roomTypeId || "");
  const checkIn = String(req.query.checkIn || "");
  const checkOut = String(req.query.checkOut || "");
  if (!roomTypeId || !checkIn || !checkOut) {
    sendJson(res, 400, { message: "roomTypeId, checkIn, checkOut が必要です。" });
    return;
  }

  try {
    const roomSnap = await db.collection("roomTypes").doc(roomTypeId).get();
    if (!roomSnap.exists) {
      sendJson(res, 404, { message: "客室タイプが見つかりません。" });
      return;
    }

    const room = { id: roomSnap.id, ...(roomSnap.data() as Omit<RoomType, "id">) };
    const dates = enumerateStayDates(checkIn, checkOut);
    const refs = dates.map((dateKey) => db.collection("calendar_prices").doc(`${dateKey}_${roomTypeId}`));
    const snaps = await db.getAll(...refs);

    const nights = snaps.map((snap, index) => {
      const data = snap.data();
      return {
        dateKey: dates[index],
        price: data?.price ?? (isWeekend(parseDateKey(dates[index])) ? room.baseRateWeekend : room.baseRateWeekday),
        tags: data?.tags || []
      };
    });

    const total = nights.reduce((sum, item) => sum + item.price, 0);
    sendJson(res, 200, {
      roomTypeId,
      roomName: room.name,
      checkIn,
      checkOut,
      nights: nights.length,
      nightlyPrices: nights,
      total,
      averageNightlyRate: nights.length > 0 ? Math.round(total / nights.length) : 0,
      notices: BRAND_NOTICES
    });
  } catch (error) {
    logger.error("publicQuote failed", error as Error);
    sendJson(res, 500, { message: "見積取得に失敗しました。" });
  }
});

export const scheduledRecalculate = onSchedule({
  region: REGION,
  schedule: "15 2 * * *",
  timeZone: "Asia/Tokyo"
}, async () => {
  await recomputeCalendar();
});
