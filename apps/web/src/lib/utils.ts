import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

const currencyFormatters = new Map<string, Intl.NumberFormat>();

/** Деньги со знаком — знак ВСЕГДА в тексте; цвет никогда не несёт P&L один. */
export const fmtMoney = (value: number, currency = "USD"): string => {
  let formatter = currencyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      signDisplay: "exceptZero",
    });
    currencyFormatters.set(currency, formatter);
  }
  return formatter.format(value);
};

const numberFormatters = new Map<number, Intl.NumberFormat>();
export const fmtNumber = (value: number, digits = 2): string => {
  let formatter = numberFormatters.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: digits });
    numberFormatters.set(digits, formatter);
  }
  return formatter.format(value);
};

export const fmtPercent = (value: number | null, digits = 1): string =>
  value === null ? "–" : `${(value * 100).toFixed(digits)}%`;

export const fmtDuration = (ms: number | null | undefined): string => {
  if (ms === null || ms === undefined) return "–";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "< 1 мин";
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч ${minutes % 60} мин`;
  const days = Math.floor(hours / 24);
  return `${days} дн ${hours % 24} ч`;
};

export const pnlClass = (value: number): string =>
  value > 0 ? "text-profit" : value < 0 ? "text-loss" : "text-muted-foreground";