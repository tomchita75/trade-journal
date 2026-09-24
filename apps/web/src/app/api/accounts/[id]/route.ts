import { eq } from "drizzle-orm";
import { accounts, db, executions, trades } from "@/db";
import { bad, handler, ok } from "@/server/api";
import { decryptJson, encryptJson } from "@/server/crypto";
import { rebuildAccount } from "@/server/rebuild";

type Params = { params: Promise<{ id: string }> };

type Credentials = Record<string, string>;

interface PatchBody {
  name?: string;
  broker?: string;
  currency?: string;
  initialBalance?: number;
  profitCalcMethod?: "fifo" | "lifo" | "wavg";
  autoSync?: boolean;
  credentials?: Credentials;
}

export const PATCH = handler(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const account = db.select().from(accounts).where(eq(accounts.id, id)).get();

  if (!account) return bad("Account not found", 404);

  const body = (await request.json()) as PatchBody;
  const patch: Partial<typeof accounts.$inferInsert> = {};

  if (body.name !== undefined) patch.name = body.name;
  if (body.broker !== undefined) patch.broker = body.broker;
  if (body.currency !== undefined) patch.currency = body.currency;
  if (body.initialBalance !== undefined) patch.initialBalance = body.initialBalance;
  if (body.autoSync !== undefined) patch.autoSync = body.autoSync;

  if (body.profitCalcMethod !== undefined) {
    patch.profitCalcMethod = body.profitCalcMethod;
  }

  if (body.credentials !== undefined) {
    if (account.kind !== "sync" || !account.credentialsEnc) {
      return bad("Only broker-connected accounts can update API credentials", 400);
    }

    const current = decryptJson<Credentials>(account.credentialsEnc);
    const incoming = body.credentials;

    const apiKeyChanged =
      incoming.apiKey !== undefined &&
      incoming.apiKey.trim() !== "" &&
      incoming.apiKey.trim() !== current.apiKey;

    const incomingSecret = incoming.apiSecret?.trim();

    if (apiKeyChanged && !incomingSecret) {
      return bad("Enter the new API secret together with the new API key", 400);
    }

    const next: Credentials = { ...current };

    for (const [key, value] of Object.entries(incoming)) {
      const trimmed = value.trim();

      // Empty API Secret means: retain the encrypted secret currently stored.
      if (key.toLowerCase().includes("secret") && trimmed === "") continue;

      // Do not allow empty values to erase stored credentials.
      if (trimmed === "") continue;

      next[key] = trimmed;
    }

    if (!next.apiKey || !next.apiSecret) {
      return bad("API key and API secret are required", 400);
    }

    if (
      account.broker === "bybit" &&
      next.marketType !== undefined &&
      next.marketType !== "spot" &&
      next.marketType !== "linear"
    ) {
      return bad("Bybit market type must be spot or linear", 400);
    }

    patch.credentialsEnc = encryptJson(next);
  }

  if (Object.keys(patch).length > 0) {
    db.update(accounts).set(patch).where(eq(accounts.id, id)).run();
  }

  if (body.profitCalcMethod && body.profitCalcMethod !== account.profitCalcMethod) {
    rebuildAccount(id);
  }

  return ok({ updated: true });
});

export const DELETE = handler(async (_request: Request, { params }: Params) => {
  const { id } = await params;

  db.transaction((tx) => {
    tx.delete(trades).where(eq(trades.accountId, id)).run();
    tx.delete(executions).where(eq(executions.accountId, id)).run();
    tx.delete(accounts).where(eq(accounts.id, id)).run();
  });

  return ok({ deleted: true });
});