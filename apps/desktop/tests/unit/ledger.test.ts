import { describe, it, expect } from 'vitest';
import {
  calculateRunningBalance,
  recomputeLedgerBalances,
  CustomerLedgerEntryModel,
} from '@bazaar/shared-utils';

describe('Khata Customer Ledger Balances (@bazaar/shared-utils)', () => {
  it('calculates running balance correctly for debit additions', () => {
    // Current balance 500 + new debit 200 - 0 = 700
    expect(calculateRunningBalance(500, 200, 0)).toBe(700);
  });

  it('calculates running balance correctly for credit payments', () => {
    // Current balance 700 + 0 debit - 300 credit = 400
    expect(calculateRunningBalance(700, 0, 300)).toBe(400);
  });

  it('handles credit payments exceeding balance as advance credit (negative balance)', () => {
    // Overpayment of ₹150 on ₹50 balance: net balance is -₹100 (advance deposit)
    expect(calculateRunningBalance(50, 0, 150)).toBe(-100);
  });

  it('recomputes complete ledger history chronologically', () => {
    const rawEntries: CustomerLedgerEntryModel[] = [
      {
        id: 'L1',
        customerId: 'C1',
        date: '2026-01-01',
        type: 'Adjustment',
        referenceNo: 'OPEN',
        debit: 500,
        credit: 0,
        balance: 0, // Needs recomputation
      },
      {
        id: 'L2',
        customerId: 'C1',
        date: '2026-01-05',
        type: 'SaleCredit',
        referenceNo: 'INV-01',
        debit: 350,
        credit: 0,
        balance: 0,
      },
      {
        id: 'L3',
        customerId: 'C1',
        date: '2026-01-10',
        type: 'PaymentReceived',
        referenceNo: 'REC-01',
        debit: 0,
        credit: 400,
        balance: 0,
      },
    ];

    const recomputed = recomputeLedgerBalances(rawEntries);

    expect(recomputed[0].balance).toBe(500);
    expect(recomputed[1].balance).toBe(850); // 500 + 350
    expect(recomputed[2].balance).toBe(450); // 850 - 400
  });

  it('handles empty ledger list gracefully', () => {
    expect(recomputeLedgerBalances([])).toEqual([]);
  });
});
