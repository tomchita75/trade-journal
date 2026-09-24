"use client";

import { Suspense, useEffect, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  KeyRound,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { FilterBar } from "@/components/filter-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MonetaryField, MonetaryValue } from "@/components/privacy";
import { postJson, useApi } from "@/lib/use-api";
import { fmtMoney } from "@/lib/utils";

interface AccountRow {
  id: string;
  name: string;
  broker: string;
  kind: "sync" | "import" | "manual";
  currency: string;
  initialBalance: number;
  profitCalcMethod: "fifo" | "lifo" | "wavg";
  autoSync: boolean;
  lastSyncAt: string | null;
  archivedAt: string | null;
  connected: boolean;
  snapshot: { equity: number; positions: unknown[] } | null;
}

export default function AccountsPage() {
  return (
    <Suspense>
      <Accounts />
    </Suspense>
  );
}

function Accounts() {
  const { data, refresh } = useApi<{ accounts: AccountRow[] }>("/api/accounts");
  const [syncing, setSyncing] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<AccountRow | null>(null);
const [rangeAccount, setRangeAccount] = useState<AccountRow | null>(null);
  const action = async <T = unknown,>(id: string, body: Record<string, unknown>) => {
    const result = await postJson<T>(`/api/accounts/${id}/actions`, body);
    refresh();
    return result;
  };

  const sync = async (id: string) => {
    setSyncing(id);

    try {
      const { sync: outcome } = await action<{
        sync: { inserted: number; skipped: number; skippedReasons: string[] };
      }>(id, { action: "sync" });

      if (outcome.skipped > 0) {
        alert(
          `Синхронизация завершена: ${outcome.inserted} новых исполнений. ` +
            `Пропущено: ${outcome.skipped}. ${outcome.skippedReasons.join(" ")}`,
        );
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Ошибка синхронизации");
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div>
      <FilterBar title="Аккаунты" />

      <div className="grid gap-3 p-4 md:grid-cols-2">
        {data?.accounts.length === 0 && (
          <p className="col-span-full py-16 text-center text-sm text-muted-foreground">
            Аккаунтов пока нет — создайте первый на странице Импорт.
          </p>
        )}

        {data?.accounts.map((account) => (
          <Card key={account.id} className={account.archivedAt ? "opacity-60" : undefined}>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="min-w-0 flex-1 text-base font-semibold normal-case tracking-normal text-foreground">
                <span className="block break-words">{account.name}</span>

                <Badge variant="secondary" className="mt-1.5 mr-2">
                  {account.kind === "sync"
                    ? "синхронизация"
                    : account.kind === "import"
                      ? "импорт"
                      : "ручной"}
                </Badge>

                {account.broker && (
                  <span className="text-xs font-normal text-muted-foreground">
                    {account.broker}
                  </span>
                )}
              </CardTitle>

              <div className="ml-auto flex shrink-0 items-center gap-1">
                {account.kind === "sync" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Редактировать API"
                    onClick={() => setEditingAccount(account)}
                  >
                    <KeyRound />
                  </Button>
                )}
{account.kind === "sync" && (
  <Button
    variant="ghost"
    size="icon"
    className="h-8 w-8"
    title="Синхронизировать за период"
    onClick={() => setRangeAccount(account)}
  >
    <CalendarDays />
  </Button>
)}
                {account.kind === "sync" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={syncing === account.id}
                    onClick={() => void sync(account.id)}
                    title="Синхронизировать сейчас"
                  >
                    <RefreshCw
                      className={syncing === account.id ? "animate-spin" : undefined}
                    />
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title={account.archivedAt ? "Вернуть из архива" : "В архив"}
                  onClick={() =>
                    void action(account.id, {
                      action: account.archivedAt ? "unarchive" : "archive",
                    })
                  }
                >
                  {account.archivedAt ? <ArchiveRestore /> : <Archive />}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  title="Удалить аккаунт"
                  onClick={async () => {
                    if (
                      confirm(
                        `Удалить "${account.name}" и ВСЕ его сделки? Это действие необратимо.`,
                      )
                    ) {
                      await postJson(`/api/accounts/${account.id}`, undefined, "DELETE");
                      refresh();
                    }
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {account.snapshot && (
                <div className="text-sm">
                  Эквити брокера:{" "}
                  <span className="tnum font-medium">
                    <MonetaryValue>{fmtMoney(account.snapshot.equity)}</MonetaryValue>
                  </span>

                  <span className="ml-2 text-xs text-muted-foreground">
                    {account.snapshot.positions.length} открытых позиций · синхронизировано{" "}
                    {account.lastSyncAt?.slice(0, 16).replace("T", " ")}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-muted-foreground">
                    Начальный баланс (для расчёта просадки %)
                  </label>

                  <MonetaryField>
                    <Input
                      defaultValue={account.initialBalance || ""}
                      placeholder="0"
                      inputMode="decimal"
                      onBlur={async (event) => {
                        const value = Number(event.target.value || 0);

                        if (value !== account.initialBalance) {
                          await postJson(
                            `/api/accounts/${account.id}`,
                            { initialBalance: value },
                            "PATCH",
                          );
                          refresh();
                        }
                      }}
                    />
                  </MonetaryField>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">Расчёт прибыли</label>

                  <Select
                    value={account.profitCalcMethod}
                    onValueChange={async (value) => {
                      await postJson(
                        `/api/accounts/${account.id}`,
                        { profitCalcMethod: value },
                        "PATCH",
                      );
                      refresh();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="fifo">FIFO</SelectItem>
                      <SelectItem value="lifo">LIFO</SelectItem>
                      <SelectItem value="wavg">Средневзвешенный</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
{account.kind === "sync" && (
  <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
    <input
      type="checkbox"
      checked={account.autoSync}
      onChange={async (event) => {
        await postJson(
          `/api/accounts/${account.id}`,
          { autoSync: event.target.checked },
          "PATCH",
        );
        refresh();
      }}
    />
    Автосинхронизация каждые 30 минут
  </label>
)}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (
                      confirm(
                        `Очистить ВСЕ сделки из "${account.name}"? Аккаунт останется.`,
                      )
                    ) {
                      await action(account.id, { action: "clear" });
                    }
                  }}
                >
                  Очистить сделки
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const others = (data?.accounts ?? []).filter(
                      (candidate) => candidate.id !== account.id,
                    );

                    if (others.length === 0) {
                      alert("Нет другого аккаунта для переноса.");
                      return;
                    }

                    const target = prompt(
                      `Перенести все данные в какой аккаунт?\n${others
                        .map((candidate, index) => `${index + 1}. ${candidate.name}`)
                        .join("\n")}\n\nВведите номер:`,
                    );

                    const chosen = others[Number(target) - 1];

                    if (chosen) {
                      await action(account.id, {
                        action: "transfer",
                        toAccountId: chosen.id,
                      });
                    }
                  }}
                >
                  Перенести данные
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <EditApiDialog
        account={editingAccount}
        open={editingAccount !== null}
        onOpenChange={(open) => {
          if (!open) setEditingAccount(null);
        }}
        onSaved={async () => {
          setEditingAccount(null);
          refresh();
        }}
      />
<SyncRangeDialog
  account={rangeAccount}
  open={rangeAccount !== null}
  onOpenChange={(open) => {
    if (!open) setRangeAccount(null);
  }}
  onSynced={async () => {
    setRangeAccount(null);
    refresh();
  }}
/>
    </div>
  );
}

function EditApiDialog({
  account,
  open,
  onOpenChange,
  onSaved,
}: {
  account: AccountRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [marketType, setMarketType] = useState<"spot" | "linear">("linear");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !account) return;

    setApiKey("");
    setApiSecret("");
    setMarketType("linear");
  }, [open, account?.id]);

  if (!account || account.kind !== "sync") return null;

  const isBybit = account.broker === "bybit";

  const save = async () => {
    const credentials: Record<string, string> = {};

    if (apiKey.trim()) credentials.apiKey = apiKey.trim();
    if (apiSecret.trim()) credentials.apiSecret = apiSecret.trim();
    if (isBybit) credentials.marketType = marketType;

    if (Object.keys(credentials).length === 0) {
      alert("Введите новый API Key и API Secret либо измените тип рынка.");
      return;
    }

    if (apiKey.trim() && !apiSecret.trim()) {
      alert("При замене API Key необходимо указать новый API Secret.");
      return;
    }

    setSaving(true);

    try {
      await postJson(`/api/accounts/${account.id}`, { credentials }, "PATCH");

      await postJson(`/api/accounts/${account.id}/actions`, { action: "sync" });

      await onSaved();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Не удалось обновить API.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Редактировать API</DialogTitle>

          <DialogDescription>
            {account.name}. Текущий API Secret не показывается. Оставьте поле Secret
            пустым, чтобы сохранить уже действующий ключ.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="edit-api-key">
              Новый API Key
            </label>

            <Input
              id="edit-api-key"
              autoComplete="off"
              placeholder="Оставьте пустым, чтобы не менять ключ"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="edit-api-secret">
              Новый API Secret
            </label>

            <Input
              id="edit-api-secret"
              type="password"
              autoComplete="new-password"
              placeholder="Оставьте пустым, чтобы сохранить текущий Secret"
              value={apiSecret}
              onChange={(event) => setApiSecret(event.target.value)}
            />
          </div>

          {isBybit && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Рынок Bybit</label>

              <Select
                value={marketType}
                onValueChange={(value) => setMarketType(value as "spot" | "linear")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="spot">Spot</SelectItem>
                  <SelectItem value="linear">Linear Futures</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            После сохранения будет выполнена синхронизация. Существующие сделки и записи
            журнала не удаляются.
          </p>
        </div>

 <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
  <Button
    type="button"
    variant="outline"
    disabled={saving}
    onClick={() => onOpenChange(false)}
  >
    Отмена
  </Button>

  <Button type="button" disabled={saving} onClick={() => void save()}>
    {saving ? "Сохранение…" : "Сохранить и синхронизировать"}
  </Button>
</div>
      </DialogContent>
    </Dialog>
  );
}
function SyncRangeDialog({
  account,
  open,
  onOpenChange,
  onSynced,
}: {
  account: AccountRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSynced: () => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStartDate(today);
    setEndDate(today);
  }, [open, today]);

  if (!account || account.kind !== "sync") return null;

  const syncRange = async () => {
    if (!startDate || !endDate) {
      alert("Выберите дату начала и дату окончания.");
      return;
    }

    if (startDate > endDate) {
      alert("Дата начала не может быть позже даты окончания.");
      return;
    }

    setSyncing(true);

    try {
      const result = await postJson<{
        sync: { inserted: number; skipped: number; skippedReasons: string[] };
      }>(`/api/accounts/${account.id}/actions`, {
        action: "sync",
        startDate,
        endDate,
      });

      alert(
        `Синхронизация завершена. Добавлено исполнений: ${result.sync.inserted}. ` +
          `Пропущено: ${result.sync.skipped}.`,
      );

      await onSynced();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Ошибка синхронизации");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Синхронизация за период</DialogTitle>
          <DialogDescription>
            {account.name}. Будут добавлены только исполнения в выбранных датах.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="sync-start-date">
              С даты
            </label>
            <Input
              id="sync-start-date"
              type="date"
              value={startDate}
              max={endDate || today}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="sync-end-date">
              По дату
            </label>
            <Input
              id="sync-end-date"
              type="date"
              value={endDate}
              min={startDate}
              max={today}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={syncing}
            onClick={() => onOpenChange(false)}
          >
            Отмена
          </Button>
          <Button type="button" disabled={syncing} onClick={() => void syncRange()}>
            {syncing ? "Синхронизация…" : "Синхронизировать"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}