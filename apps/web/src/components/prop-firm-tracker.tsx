"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock3,
  Landmark,
  Plus,
  Download,
  Upload,
} from "lucide-react";
import { FilterBar } from "./filter-bar";
import { Field } from "./filter-fields";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { OptionSelect } from "./ui/option-select";
import { DatePicker } from "./ui/date-picker";
import { EquityArea } from "./charts/equity-area";
import { usePrivacy } from "./privacy";
import { useApi } from "@/lib/use-api";
import { PropCashSummary, PropCashComparison } from "./prop-cash-overview";
import { createPropDemo } from "@/lib/prop-demo";
import { PropFirmModal, type PropModal } from "./prop-firm-forms";
import {
  cashMovements,
  cashSummary,
  cashTimeline,
  payoutProgress,
  propMoney,
  currencyDigits,
  fromMinor,
  label,
  type PropData,
  type PropEntry,
  type CashMovement,
  type PropReceipt,
} from "@/lib/prop-firms";
const PAGE_SIZE = 40;
const inDates = (day: string, from: string, to: string) =>
  (!from || day >= from) && (!to || day <= to);
function downloadCsv(rows: CashMovement[]) {
  const cell = (value: string) => {
    const safe = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const header = "id,entry_id,account_id,firm,currency,date,kind,amount,category,reference";
  const csv = [
    header,
    ...rows.map((row) =>
      [
        row.id,
        row.entryId,
        row.accountId ?? "",
        row.firm,
        row.currency,
        row.date,
        row.kind,
        fromMinor(row.amountMinor, row.currency),
        row.category,
        row.reference,
      ]
        .map(cell)
        .join(","),
    ),
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "prop-cash-flows.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}
export function PropFirmTracker() {
  const { data: savedData, error, loading, refresh } = useApi<PropData>("/api/prop-firms");
  const [demo, setDemo] = useState<PropData | null>(null);
  const [showBreakdowns, setShowBreakdowns] = useState(false);
  const data = demo ?? savedData;
  const privacy = usePrivacy();
  const [tab, setTab] = useState("overview"),
    [firm, setFirm] = useState(""),
    [accountId, setAccountId] = useState(""),
    [currency, setCurrency] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [search, setSearch] = useState(""),
    [showArchived, setShowArchived] = useState(false),
    [showАннулировано, setShowАннулировано] = useState(false),
    [page, setPage] = useState(0),
    [modal, setModal] = useState<PropModal | null>(null);
  useEffect(
    () => setPage(0),
    [tab, firm, accountId, currency, from, to, search, showArchived, showАннулировано],
  );
  useEffect(() => {
    if (privacy) setModal(null);
  }, [privacy]);
  const readOnly = privacy || Boolean(demo);
  const switchDemo = () => {
    setDemo(
      demo ? null : createPropDemo(savedData?.today ?? new Date().toISOString().slice(0, 10)),
    );
    setModal(null);
    setFirm("");
    setAccountId("");
    setCurrency(demo ? "" : "USD");
    setFrom("");
    setTo("");
    setSearch("");
    setPage(0);
    setShowArchived(false);
    setShowАннулировано(false);
    setTab("overview");
  };
  const allCash = useMemo(() => (data ? cashMovements(data.entries, data.receipts) : []), [data]);
  const payouts = useMemo(
    () => (data ? payoutProgress(data.entries, data.receipts, data.today) : []),
    [data],
  );
  const payoutById = useMemo(() => new Map(payouts.map((row) => [row.entry.id, row])), [payouts]);
  const receiptsById = useMemo(() => {
    const map = new Map<string, PropReceipt[]>();
    for (const row of data?.receipts ?? []) {
      const list = map.get(row.payoutId) ?? [];
      list.push(row);
      map.set(row.payoutId, list);
    }
    return map;
  }, [data]);
  const firms = useMemo(
    () =>
      [
        ...new Set([
          ...(data?.accounts.map((a) => a.firm) ?? []),
          ...(data?.entries.map((e) => e.firm) ?? []),
        ]),
      ].sort(),
    [data],
  );
  const currencies = useMemo(
    () =>
      [
        ...new Set([
          ...(data?.accounts.map((a) => a.currency) ?? []),
          ...(data?.entries.map((e) => e.currency) ?? []),
        ]),
      ].sort(),
    [data],
  );
  const selectedCurrency = currency || (currencies.length === 1 ? currencies[0]! : "");
  const matches = (row: { firm: string; accountId: string | null; currency: string }) =>
    (!firm || row.firm === firm) &&
    (!accountId || row.accountId === accountId) &&
    (!currency || row.currency === currency);
  const cash = useMemo(
    () => allCash.filter((row) => matches(row) && inDates(row.date, from, to)),
    [allCash, firm, accountId, currency, from, to],
  );
  const summaryCash = useMemo(
    () => cash.filter((row) => row.currency === selectedCurrency),
    [cash, selectedCurrency],
  );
  const summary = useMemo(() => cashSummary(summaryCash), [summaryCash]);
  const selectedPayouts = payouts.filter((row) => matches(row.entry));
  const outstanding = selectedPayouts
    .filter((row) => row.entry.currency === selectedCurrency)
    .reduce((sum, row) => sum + row.remaining, 0);
  const overdue = selectedPayouts.filter((row) => row.overdue);
  const accountRows = (data?.accounts ?? []).filter((a) => matches({ ...a, accountId: a.id }));
  const active = accountRows.filter((a) => a.status === "active" && !a.archived);
  const resolved = accountRows.filter(
    (a) =>
      ["evaluation", "verification"].includes(a.program) &&
      ["passed", "breached"].includes(a.status),
  );
  const passed = resolved.filter((a) => a.status === "passed").length;
  const renewals = active
    .filter(
      (a) =>
        a.renewalOn &&
        a.renewalOn <=
          new Date(Date.parse(`${data?.today}T12:00:00Z`) + 30 * 86_400_000)
            .toISOString()
            .slice(0, 10),
    )
    .sort((a, b) => a.renewalOn!.localeCompare(b.renewalOn!));
  const money = (amount: number, code = selectedCurrency) =>
    privacy ? "••••" : code ? propMoney(amount, code) : "—";
  const name = (id: string | null) =>
    data?.accounts.find((a) => a.id === id)?.name ?? "Общий расход фирмы";
  const query = search.toLowerCase().trim();
  const entries = (data?.entries ?? [])
    .filter(
      (e) =>
        matches(e) &&
        (showАннулировано || !e.voided) &&
        inDates(e.occurredOn, from, to) &&
        (!query ||
          `${e.firm} ${name(e.accountId)} ${e.kind} ${e.category} ${e.reference}`
            .toLowerCase()
            .includes(query)),
    )
    .sort(
      (a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt),
    );
  const listedPayouts = selectedPayouts
    .filter(
      (row) =>
        (row.entry.status === "requested" ||
          row.entry.status === "approved" ||
          inDates(row.entry.occurredOn, from, to)) &&
        (!query ||
          `${row.entry.firm} ${name(row.entry.accountId)} ${row.entry.status} ${row.entry.reference}`
            .toLowerCase()
            .includes(query)),
    )
    .sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) ||
        b.entry.occurredOn.localeCompare(a.entry.occurredOn),
    );
  const listedAccounts = accountRows.filter(
    (a) =>
      (showArchived || !a.archived) &&
      (!query || `${a.firm} ${a.name} ${a.program} ${a.status}`.toLowerCase().includes(query)),
  );
  const cashByAccount = useMemo(() => {
    const groups = new Map<string, CashMovement[]>();
    for (const row of cash) {
      const key = row.accountId ?? "";
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
    }
    return groups;
  }, [cash]);
  const byFirm = [...new Set(summaryCash.map((row) => row.firm))]
    .map((value) => ({
      firm: value,
      ...cashSummary(summaryCash.filter((row) => row.firm === value)),
    }))
    .sort((a, b) => b.net - a.net);
  const byCategory = EXPENSE_ROWS(summaryCash);
  const months = [...new Set(summaryCash.map((row) => row.date.slice(0, 7)))]
    .sort()
    .reverse()
    .map((month) => ({
      month,
      ...cashSummary(summaryCash.filter((row) => row.date.startsWith(month))),
    }));
  const rowCount =
    tab === "accounts"
      ? listedAccounts.length
      : tab === "payouts"
        ? listedPayouts.length
        : entries.length;
  const safePage = Math.min(page, Math.max(0, Math.ceil(rowCount / PAGE_SIZE) - 1));
  const slice = <T,>(rows: T[]) => rows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const entryActions = (entry: PropEntry) => (
    <div className="flex flex-wrap gap-1">
      <Button
        size="sm"
        variant="ghost"
        disabled={readOnly}
        onClick={() => setModal({ kind: "detail", type: "entry", id: entry.id })}
      >
        Details
      </Button>
      {!entry.voided && (
        <Button
          size="sm"
          variant="ghost"
          disabled={readOnly}
          onClick={() => setModal({ kind: "entry", entry, type: entry.kind })}
        >
          Edit
        </Button>
      )}
      {!entry.voided && entry.kind === "expense" && (
        <Button
          size="sm"
          variant="ghost"
          disabled={readOnly}
          onClick={() => setModal({ kind: "entry", type: "refund", expense: entry })}
        >
          Refund
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        disabled={readOnly}
        onClick={() =>
          setModal({
            kind: "change",
            action: "entry.void",
            id: entry.id,
            revision: entry.revision,
            value: !entry.voided,
            name: entry.voided ? "Восстановить запись" : "Аннулировать запись",
          })
        }
      >
        {entry.voided ? "Восстановить" : "Аннулировать"}
      </Button>
    </div>
  );
  return (
    <div>
      <FilterBar
        title="Проп-фирмы"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!data || readOnly}
              onClick={() => setModal({ kind: "account" })}
            >
              <Plus className="h-4 w-4" />
              Добавить счёт
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!data || readOnly}
              onClick={() => setModal({ kind: "entry", type: "expense" })}
            >
              <ArrowUpRight className="h-4 w-4" />
              Добавить расход
            </Button>
            <Button
              size="sm"
              disabled={!data || readOnly}
              onClick={() => setModal({ kind: "entry", type: "payout" })}
            >
              <ArrowDownLeft className="h-4 w-4" />
              Отследить выплату
            </Button>
          </div>
        }
      />
      <div className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Расходы и выплаты</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Отслеживайте расходы, полученные выплаты и итоговый результат.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={switchDemo}>
              {demo ? "Выйти из демо" : "Загрузить демо-данные"}
            </Button>
            <details className="relative">
              <summary className="cursor-pointer rounded-md border px-3 py-2 text-xs font-medium">
                Инструменты данных
              </summary>
              <div className="absolute right-0 z-20 mt-2 flex w-48 flex-col gap-1 rounded-lg border bg-card p-2 shadow-lg">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!data || readOnly}
                  onClick={() => setModal({ kind: "import" })}
                >
                  <Upload className="h-4 w-4" />
                  Импорт CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!cash.length || readOnly}
                  onClick={() => downloadCsv(cash)}
                >
                  <Download className="h-4 w-4" />
                  Экспорт движения денег CSV
                </Button>
              </div>
            </details>
          </div>
        </div>
        {demo && (
          <div
            role="status"
            className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm"
          >
            <span className="font-medium">Просмотр демо-данных</span>
            <span className="ml-2 text-muted-foreground">
              Смоделированные записи · Только чтение · Ничего не сохраняется
            </span>
          </div>
        )}
        {privacy && (
          <p className="rounded-lg border p-3 text-sm text-muted-foreground">
            Privacy mode hides amounts, charts and financial details. Turn it off to edit записей or
            export cash data.
          </p>
        )}
        {error && !demo && (
          <p
            role="alert"
            className="rounded-lg border border-destructive p-3 text-sm text-destructive"
          >
            {error}{" "}
            <Button variant="ghost" onClick={refresh}>
              Повторить
            </Button>
          </p>
        )}
        {loading && !data && (
          <p role="status" className="text-sm text-muted-foreground">
            Загрузка данных по проп-счетам…
          </p>
        )}
        {data && (
          <>
            {!data.accounts.length && !data.entries.length && (
              <Card>
                <CardContent className="flex flex-wrap items-center gap-5 py-7">
                  <Landmark className="h-10 w-10 text-muted-foreground" />
                  <div className="max-w-2xl">
                    <h3 className="font-semibold">Начните со счёта или расхода</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add the firm and attempt you want to track, then record fees and actual
                      payouts. You can also log shared firm costs before linking an account. No
                      firm, fee schedule or payout rules are preloaded.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
            <details className="rounded-xl border bg-card">
              <summary className="cursor-pointer px-4 py-3 text-sm">
                <span className="font-medium">Фильтры</span>
                <span className="ml-3 text-xs text-muted-foreground">
                  {firm || "Все фирмы"} · {accountId ? name(accountId) : "Все счета"} ·{" "}
                  {from || to ? `${from || "Начало"} to ${to || "Сегодня"}` : "Все даты"}
                  {selectedCurrency ? ` · ${selectedCurrency}` : " · Выберите валюту"}
                </span>
              </summary>
              <div className="grid gap-3 border-t p-4 sm:grid-cols-2 xl:grid-cols-5">
                <Field label="Фирма">
                  <OptionSelect
                    value={firm}
                    onValueChange={(value) => {
                      setFirm(value);
                      setAccountId("");
                    }}
                  >
                    <option value="">Все фирмы</option>
                    {firms.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </OptionSelect>
                </Field>
                <Field label="Проп-счёт">
                  <OptionSelect value={accountId} onValueChange={setAccountId}>
                    <option value="">Все счета и общие расходы</option>
                    {data.accounts
                      .filter((a) => !firm || a.firm === firm)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                          {a.archived ? " (архивный)" : ""}
                        </option>
                      ))}
                  </OptionSelect>
                </Field>
                <Field label="Валюта">
                  <OptionSelect value={currency} onValueChange={setCurrency}>
                    <option value="">
                      {currencies.length > 1 ? "Выберите валюту для итогов" : "Все валюты"}
                    </option>
                    {currencies.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </OptionSelect>
                </Field>
                <Field label="Денежные операции с">
                  <DatePicker
                    label="Дата начала денежных операций"
                    value={from}
                    max={to || data.today}
                    onValueChange={setFrom}
                  />
                </Field>
                <Field label="Денежные операции по">
                  <DatePicker
                    label="Дата окончания денежных операций"
                    value={to}
                    min={from}
                    max={data.today}
                    onValueChange={setTo}
                  />
                </Field>
                <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2 xl:col-span-5">
                  <p className="text-xs text-muted-foreground">
                    Dates apply to cash received or paid. Account history and pending requests cover
                    all dates.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFirm("");
                      setAccountId("");
                      setCurrency("");
                      setFrom("");
                      setTo("");
                      setSearch("");
                    }}
                  >
                    Очистить фильтры
                  </Button>
                </div>
              </div>
            </details>
            {from && to && from > to && (
              <p role="alert" className="text-sm text-destructive">
                Начальная дата не может быть позже конечной.
              </p>
            )}
            {currencies.length > 1 && !selectedCurrency && (
              <Card>
                <CardContent className="py-4">
                  <p className="mb-3 text-sm">
                    Currencies are never added together. Choose one above for charts and detailed
                    totals.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    {currencies.map((c) => (
                      <p key={c} className="text-sm">
                        <strong>{c}</strong> · Чистые деньги{" "}
                        {money(cashSummary(cash.filter((r) => r.currency === c)).net, c)}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            <PropCashSummary summary={summary} currency={selectedCurrency} privacy={privacy} />
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="text-muted-foreground">Ожидается выплата</span>
                <strong className="tabular-nums">{money(outstanding)}</strong>
                <span className="text-xs text-muted-foreground">
                  {overdue.length ? `${overdue.length} overdue · ` : ""}All dates · Excluded from
                  received cash
                </span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setTab("payouts")}>
                Посмотреть запросы выплат →
              </Button>
            </div>
            <div
              role="tablist"
              aria-label="Разделы проп-трекера"
              className="flex gap-2 overflow-x-auto"
            >
              {["overview", "accounts", "payouts", "ledger"].map((v) => (
                <Button
                  key={v}
                  role="tab"
                  aria-selected={tab === v}
                  variant={tab === v ? "secondary" : "outline"}
                  onClick={() => setTab(v)}
                >
                  {v === "ledger" ? "Транзакции" : label(v)}
                </Button>
              ))}
            </div>
            {tab === "overview" ? (
              <div className="space-y-4">
                <PropCashComparison months={months} currency={selectedCurrency} privacy={privacy} />
                <details
                  className="rounded-xl border bg-card"
                  open={showBreakdowns}
                  onToggle={(event) => setShowBreakdowns(event.currentTarget.open)}
                >
                  <summary className="cursor-pointer p-4">
                    <span className="text-sm font-medium">Подробная аналитика</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Чистые деньги trend, firm returns, expense categories, account progress, renewals
                      and monthly записей
                    </span>
                  </summary>
                  {showBreakdowns && (
                    <div className="space-y-4 border-t p-3 sm:p-4">
                      <div className="grid gap-4 xl:grid-cols-3">
                        <Card className="xl:col-span-2">
                          <CardHeader>
                            <CardTitle>
                              Чистые деньги over time{selectedCurrency ? ` · ${selectedCurrency}` : ""}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {privacy ? (
                              <Empty>График скрыт в режиме конфиденциальности.</Empty>
                            ) : !selectedCurrency ? (
                              <Empty>Выберите валюту, чтобы построить график денежных результатов.</Empty>
                            ) : summaryCash.length ? (
                              <EquityArea
                                curve="stepAfter"
                                currency={selectedCurrency}
                                valueLabel="Чистые деньги за выбранный период"
                                data={cashTimeline(summaryCash).map((p) => ({
                                  t: p.date,
                                  cumNetPnl: p.net / 10 ** currencyDigits(selectedCurrency),
                                }))}
                              />
                            ) : (
                              <Empty>
                                Добавьте расход или полученную выплату, чтобы сформировать денежную историю.
                              </Empty>
                            )}
                            <p className="mt-3 text-xs text-muted-foreground">
                              Starts at zero for the selected period. Payouts + refunds − expenses −
                              reversals.
                            </p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader>
                            <CardTitle>Прогресс по счетам · все даты</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="flex justify-between text-sm">
                              <span>Активные оценки / верификации</span>
                              <strong>
                                {
                                  active.filter((a) =>
                                    ["evaluation", "verification"].includes(a.program),
                                  ).length
                                }
                              </strong>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Активные funded / live-счета</span>
                              <strong>
                                {
                                  active.filter((a) =>
                                    ["funded", "instant_funded", "live"].includes(a.program),
                                  ).length
                                }
                              </strong>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Доля успешных завершённых этапов</span>
                              <strong>
                                {resolved.length
                                  ? `${Math.round((passed / resolved.length) * 100)}%`
                                  : "—"}
                              </strong>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {passed} passed / {resolved.length} passed or breached evaluation
                              phases. Active and voluntarily closed phases are excluded; this is not
                              a whole-challenge success rate.
                            </p>
                            <p className="border-t pt-4 text-xs text-muted-foreground">
                              Link accounts to journal trades from account details. Funding sizes
                              are descriptive and never counted as your cash investment.
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                      <div className="grid gap-4 xl:grid-cols-2">
                        <Card>
                          <CardHeader>
                            <CardTitle>
                              Результат по фирмам{selectedCurrency ? ` · ${selectedCurrency}` : ""}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {byFirm.length ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                  <thead>
                                    <tr className="border-b text-xs text-muted-foreground">
                                      <th className="py-2">Фирма</th>
                                      <th>Чистые расходы</th>
                                      <th>Полученные выплаты</th>
                                      <th>Итоговый результат</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {byFirm.map((row) => (
                                      <tr key={row.firm} className="border-b last:border-0">
                                        <td className="py-3 pr-3">{row.firm}</td>
                                        <td className="pr-3">{money(row.netSpend)}</td>
                                        <td className="pr-3">{money(row.received)}</td>
                                        <td>{money(row.net)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <Empty>Нет денежных операций по выбранным фильтрам.</Empty>
                            )}
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader>
                            <CardTitle>Структура расходов</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {byCategory.length ? (
                              byCategory.map((row) => (
                                <div key={row.category}>
                                  <div className="flex justify-between gap-3 text-sm">
                                    <span>{label(row.category)}</span>
                                    <span>{money(row.amount)}</span>
                                  </div>
                                  {!privacy && (
                                    <div className="mt-1 h-1.5 rounded-full bg-muted">
                                      <div
                                        className="h-full rounded-full bg-foreground/60"
                                        style={{
                                          width: `${summary.spent ? (row.amount / summary.spent) * 100 : 0}%`,
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              ))
                            ) : (
                              <Empty>Нет расходов по выбранным фильтрам.</Empty>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Валовые расходы по категориям. Возвраты отображаются в итогах отдельно.
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                      <Card>
                        <CardHeader>
                          <CardTitle>Ближайшие продления · следующие 30 дней и просроченные</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {renewals.length ? (
                            <div className="space-y-3">
                              {renewals.map((a) => (
                                <div
                                  key={a.id}
                                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                                >
                                  <div>
                                    <p className="text-sm font-medium">
                                      {a.firm} · {a.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {a.renewalOn} ·{" "}
                                      {a.renewalMinor === null
                                        ? "Сумма не указана"
                                        : money(a.renewalMinor, a.currency)}
                                      {a.renewalOn! < data.today ? " · Проверьте просроченное продление" : ""}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={readOnly}
                                    onClick={() =>
                                      setModal({
                                        kind: "entry",
                                        type: "expense",
                                        accountId: a.id,
                                        category: "subscription",
                                      })
                                    }
                                  >
                                    Записать списание
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <Empty>Нет запланированных продлений.</Empty>
                          )}
                          <p className="mt-3 text-xs text-muted-foreground">
                            Reminders do not create expenses or charge your card. Update the next
                            date after reviewing a renewal.
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle>Ежемесячный обзор денег</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {months.length ? (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-sm">
                                <thead>
                                  <tr className="border-b text-xs text-muted-foreground">
                                    <th className="py-2">Месяц</th>
                                    <th>Потрачено</th>
                                    <th>Возвращено</th>
                                    <th>Полученные выплаты</th>
                                    <th>Итого</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {months.map((row) => (
                                    <tr key={row.month} className="border-b last:border-0">
                                      <td className="py-3">{row.month}</td>
                                      <td>{money(row.spent)}</td>
                                      <td>{money(row.refunds)}</td>
                                      <td>{money(row.received)}</td>
                                      <td>{money(row.net)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <Empty>Пока нет завершённых денежных операций.</Empty>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </details>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    aria-label="Поиск записей проп-фирм"
                    className="max-w-sm"
                    placeholder="Поиск фирмы, счёта, ссылки или статуса"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {tab === "accounts" && (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={showArchived}
                        onChange={(e) => setShowArchived(e.target.checked)}
                      />
                      Показать архивные счета
                    </label>
                  )}
                  {tab === "ledger" && (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={showАннулировано}
                        onChange={(e) => setShowАннулировано(e.target.checked)}
                      />
                      Показать аннулированные записи
                    </label>
                  )}
                  <p className="ml-auto text-xs text-muted-foreground">{rowCount} записей</p>
                </div>
                {tab === "accounts" && (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {slice(listedAccounts).map((a) => {
                      const accountSummary = cashSummary(
                        (cashByAccount.get(a.id) ?? []).filter(
                          (row) => row.currency === a.currency,
                        ),
                      );
                      return (
                        <Card key={a.id}>
                          <CardContent className="space-y-4 py-5">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3 className="font-semibold">{a.name}</h3>
                                <p className="text-xs text-muted-foreground">
                                  {a.firm} · {label(a.program)}
                                  {a.sizeMinor !== null
                                    ? ` · ${money(a.sizeMinor, a.currency)} номинал`
                                    : ""}
                                </p>
                              </div>
                              <span className="rounded-md border px-2 py-1 text-xs">
                                {a.archived ? "Архивный · " : ""}
                                {label(a.status)}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-sm">
                              <div>
                                <p className="text-xs text-muted-foreground">Чистые расходы</p>
                                {money(accountSummary.netSpend, a.currency)}
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Полученные выплаты</p>
                                {money(accountSummary.received, a.currency)}
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Итоговый результат</p>
                                {money(accountSummary.net, a.currency)}
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Открыт {a.openedOn}
                              {a.closedOn ? ` · Завершён ${a.closedOn}` : ""}
                              {a.parentId ? ` · Продолжает ${name(a.parentId)}` : ""}. Cash follows the
                              selected dates.
                            </p>
                            <div className="flex flex-wrap gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={readOnly}
                                onClick={() =>
                                  setModal({ kind: "detail", type: "account", id: a.id })
                                }
                              >
                                Подробнее и поступления
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={readOnly}
                                onClick={() => setModal({ kind: "account", account: a })}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={readOnly}
                                onClick={() => setModal({ kind: "account", parent: a })}
                              >
                                Следующая попытка / этап
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={readOnly}
                                onClick={() =>
                                  setModal({
                                    kind: "change",
                                    action: "account.archive",
                                    id: a.id,
                                    revision: a.revision,
                                    value: !a.archived,
                                    name: a.archived ? "Восстановить счёт" : "Архивировать счёт",
                                  })
                                }
                              >
                                {a.archived ? "Восстановить" : "Архивировать"}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
                {tab === "payouts" && (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Open requests always remain visible. Completed, rejected and cancelled
                      requests use the request-date filter. Ожидается amounts are after your share
                      and withheld fees; actual amounts come only from receipts.
                    </p>
                    {slice(listedPayouts).map((row) => (
                      <Card key={row.entry.id}>
                        <CardContent className="space-y-4 py-5">
                          <div className="flex flex-wrap justify-between gap-3">
                            <div>
                              <h3 className="font-medium">
                                {row.entry.firm} · {name(row.entry.accountId)}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                Запрошено {row.entry.occurredOn}
                                {row.entry.dueOn ? ` · Ожидается ${row.entry.dueOn}` : ""}
                              </p>
                            </div>
                            <span
                              className={`rounded-md border px-2 py-1 text-xs ${row.overdue ? "border-destructive text-destructive" : ""}`}
                            >
                              {row.overdue
                                ? "Просрочено · "
                                : row.partial
                                  ? "Получено частично · "
                                  : ""}
                              {label(row.entry.status)}
                            </span>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Ожидается net</p>
                              {money(row.expected, row.entry.currency)}
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Фактически получено</p>
                              {money(row.actual, row.entry.currency)}
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Осталось получить</p>
                              {money(row.remaining, row.entry.currency)}
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Факт − ожидание</p>
                              {money(row.variance, row.entry.currency)}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              disabled={
                                readOnly || ["rejected", "cancelled"].includes(row.entry.status)
                              }
                              onClick={() => setModal({ kind: "receipt", payout: row.entry })}
                            >
                              Записать поступление / отмену
                            </Button>
                            {entryActions(row.entry)}
                          </div>
                          <details>
                            <summary className="cursor-pointer text-xs">
                              Денежные операции · {(receiptsById.get(row.entry.id) ?? []).length}
                            </summary>
                            <div className="mt-2 space-y-2">
                              {(receiptsById.get(row.entry.id) ?? []).map((r) => (
                                <div
                                  key={r.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-xs"
                                >
                                  <span>
                                    {r.occurredOn} · {label(r.kind)} ·{" "}
                                    {money(r.amountMinor, row.entry.currency)}
                                    {r.voided ? " · Аннулировано" : ""}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={readOnly || row.entry.voided}
                                    onClick={() =>
                                      setModal({
                                        kind: "change",
                                        action: "receipt.void",
                                        id: r.id,
                                        payoutId: r.payoutId,
                                        revision: row.entry.revision,
                                        value: !r.voided,
                                        name: r.voided
                                          ? "Восстановить денежную операцию"
                                          : "Аннулировать денежную операцию",
                                      })
                                    }
                                  >
                                    {r.voided ? "Восстановить" : "Аннулировать"}
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </details>
                        </CardContent>
                      </Card>
                    ))}
                  </>
                )}
                {tab === "ledger" && (
                  <Card>
                    <CardContent className="overflow-x-auto pt-4">
                      <p className="mb-3 text-xs text-muted-foreground">
                        Expenses and refunds use cash dates; payout rows use request dates. Export
                        cash CSV for individual settlement dates. Payout requests do not count as
                        income.
                      </p>
                      <table className="w-full min-w-[740px] text-left text-sm">
                        <thead>
                          <tr className="border-b text-xs text-muted-foreground">
                            <th className="py-2">Дата</th>
                            <th>Фирма / счёт</th>
                            <th>Запись</th>
                            <th>Сумма</th>
                            <th>Статус</th>
                            <th>Действия</th>
                          </tr>
                        </thead>
                        <tbody>
                          {slice(entries).map((entry) => (
                            <tr
                              key={entry.id}
                              className={`border-b last:border-0 ${entry.voided ? "opacity-60" : ""}`}
                            >
                              <td className="py-3 pr-3">{entry.occurredOn}</td>
                              <td className="pr-3">
                                {entry.firm}
                                <p className="text-xs text-muted-foreground">
                                  {name(entry.accountId)}
                                </p>
                              </td>
                              <td className="pr-3">
                                {label(entry.kind)}
                                <p className="text-xs text-muted-foreground">
                                  {entry.kind === "expense"
                                    ? label(entry.category)
                                    : entry.reference}
                                </p>
                              </td>
                              <td className="pr-3 tabular-nums">
                                {money(
                                  entry.kind === "payout"
                                    ? (payoutById.get(entry.id)?.expected ?? 0)
                                    : entry.amountMinor,
                                  entry.currency,
                                )}
                                {entry.kind === "payout" && (
                                  <p className="text-xs text-muted-foreground">Ожидается net</p>
                                )}
                              </td>
                              <td>{entry.voided ? "Аннулировано" : label(entry.status)}</td>
                              <td>{entryActions(entry)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                )}
                {!rowCount && <Empty>No записей match this view.</Empty>}
                {!rowCount && <Empty>Нет записей, соответствующих выбранному представлению.</Empty>}

{rowCount > PAGE_SIZE && (
  <div className="flex items-center justify-between">
    <Button
      variant="outline"
      disabled={safePage === 0}
      onClick={() => setPage(safePage - 1)}
    >
      Назад
    </Button>

    <span className="text-xs">
      Страница {safePage + 1} из {Math.ceil(rowCount / PAGE_SIZE)}
    </span>

    <Button
      variant="outline"
      disabled={(safePage + 1) * PAGE_SIZE >= rowCount}
      onClick={() => setPage(safePage + 1)}
    >
      Далее
    </Button>
  </div>
)}
              </div>
            )}
            <details className="rounded-xl border p-4 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium">Как рассчитываются показатели</summary>
              <div className="mt-3 space-y-2">
                <p>
                  Чистые деньги return = actual payout receipts − payout reversals + expense refunds −
                  spending. Net spend = spending − refunds. ROI = net cash return ÷ net spend; it is
                  unavailable when net spend is zero or negative.
                </p>
                <p>
                  Amounts use each currency’s minor units. Currencies are never converted or
                  combined automatically. Your firm’s actual approval, payout rules and bank
                  statement remain authoritative.
                </p>
                <p>
                  Past attempts, breached accounts and archived accounts stay in cash returns.
                  Shared firm costs are included in firm totals but are not silently allocated to
                  individual accounts.
                </p>
                <p>
                  Requests and reminders never move money. This tracker does not place trades,
                  connect banks, infer payout eligibility, or change journal trading P&L. JSON
                  exports in Settings include these записей and their audit history; copy the data
                  directory to preserve attachment files too.
                </p>
              </div>
            </details>
          </>
        )}
        {modal && data && !readOnly && (
          <PropFirmModal modal={modal} data={data} close={() => setModal(null)} refresh={refresh} />
        )}
      </div>
    </div>
  );
}
function EXPENSE_ROWS(rows: CashMovement[]) {
  const groups = new Map<string, number>();
  for (const row of rows)
    if (row.kind === "expense")
      groups.set(row.category, (groups.get(row.category) ?? 0) + row.amountMinor);
  return [...groups]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}
