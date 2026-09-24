export interface FeeRule {
  id: string;
  accountId: string;
  symbol: string;
  amount: number;
  mode: "execution" | "unit";
}
export interface RiskRule {
  id: string;
  accountId: string;
  symbol: string;
  stop: number;
  target: number;
  mode: "price" | "percent";
}
export interface JournalDefaults {
  breakeven: number;
  breakevenMode: "money" | "percent";
  feeRules: FeeRule[];
  riskRules: RiskRule[];
}
export const EMPTY_DEFAULTS: JournalDefaults = {
  breakeven: 0,
  breakevenMode: "money",
  feeRules: [],
  riskRules: [],
};
export const matchesRule = (
  rule: { accountId: string; symbol: string },
  accountId: string,
  symbol: string,
) =>
  (!rule.accountId || rule.accountId === accountId) &&
  (!rule.symbol || rule.symbol.toUpperCase() === symbol.toUpperCase());
/** Explicitly opted-in zero-fee defaults; original source fill hashes are retained for deduplication. */
export function defaultFee(
  fee: number,
  quantity: number,
  accountId: string,
  symbol: string,
  defaults: JournalDefaults,
) {
  if (fee !== 0) return fee;
  const rule = defaults.feeRules.find((r) => matchesRule(r, accountId, symbol));
  return rule ? rule.amount * (rule.mode === "unit" ? quantity : 1) : fee;
}
export function defaultRisk(
  entry: number,
  direction: string,
  accountId: string,
  symbol: string,
  defaults: JournalDefaults,
) {
  const r = defaults.riskRules.find((rule) => matchesRule(rule, accountId, symbol));
  if (!r) return {};
  const unit = r.mode === "percent" ? Math.abs(entry) / 100 : 1;
  const sign = direction === "long" ? 1 : -1;
  return { stopLoss: entry - sign * r.stop * unit, profitTarget: entry + sign * r.target * unit };
}

const isFinite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const isText = (s: unknown, max: number): s is string => typeof s === "string" && s.length <= max;
const onlyKeys = (value: object, allowed: readonly string[]) =>
  Object.keys(value).every((k) => allowed.includes(k));
const DEFAULT_KEYS = ["breakeven", "breakevenMode", "feeRules", "riskRules"] as const;
const FEE_KEYS = ["id", "accountId", "symbol", "amount", "mode"] as const;
const RISK_KEYS = ["id", "accountId", "symbol", "stop", "target", "mode"] as const;
export const MAX_DEFAULT_RULES = 100;

export type ParsedDefaults = { defaults: JournalDefaults; error?: undefined } | { error: string };

/**
 * Validate a journal-defaults payload before it is persisted. Only the known
 * fields are accepted, every number must be finite, and unknown keys are
 * rejected so nothing arbitrary is stored in settings.
 */
export function parseJournalDefaults(
  input: unknown,
  accountExists: (id: string) => boolean,
): ParsedDefaults {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return { error: "Настройки по умолчанию должны быть объектом." };
  if (!onlyKeys(input, DEFAULT_KEYS)) return { error: "Настройки по умолчанию содержат неизвестные поля." };
  const b = input as Record<string, unknown>;
  if (
    !isFinite(b.breakeven) ||
    b.breakeven < 0 ||
    !["money", "percent"].includes(b.breakevenMode as string)
  )
    return { error: "Безубыток должен быть неотрицательной суммой или процентом." };
  for (const key of ["feeRules", "riskRules"] as const) {
    const list = b[key];
    if (!Array.isArray(list) || list.length > MAX_DEFAULT_RULES)
      return { error: `Максимум ${MAX_DEFAULT_RULES} правил на тип.` };
    for (const r of list) {
      if (!r || typeof r !== "object" || Array.isArray(r))
        return { error: "Каждое правило должно быть объектом." };
      if (!onlyKeys(r, key === "feeRules" ? FEE_KEYS : RISK_KEYS))
        return { error: "Правило содержит неизвестные поля." };
      const rule = r as Record<string, unknown>;
      if (
        !isText(rule.id, 100) ||
        !isText(rule.accountId, 100) ||
        (rule.accountId && !accountExists(rule.accountId)) ||
        !isText(rule.symbol, 80)
      )
        return { error: "Неверный счёт или символ по умолчанию." };
      if (key === "feeRules") {
        if (
          !isFinite(rule.amount) ||
          rule.amount < 0 ||
          !["unit", "execution"].includes(rule.mode as string)
        )
          return { error: "Комиссии должны быть неотрицательными." };
      } else if (
        !isFinite(rule.stop) ||
        rule.stop <= 0 ||
        !isFinite(rule.target) ||
        rule.target <= 0 ||
        !["price", "percent"].includes(rule.mode as string)
      )
        return { error: "Расстояния стоп-лосса и цели должны быть положительными." };
    }
  }
  const feeRules = (b.feeRules as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    accountId: r.accountId as string,
    symbol: r.symbol as string,
    amount: r.amount as number,
    mode: r.mode as FeeRule["mode"],
  }));
  const riskRules = (b.riskRules as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    accountId: r.accountId as string,
    symbol: r.symbol as string,
    stop: r.stop as number,
    target: r.target as number,
    mode: r.mode as RiskRule["mode"],
  }));
  return {
    defaults: {
      breakeven: b.breakeven,
      breakevenMode: b.breakevenMode as JournalDefaults["breakevenMode"],
      feeRules,
      riskRules,
    },
  };
}