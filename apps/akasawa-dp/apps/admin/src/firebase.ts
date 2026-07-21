import { defaultRules, RoomType, CalendarPrice, PricingRules } from "./types";

// --- ダミー認証 (Auth) ---
export interface User {
  uid: string;
  email: string;
  displayName: string;
  getIdToken(): Promise<string>;
}

class MockAuth {
  private listeners: ((user: User | null) => void)[] = [];
  private currentMockUser: User | null = null;

  constructor() {
    const saved = localStorage.getItem("demo_user");
    if (saved) {
      try {
        this.currentMockUser = JSON.parse(saved);
      } catch {
        this.currentMockUser = null;
      }
    }
  }

  get currentUser() {
    return this.currentMockUser;
  }

  onAuthStateChanged(callback: (user: User | null) => void) {
    this.listeners.push(callback);
    // 初期状態を即時通知
    setTimeout(() => callback(this.currentMockUser), 10);
    
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  async signInWithPopup() {
    const user: User = {
      uid: "demo-admin-uid-12345",
      email: "demo-admin@akasawa-onsan.com",
      displayName: "赤沢 温泉 太郎 (デモ管理者)",
      getIdToken: () => Promise.resolve("demo-mock-jwt-token")
    };
    this.currentMockUser = user;
    localStorage.setItem("demo_user", JSON.stringify(user));
    this.notify();
    return { user };
  }

  async signOut() {
    this.currentMockUser = null;
    localStorage.removeItem("demo_user");
    this.notify();
  }

  private notify() {
    this.listeners.forEach(l => l(this.currentMockUser));
  }
}

export const auth = new MockAuth();
export const googleProvider = {};
export const pricingApiBase = "http://localhost:5175/mock-api"; // 使用しないが互換性維持

// --- ダミーデータベース (Firestore) ---
export const db = {};

// デモ用の初期部屋データ
const mockRoomTypes: RoomType[] = [
  { id: "premium-suite", name: "【禁煙】プレミアムスイート（ペット不可）", inventory: 1, capacity: 6, baseRateWeekday: 28000, baseRateWeekend: 36000, minPrice: 22000, maxPrice: 48000 },
  { id: "petit-suite", name: "【禁煙】プチスイート２０２号室（ペット可・バス付）", inventory: 1, capacity: 4, baseRateWeekday: 22000, baseRateWeekend: 29000, minPrice: 18000, maxPrice: 38000 },
  { id: "compact-room", name: "【禁煙】おしゃれなコンパクトルーム（ペット不可）", inventory: 1, capacity: 2, baseRateWeekday: 16000, baseRateWeekend: 21000, minPrice: 12000, maxPrice: 28000 },
  { id: "riverview-bath", name: "【禁煙】リバービューが素敵な和室１０畳（バス付）", inventory: 2, capacity: 5, baseRateWeekday: 18000, baseRateWeekend: 24000, minPrice: 14000, maxPrice: 32000 },
  { id: "japanese-toilet", name: "【禁煙】和室１０畳（トイレ付・ペット不可）", inventory: 2, capacity: 5, baseRateWeekday: 16000, baseRateWeekend: 21000, minPrice: 12000, maxPrice: 28000 },
  { id: "japanese-pet", name: "【禁煙】和室１０畳（ペットと泊まろう♪）", inventory: 2, capacity: 5, baseRateWeekday: 18000, baseRateWeekend: 24000, minPrice: 14000, maxPrice: 32000 },
  { id: "japanese-bedroom", name: "【禁煙】和室１０畳ベッドルーム（１階）", inventory: 1, capacity: 4, baseRateWeekday: 16000, baseRateWeekend: 21000, minPrice: 12000, maxPrice: 28000 }
];

export function collection(database: any, path: string) {
  return { type: "collection", path };
}

export function doc(database: any, colOrPath: any, id?: string) {
  if (typeof colOrPath === "string") {
    return { type: "doc", path: colOrPath, id };
  }
  return { type: "doc", path: colOrPath.path, id };
}

export function query(colRef: any, ...constraints: any[]) {
  return colRef;
}

export function where(field: string, op: string, value: any) {
  return { type: "where", field, op, value };
}

export function orderBy(field: string, direction?: "asc" | "desc") {
  return { type: "orderBy", field, direction };
}

export async function getDoc(docRef: any) {
  const path = docRef.path;
  const id = docRef.id;

  if (path === "admins") {
    // どんなユーザーでも管理者として振る舞う
    return {
      exists: () => true,
      data: () => ({ role: "admin" })
    };
  }

  if (path === "pricingRules" && id === "default") {
    const savedRules = localStorage.getItem("demo_pricing_rules");
    return {
      exists: () => true,
      data: () => savedRules ? JSON.parse(savedRules) : defaultRules
    };
  }

  return {
    exists: () => false,
    data: () => null
  };
}

export async function getDocs(queryRef: any) {
  const path = queryRef.path;

  if (path === "roomTypes") {
    // ローカルストレージに保存されている部屋情報があればそちらを優先、なければデフォルト
    const saved = localStorage.getItem("demo_room_types");
    const rooms = saved ? JSON.parse(saved) : mockRoomTypes;
    if (!saved) {
      localStorage.setItem("demo_room_types", JSON.stringify(mockRoomTypes));
    }
    return {
      docs: rooms.map((r: any) => ({
        id: r.id,
        data: () => r
      }))
    };
  }

  if (path === "calendar_prices") {
    const saved = localStorage.getItem("demo_calendar_prices");
    const prices: CalendarPrice[] = saved ? JSON.parse(saved) : [];
    return {
      docs: prices.map((p) => ({
        id: p.id,
        data: () => p
      }))
    };
  }

  return {
    docs: []
  };
}

export async function setDoc(docRef: any, data: any, options?: any) {
  const path = docRef.path;
  const id = docRef.id;

  if (path === "pricingRules" && id === "default") {
    localStorage.setItem("demo_pricing_rules", JSON.stringify(data));
  }
}

// --- firebase/auth 用のラッパー関数 ---
export function onAuthStateChanged(authInstance: any, callback: (user: User | null) => void) {
  return auth.onAuthStateChanged(callback);
}

export async function signInWithPopup(authInstance: any, provider: any) {
  return auth.signInWithPopup();
}

export async function signOut(authInstance: any) {
  return auth.signOut();
}

