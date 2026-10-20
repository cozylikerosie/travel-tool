// 只在本機開發時使用：網址加上 ?demo 會寫入範例旅程，方便預覽旅程回顧。正式網站不會載入這個檔案。
import type { TripDatabase } from "../data/database";
import type { Expense, ExpenseCategoryCode } from "../features/expenses/expenseSchema";
import type { Place, TransportSegment } from "../features/itinerary/itinerarySchema";
import { segmentId } from "../features/itinerary/itineraryOrdering";
import type { TransportModeCode } from "../features/itinerary/transportModes";
import type { Trip } from "../features/trips/tripSchema";
import type { CurrencyCode } from "../shared/money/currencies";

type DemoPlace = [time: string, name: string, notes?: string, modeToNext?: TransportModeCode];
type DemoExpense = [category: ExpenseCategoryCode, note: string, amount: number];

interface DemoTrip {
  id: string;
  name: string;
  destinations: string[];
  startDate: string;
  endDate: string;
  currency: CurrencyCode;
  budget: number | null;
  companions: string[];
  notes: string;
  days: { places: DemoPlace[]; expenses: DemoExpense[] }[];
}

const DEMO_TRIPS: DemoTrip[] = [
  {
    id: "d0000000-0000-4000-8000-000000000001",
    name: "京都賞楓三日",
    destinations: ["京都"],
    startDate: "2025-11-21",
    endDate: "2025-11-23",
    currency: "JPY",
    budget: 80000,
    companions: ["小美"],
    notes: "第一次在楓葉季去京都，人很多但真的很美。",
    days: [
      {
        places: [
          ["08:30", "清水寺", "一早去人還不多，清水舞台下面整片紅葉。", "walk"],
          ["11:00", "二年坂・三年坂", "買了七味粉和抹茶冰淇淋。", "walk"],
          ["15:00", "八坂神社"],
        ],
        expenses: [["ticket", "清水寺參拜", 500], ["food", "湯豆腐午餐", 3200], ["shopping", "七味粉", 1600], ["lodging", "町家民宿", 18000]],
      },
      {
        places: [
          ["09:00", "嵐山竹林小徑", "竹林比想像中短，但光線很好拍。", "walk"],
          ["10:30", "天龍寺", "庭園的楓葉倒映在池子裡，這趟最喜歡的地方。", "rail"],
          ["16:00", "伏見稻荷大社", "千本鳥居走到一半就天黑了。"],
        ],
        expenses: [["transport", "嵯峨野線", 240], ["ticket", "天龍寺庭園", 500], ["food", "嵐山豆腐冰淇淋", 450], ["lodging", "町家民宿", 18000]],
      },
      {
        places: [
          ["10:00", "錦市場", "邊走邊吃，玉子燒必買。", "walk"],
          ["13:00", "京都站"],
        ],
        expenses: [["food", "錦市場小吃", 2800], ["shopping", "伴手禮", 5400], ["transport", "HARUKA 到關西機場", 3600]],
      },
    ],
  },
  {
    id: "d0000000-0000-4000-8000-000000000002",
    name: "首爾冬日小旅行",
    destinations: ["首爾"],
    startDate: "2026-01-09",
    endDate: "2026-01-12",
    currency: "KRW",
    budget: 1000000,
    companions: [],
    notes: "一個人的冬天首爾，零下八度。",
    days: [
      {
        places: [["14:00", "弘大", "街頭表演很熱鬧。", "rail"], ["19:00", "延南洞", "找到一間很安靜的咖啡廳。"]],
        expenses: [["transport", "機場鐵路", 9500], ["food", "炸雞啤酒", 32000], ["lodging", "弘大民宿", 85000]],
      },
      {
        places: [
          ["10:00", "景福宮", "穿韓服免門票，雪地裡很好拍。", "walk"],
          ["13:00", "北村韓屋村", "要小聲，居民還住在裡面。", "bus"],
          ["18:00", "明洞"],
        ],
        expenses: [["shopping", "韓服租借", 20000], ["food", "土俗村蔘雞湯", 20000], ["shopping", "保養品", 180000], ["lodging", "弘大民宿", 85000]],
      },
      {
        places: [["11:00", "聖水洞", "工廠改建的咖啡廳一間比一間好看。", "rail"], ["17:00", "漢江公園", "太冷了只待十分鐘。"]],
        expenses: [["food", "咖啡與甜點", 18000], ["transport", "地鐵", 4200], ["lodging", "弘大民宿", 85000]],
      },
      {
        places: [["09:00", "廣藏市場", "綠豆煎餅現煎的最好吃。"]],
        expenses: [["food", "綠豆煎餅", 8000], ["transport", "機場鐵路", 9500]],
      },
    ],
  },
  {
    id: "d0000000-0000-4000-8000-000000000003",
    name: "曼谷吃吃喝喝",
    destinations: ["曼谷"],
    startDate: "2026-03-14",
    endDate: "2026-03-17",
    currency: "THB",
    budget: 20000,
    companions: ["阿哲", "小美"],
    notes: "三個人的吃貨之旅，每天都在吃。",
    days: [
      {
        places: [["15:00", "暹羅商圈", "冷氣超強，逛到腳軟。", "taxi"], ["20:00", "Jodd Fairs 夜市", "火山排骨真的很大一份。"]],
        expenses: [["transport", "機場快線", 45], ["food", "火山排骨", 450], ["lodging", "河畔飯店", 3200]],
      },
      {
        places: [
          ["08:30", "大皇宮", "要穿長褲，門口有賣。", "ferry"],
          ["11:30", "臥佛寺", "大臥佛比照片震撼。", "ferry"],
          ["16:00", "鄭王廟", "傍晚的光線最美。"],
        ],
        expenses: [["ticket", "大皇宮", 500], ["ticket", "臥佛寺", 300], ["transport", "昭披耶河船", 60], ["food", "船麵", 180], ["lodging", "河畔飯店", 3200]],
      },
      {
        places: [["09:00", "恰圖恰週末市集", "買了好多手作小物。", "rail"], ["19:00", "Rooftop Bar", "夜景很值得。"]],
        expenses: [["shopping", "市集戰利品", 2400], ["food", "芒果糯米飯", 120], ["food", "高空酒吧", 1800], ["lodging", "河畔飯店", 3200]],
      },
      {
        places: [["10:00", "泰式按摩"]],
        expenses: [["other", "泰式按摩", 600], ["transport", "計程車到機場", 450]],
      },
    ],
  },
  {
    id: "d0000000-0000-4000-8000-000000000004",
    name: "四國單車環島",
    destinations: ["香川", "愛媛"],
    startDate: "2026-05-02",
    endDate: "2026-05-06",
    currency: "TWD",
    budget: 45000,
    companions: ["小明"],
    notes: "騎完島波海道，屁股痛三天。",
    days: [
      {
        places: [["13:00", "高松城", "護城河裡有海水，鯛魚游來游去。", "walk"], ["16:00", "栗林公園"]],
        expenses: [["transport", "來回機票", 9800], ["food", "讚岐烏龍麵", 180], ["lodging", "高松商務旅館", 2100]],
      },
      {
        places: [["09:00", "直島", "黃色南瓜本人比較小。", "ferry"], ["14:00", "地中美術館", "莫內的睡蓮房間要脫鞋。"]],
        expenses: [["transport", "渡輪", 260], ["ticket", "地中美術館", 610], ["lodging", "高松商務旅館", 2100]],
      },
      {
        places: [["08:00", "今治", "租單車出發。", "other"], ["15:00", "大三島", "多多羅大橋上風好大。"]],
        expenses: [["transport", "單車租借", 450], ["food", "海鮮丼", 400], ["lodging", "島上民宿", 1800]],
      },
      {
        places: [["10:00", "因島", "八朔大福好吃。", "other"], ["16:00", "尾道", "完騎！"]],
        expenses: [["food", "八朔大福", 70], ["lodging", "尾道旅館", 2300]],
      },
      {
        places: [["10:00", "松山・道後溫泉", "泡完溫泉腿終於活過來。"]],
        expenses: [["ticket", "道後溫泉", 160], ["shopping", "今治毛巾", 900]],
      },
    ],
  },
];

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export async function seedDemoData(database: TripDatabase): Promise<void> {
  const trips: Trip[] = [];
  const places: Place[] = [];
  const segments: TransportSegment[] = [];
  const expenses: Expense[] = [];

  for (const demo of DEMO_TRIPS) {
    const createdAt = `${demo.startDate}T00:00:00.000Z`;
    const minorScale = demo.currency === "TWD" || demo.currency === "THB" ? 100 : 1;
    trips.push({
      id: demo.id,
      name: demo.name,
      destinations: demo.destinations,
      startDate: demo.startDate,
      endDate: demo.endDate,
      budgetAmountMinor: demo.budget === null ? null : demo.budget * minorScale,
      budgetCurrency: demo.budget === null ? null : demo.currency,
      companions: demo.companions,
      notes: demo.notes,
      createdAt,
      updatedAt: createdAt,
    });

    demo.days.forEach((day, dayIndex) => {
      const dayNumber = dayIndex + 1;
      const dayPlaces = day.places.map(([arrivalTime, name, notes = ""], index): Place => ({
        id: crypto.randomUUID(),
        tripId: demo.id,
        dayNumber,
        dayOrder: index + 1,
        name,
        address: "",
        coordinates: null,
        arrivalTime,
        stay: { kind: "none" },
        notes,
        createdAt,
        updatedAt: createdAt,
      }));
      places.push(...dayPlaces);
      day.places.forEach(([, , , mode], index) => {
        const from = dayPlaces[index];
        const to = dayPlaces[index + 1];
        if (!mode || !from || !to) return;
        segments.push({ id: segmentId(from.id, to.id), tripId: demo.id, dayNumber, fromPlaceId: from.id, toPlaceId: to.id, mode, updatedAt: createdAt });
      });
      day.expenses.forEach(([category, note, amount], index) => {
        const recordedAt = `${addDays(demo.startDate, dayIndex)}T${String(index + 10).padStart(2, "0")}:00:00.000Z`;
        expenses.push({
          id: crypto.randomUUID(),
          tripId: demo.id,
          dayNumber,
          amountMinor: amount * minorScale,
          currency: demo.currency,
          category,
          note,
          createdAt: recordedAt,
          updatedAt: recordedAt,
        });
      });
    });
  }

  const tripIds = DEMO_TRIPS.map((demo) => demo.id);
  await database.transaction("rw", [database.trips, database.places, database.transportSegments, database.expenses], async () => {
    // 重複載入時先清掉舊的範例資料，不影響使用者自己的旅程
    await database.places.where("tripId").anyOf(tripIds).delete();
    await database.transportSegments.where("tripId").anyOf(tripIds).delete();
    await database.expenses.where("tripId").anyOf(tripIds).delete();
    await database.trips.bulkPut(trips);
    await database.places.bulkPut(places);
    await database.transportSegments.bulkPut(segments);
    await database.expenses.bulkPut(expenses);
  });
}
