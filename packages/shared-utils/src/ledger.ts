/**
 * @bazaar/shared-utils — Customer Khata (Running Ledger)
 *
 * Pure ledger calculation and running balance management.
 */

export interface CustomerLedgerEntryModel {
  id: string;
  customerId: string;
  type: 'SaleCredit' | 'PaymentReceived' | 'Adjustment';
  debit: number;
  credit: number;
  balance: number;
  referenceNo?: string;
  notes?: string;
  date: string;
}

/**
 * Calculate the new running balance after a debit or credit entry.
 * In a customer khata:
 * - Debit represents credit extended to customer (increases what customer owes).
 * - Credit represents payment received from customer (reduces what customer owes).
 */
export function calculateRunningBalance(
  previousBalance: number,
  debit: number,
  credit: number
): number {
  return Math.round((previousBalance + debit - credit) * 100) / 100;
}

/**
 * Recompute running balances for an entire series of ledger transactions.
 */
export function recomputeLedgerBalances(
  entries: Array<Omit<CustomerLedgerEntryModel, 'balance'>>
): CustomerLedgerEntryModel[] {
  let running = 0;
  return entries.map(entry => {
    running = calculateRunningBalance(running, entry.debit, entry.credit);
    return {
      ...entry,
      balance: running,
    };
  });
}
