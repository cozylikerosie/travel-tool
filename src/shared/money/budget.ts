import { getCurrencyMinorDigits, type CurrencyCode } from "./currencies";

export function parseMoneyToMinorUnits(
  amountText: string,
  currency: CurrencyCode,
): number {
  const normalized = amountText.trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) {
    throw new RangeError("金額格式不正確");
  }

  const minorDigits = getCurrencyMinorDigits(currency);
  const fraction = match[2] ?? "";
  if (fraction.length > minorDigits) {
    throw new RangeError(`金額最多只能有 ${minorDigits} 位小數`);
  }

  const scale = 10n ** BigInt(minorDigits);
  const whole = BigInt(match[1]!);
  const fractionalUnits = BigInt(fraction.padEnd(minorDigits, "0") || "0");
  const amountMinor = whole * scale + fractionalUnits;

  if (amountMinor <= 0n || amountMinor > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("金額必須是正數且不可超出安全整數範圍");
  }

  return Number(amountMinor);
}

export function formatMoney(
  amountMinor: number,
  currency: CurrencyCode,
  locale = "zh-TW",
): string {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new RangeError("金額必須是非負安全整數");
  }

  const majorAmount = amountMinor / 10 ** getCurrencyMinorDigits(currency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: getCurrencyMinorDigits(currency),
    maximumFractionDigits: getCurrencyMinorDigits(currency),
  }).format(majorAmount);
}

export function formatMoneyInput(
  amountMinor: number,
  currency: CurrencyCode,
): string {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new RangeError("金額必須是非負安全整數");
  }

  const minorDigits = getCurrencyMinorDigits(currency);
  if (minorDigits === 0) return String(amountMinor);

  const amount = BigInt(amountMinor);
  const scale = 10n ** BigInt(minorDigits);
  const whole = amount / scale;
  const fraction = String(amount % scale).padStart(minorDigits, "0");
  return `${whole}.${fraction}`;
}