import type { LedgerEntry } from "../types/game";

let entryCounter = 0;

export function createLedgerEntry(
  partial: Omit<LedgerEntry, "id">,
): LedgerEntry {
  entryCounter += 1;
  return { id: `ledger-${entryCounter}`, ...partial };
}
