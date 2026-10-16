export type TripStatus = "upcoming" | "ongoing" | "completed";

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateOnly(value: string): CalendarDate {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    throw new RangeError(`Invalid calendar date: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const monthLengths = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  if (year < 1 || month < 1 || month > 12 || day < 1 || day > monthLengths[month - 1]!) {
    throw new RangeError(`Invalid calendar date: ${value}`);
  }

  return { year, month, day };
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function dayNumber(date: CalendarDate): number {
  const years = date.year - 1;
  let days = years * 365 + Math.floor(years / 4) - Math.floor(years / 100) + Math.floor(years / 400);

  for (let month = 1; month < date.month; month += 1) {
    days += isLeapYear(date.year)
      ? [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!
      : [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
  }

  return days + date.day;
}

export function isDateOnly(value: string): boolean {
  try {
    parseDateOnly(value);
    return true;
  } catch {
    return false;
  }
}

export function compareDateOnly(left: string, right: string): number {
  parseDateOnly(left);
  parseDateOnly(right);
  return left < right ? -1 : left > right ? 1 : 0;
}

export function getTripDurationDays(startDate: string, endDate: string): number {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  const duration = dayNumber(end) - dayNumber(start) + 1;

  if (duration < 1) {
    throw new RangeError("Return date cannot be before departure date");
  }

  return duration;
}

export function getTripStatus(
  startDate: string,
  endDate: string,
  today: string = getTodayLocalDate(),
): TripStatus {
  parseDateOnly(startDate);
  parseDateOnly(endDate);
  parseDateOnly(today);

  if (compareDateOnly(today, startDate) < 0) return "upcoming";
  if (compareDateOnly(today, endDate) > 0) return "completed";
  return "ongoing";
}

export function getTodayLocalDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${String(year).padStart(4, "0")}-${month}-${day}`;
}

export interface TripDay {
  dayNumber: number;
  date: string;
  label: string;
}

const WEEKDAYS_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

// 以 UTC 計算日曆日期，不受執行環境時區影響
function toUtcDate(value: string): Date {
  const { year, month, day } = parseDateOnly(value);
  const date = new Date(Date.UTC(2000, month - 1, day));
  date.setUTCFullYear(year);
  return date;
}

function formatUtcDate(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDaysToDateOnly(value: string, days: number): string {
  const date = toUtcDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatUtcDate(date);
}

export function getWeekdayShort(value: string): (typeof WEEKDAYS_SHORT)[number] {
  return WEEKDAYS_SHORT[toUtcDate(value).getUTCDay()]!;
}

export function formatTripDayDate(value: string): string {
  return `${value.slice(5, 7)}.${value.slice(8, 10)}`;
}

export function listTripDays(startDate: string, endDate: string): TripDay[] {
  const duration = getTripDurationDays(startDate, endDate);
  return Array.from({ length: duration }, (_, index) => {
    const date = addDaysToDateOnly(startDate, index);
    const dayNumber = index + 1;
    return {
      dayNumber,
      date,
      label: `Day ${dayNumber}・${formatTripDayDate(date)} ${getWeekdayShort(date)}`,
    };
  });
}
