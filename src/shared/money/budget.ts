export type TripCurrency = "TWD" | "JPY";

const CURRENCY_MINOR_DIGITS: Record<TripCurrency, number> = {
  TWD: 2,
  JPY: 0,
};

export function parseMoneyToMinorUnits(
  amountText: string,
  currency: TripCurrency,
): number {
  const normalized = amountText.trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) {
    throw new RangeError("金額格式不正確");
  }

  const minorDigits = CURRENCY_MINOR_DIGITS[currency];
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
  currency: TripCurrency,
  locale = "zh-TW",
): string {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new RangeError("金額必須是非負安全整數");
  }

  const majorAmount = amountMinor / 10 ** CURRENCY_MINOR_DIGITS[currency];
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: CURRENCY_MINOR_DIGITS[currency],
    maximumFractionDigits: CURRENCY_MINOR_DIGITS[currency],
  }).format(majorAmount);
}

export function formatMoneyInput(
  amountMinor: number,
  currency: TripCurrency,
): string {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new RangeError("金額必須是非負安全整數");
  }

  const minorDigits = CURRENCY_MINOR_DIGITS[currency];
  if (minorDigits === 0) return String(amountMinor);

  const amount = BigInt(amountMinor);
  const scale = 10n ** BigInt(minorDigits);
  const whole = amount / scale;
  const fraction = String(amount % scale).padStart(minorDigits, "0");
  return `${whole}.${fraction}`;
}