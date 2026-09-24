"use client";
import { OptionSelect } from "@/components/ui/option-select";

import { MonetaryField } from "./privacy";
import { useEffect, useState } from "react";
import { useApi, postJson } from "@/lib/use-api";
import {
  EMPTY_DEFAULTS,
  type JournalDefaults,
  type FeeRule,
  type RiskRule,
} from "@/lib/journal-defaults";
import { Field, fieldClass } from "@/components/filter-fields";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
export function JournalDefaultSettings() {
  const { data, error } = useApi<JournalDefaults>("/api/workspace/defaults"),
    { data: accounts } = useApi<{ accounts: { id: string; name: string }[] }>("/api/accounts");
  const [draft, setDraft] = useState(EMPTY_DEFAULTS),
    [status, setStatus] = useState("");
  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);
  const matchFields = (r: FeeRule | RiskRule, update: (r: FeeRule | RiskRule) => void) => (
    <>
      <Field label="Аккаунт">
        <OptionSelect
          className={fieldClass}
          value={r.accountId}
          onValueChange={(next) => update({ ...r, accountId: next })}
        >
          <option value="">Все аккаунты</option>
          {accounts?.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </OptionSelect>
      </Field>
      <Field label="Тикер (пусто = все)">
        <input
          className={fieldClass}
          value={r.symbol}
          placeholder="например, ES"
          onChange={(e) => update({ ...r, symbol: e.target.value.toUpperCase() })}
        />
      </Field>
    </>
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Безубыток, комиссии и риски по умолчанию</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Диапазон безубытка (±)">
            <MonetaryField sensitive={draft.breakevenMode === "money"}>
              <input
                type="number"
                step="any"
                min="0"
                className={fieldClass}
                value={draft.breakeven}
                onChange={(e) => setDraft({ ...draft, breakeven: Number(e.target.value) })}
              />
            </MonetaryField>
          </Field>
          <Field label="Единица диапазона">
            <OptionSelect
              className={fieldClass}
              value={draft.breakevenMode}
              onValueChange={(next) =>
                setDraft({ ...draft, breakevenMode: next as "money" | "percent" })
              }
            >
              <option value="money">Валюта аккаунта</option>
              <option value="percent">% от входного номинала</option>
            </OptionSelect>
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">
          Закрытые сделки в этом диапазоне чистого P&L считаются безубыточными. Фактический P&L не
          изменяется. Режим процента использует цену входа × общее количество на входе × множитель
          контракта; сначала настройте множители для деривативов.
        </p>
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Комиссии по умолчанию</h3>
          <p className="text-xs text-muted-foreground">
            Применяются к новым исполнениям с нулевой комиссией, включая явные нули. Неимпортированные
            ненулевые комиссии и существующие исполнения сохраняются. Побеждает первое совпадающее правило.
          </p>
          {draft.feeRules.map((r, i) => {
            const update = (next: FeeRule | RiskRule) =>
              setDraft({
                ...draft,
                feeRules: draft.feeRules.map((old, j) => (j === i ? (next as FeeRule) : old)),
              });
            return (
              <div key={r.id} className="space-y-2 rounded-md border p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {matchFields(r, update)}
                  <Field label="Сумма комиссии">
                    <MonetaryField>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className={fieldClass}
                        value={r.amount}
                        onChange={(e) => update({ ...r, amount: Number(e.target.value) })}
                      />
                    </MonetaryField>
                  </Field>
                  <Field label="Взимать за">
                    <OptionSelect
                      className={fieldClass}
                      value={r.mode}
                      onValueChange={(next) => update({ ...r, mode: next as FeeRule["mode"] })}
                    >
                      <option value="execution">Исполнение</option>
                      <option value="unit">Единица / контракт</option>
                    </OptionSelect>
                  </Field>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setDraft({ ...draft, feeRules: draft.feeRules.filter((x) => x.id !== r.id) })
                  }
                >
                  Удалить правило комиссии
                </Button>
              </div>
            );
          })}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setDraft({
                ...draft,
                feeRules: [
                  ...draft.feeRules,
                  {
                    id: crypto.randomUUID(),
                    accountId: "",
                    symbol: "",
                    amount: 0,
                    mode: "execution",
                  },
                ],
              })
            }
          >
            Добавить правило комиссии
          </Button>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Стоп и цель по умолчанию</h3>
          <p className="text-xs text-muted-foreground">
            Расстояния от взвешенного входа, скорректированные для направления лонг или шорт.
            Применяются только при первом создании новой сделки. Побеждает первое совпадающее правило.
          </p>
          {draft.riskRules.map((r, i) => {
            const update = (next: FeeRule | RiskRule) =>
              setDraft({
                ...draft,
                riskRules: draft.riskRules.map((old, j) => (j === i ? (next as RiskRule) : old)),
              });
            return (
              <div key={r.id} className="space-y-2 rounded-md border p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {matchFields(r, update)}
                  <Field label="Расстояние стопа">
                    <MonetaryField sensitive={r.mode === "price"}>
                      <input
                        type="number"
                        min="0.000001"
                        step="any"
                        className={fieldClass}
                        value={r.stop}
                        onChange={(e) => update({ ...r, stop: Number(e.target.value) })}
                      />
                    </MonetaryField>
                  </Field>
                  <Field label="Расстояние цели">
                    <MonetaryField sensitive={r.mode === "price"}>
                      <input
                        type="number"
                        min="0.000001"
                        step="any"
                        className={fieldClass}
                        value={r.target}
                        onChange={(e) => update({ ...r, target: Number(e.target.value) })}
                      />
                    </MonetaryField>
                  </Field>
                  <Field label="Единица расстояния">
                    <OptionSelect
                      className={fieldClass}
                      value={r.mode}
                      onValueChange={(next) => update({ ...r, mode: next as RiskRule["mode"] })}
                    >
                      <option value="price">Ценовые пункты</option>
                      <option value="percent">% от цены входа</option>
                    </OptionSelect>
                  </Field>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setDraft({ ...draft, riskRules: draft.riskRules.filter((x) => x.id !== r.id) })
                  }
                >
                  Удалить правило риска
                </Button>
              </div>
            );
          })}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setDraft({
                ...draft,
                riskRules: [
                  ...draft.riskRules,
                  {
                    id: crypto.randomUUID(),
                    accountId: "",
                    symbol: "",
                    stop: 1,
                    target: 2,
                    mode: "price",
                  },
                ],
              })
            }
          >
            Добавить правило риска
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={!data}
            onClick={async () => {
              try {
                setStatus("Сохранение…");
                await postJson("/api/workspace/defaults", draft);
                setStatus("Настройки по умолчанию сохранены");
              } catch (e) {
                setStatus(e instanceof Error ? e.message : "Ошибка сохранения.");
              }
            }}
          >
            Сохранить настройки
          </Button>
          <span role="status" className="text-xs">
            {status}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}