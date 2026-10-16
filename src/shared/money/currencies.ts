// 全站共用的幣別清單（旅程預算與 004 記帳共用）。陣列順序即選單順序，常用幣別排在最前面。
// minorDigits 為金額以最小單位整數儲存時的小數位數；已保存的資料依此換算，修改既有幣別的位數會改變舊資料的金額。
export const CURRENCIES = [
  { code: "TWD", name: "台幣", minorDigits: 2 },
  { code: "JPY", name: "日圓", minorDigits: 0 },
  { code: "KRW", name: "韓元", minorDigits: 0 },
  { code: "USD", name: "美元", minorDigits: 2 },
  { code: "EUR", name: "歐元", minorDigits: 2 },
  { code: "HKD", name: "港幣", minorDigits: 2 },
  { code: "CNY", name: "人民幣", minorDigits: 2 },
  { code: "THB", name: "泰銖", minorDigits: 2 },
  { code: "VND", name: "越南盾", minorDigits: 0 },
  { code: "SGD", name: "新加坡幣", minorDigits: 2 },
  { code: "MYR", name: "馬來西亞令吉", minorDigits: 2 },
  { code: "GBP", name: "英鎊", minorDigits: 2 },
  { code: "AUD", name: "澳幣", minorDigits: 2 },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export const CURRENCY_CODES = CURRENCIES.map((currency) => currency.code) as [
  CurrencyCode,
  ...CurrencyCode[],
];

const currencyByCode = new Map<CurrencyCode, (typeof CURRENCIES)[number]>(
  CURRENCIES.map((currency) => [currency.code, currency]),
);

export function getCurrencyMinorDigits(code: CurrencyCode): number {
  return currencyByCode.get(code)!.minorDigits;
}

export function formatCurrencyLabel(code: CurrencyCode): string {
  return `${currencyByCode.get(code)!.name}（${code}）`;
}
