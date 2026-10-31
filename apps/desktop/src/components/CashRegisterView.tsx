import React, { useState } from 'react';
import { sqliteDB } from '../db/sqliteStorage';
import { CashRegisterShift, CashTransaction } from '../types';
import { 
  DollarSign, 
  Lock, 
  Unlock, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ShieldAlert, 
  Receipt,
  FileText,
  Clock,
  PlusCircle,
  Calculator,
  ShoppingBag,
  CreditCard
} from 'lucide-react';
import { blockInvalidNumberKeys } from '@bazaar/shared-utils';

export const CashRegisterView: React.FC = () => {
  const [currentShift, setCurrentShift] = useState<CashRegisterShift | undefined>(sqliteDB.getCurrentCashShift());
  const [shiftsHistory, setShiftsHistory] = useState<CashRegisterShift[]>(sqliteDB.getCashShifts());
  const [transactions, setTransactions] = useState<CashTransaction[]>(sqliteDB.getCashTransactions());

  // Modal forms
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showTxnModal, setShowTxnModal] = useState(false);

  // Form inputs
  const [openingFloat, setOpeningFloat] = useState(2000);
  const [closingCashCount, setClosingCashCount] = useState<number>(0);
  const [shiftNotes, setShiftNotes] = useState('');

  const [txnType, setTxnType] = useState<'CashIn' | 'CashOut' | 'SafeDeposit'>('CashIn');
  const [txnAmount, setTxnAmount] = useState<number | ''>('');
  const [txnReason, setTxnReason] = useState('');

  // Blind count: track whether the cashier has committed their physical count
  // Expected amount is hidden until *after* the cashier enters their count
  const [blindCountSubmitted, setBlindCountSubmitted] = useState(false);

  const refreshData = () => {
    setCurrentShift(sqliteDB.getCurrentCashShift());
    setShiftsHistory(sqliteDB.getCashShifts());
    setTransactions(sqliteDB.getCashTransactions());
  };

  const shiftCalc = currentShift ? sqliteDB.getShiftExpectedCash(currentShift) : null;
  const shiftPaymentBreakdown = currentShift ? sqliteDB.getShiftPaymentBreakdown(currentShift) : null;

  const handleOpenShift = (e: React.FormEvent) => {
    e.preventDefault();
    sqliteDB.openCashShift(Number(openingFloat), shiftNotes);
    setShowOpenModal(false);
    setShiftNotes('');
    refreshData();
  };

  const handleCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    sqliteDB.closeCashShift(Number(closingCashCount), shiftNotes);
    setShowCloseModal(false);
    setShiftNotes('');
    setBlindCountSubmitted(false);
    setClosingCashCount(0);
    refreshData();
  };

  const handleAddTxn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txnAmount || Number(txnAmount) <= 0 || !txnReason.trim()) return;
    sqliteDB.addCashTransaction(txnType, Number(txnAmount), txnReason);
    setShowTxnModal(false);
    setTxnAmount('');
    setTxnReason('');
    refreshData();
  };

  const currency = sqliteDB.getSettings().currencySymbol || '₹';

  return (
    <div className="p-3 md:p-5 space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs">
        <div>
          <h1 className="text-base font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
            Cash Register & Shifts
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
            Shift float reconciliation, drawer in/out movements, and audit log.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {currentShift ? (
            <>
              <button
                onClick={() => setShowTxnModal(true)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-lg font-medium text-xs transition flex items-center gap-1.5 cursor-pointer border border-slate-200/60 dark:border-zinc-700/60"
              >
                <PlusCircle className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                <span>Cash In / Out</span>
              </button>
              <button
                onClick={() => {
                  if (currentShift) {
                    setClosingCashCount(0);
                    setBlindCountSubmitted(false);
                  }
                  setShowCloseModal(true);
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-medium text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Close Shift</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowOpenModal(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Open Register Shift</span>
            </button>
          )}
        </div>
      </div>

      {/* Current Shift Summary Cards */}
      {currentShift && shiftCalc ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {/* Opening Cash Float */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-3.5 rounded-2xl shadow-xs">
            <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">Opening Float</div>
            <div className="text-xl font-mono font-semibold text-slate-900 dark:text-zinc-100 mt-0.5">
              {currency}{shiftCalc.openingCash.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3" />
              {new Date(currentShift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          {/* Shift Cash Sales */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-3.5 rounded-2xl shadow-xs">
            <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium flex items-center gap-1">
              <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
              Cash Sales
            </div>
            <div className="text-xl font-mono font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
              +{currency}{shiftCalc.totalCashSales.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
              From cash checkouts
            </div>
          </div>

          {/* Cash Added */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-3.5 rounded-2xl shadow-xs">
            <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-slate-400" />
              Cash Added (In)
            </div>
            <div className="text-xl font-mono font-semibold text-slate-900 dark:text-zinc-100 mt-0.5">
              +{currency}{shiftCalc.cashInTotal.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
              Float additions
            </div>
          </div>

          {/* Payouts */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-3.5 rounded-2xl shadow-xs">
            <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium flex items-center gap-1">
              <ArrowDownLeft className="w-3 h-3 text-slate-400" />
              Cash Out
            </div>
            <div className="text-xl font-mono font-semibold text-slate-900 dark:text-zinc-100 mt-0.5">
              -{currency}{shiftCalc.cashOutTotal.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
              Expenses & payouts
            </div>
          </div>

          {/* Safe Drops */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-3.5 rounded-2xl shadow-xs">
            <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-slate-400" />
              Safe Deposits
            </div>
            <div className="text-xl font-mono font-semibold text-slate-900 dark:text-zinc-100 mt-0.5">
              -{currency}{shiftCalc.safeDepositTotal.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
              Locker drops
            </div>
          </div>

          {/* Expected Drawer Total */}
          <div className="bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 p-3.5 rounded-2xl shadow-xs">
            <div className="text-[11px] font-medium opacity-80 flex items-center gap-1">
              <Calculator className="w-3.5 h-3.5" />
              Expected Drawer
            </div>
            <div className="text-xl font-mono font-bold mt-0.5">
              {currency}{shiftCalc.expectedCash.toLocaleString()}
            </div>
            <div className="text-[10px] opacity-70 mt-1">
              Live drawer balance
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl text-center space-y-2.5 shadow-xs">
          <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto stroke-1" />
          <h3 className="font-semibold text-slate-900 dark:text-zinc-100 text-sm">No Active Shift</h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
            Opening a shift starts drawer tracking for cash inflows, expenses, and reconciliation.
          </p>
          <button
            onClick={() => setShowOpenModal(true)}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-black dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-white rounded-lg font-medium text-xs shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>Open Register Shift</span>
          </button>
        </div>
      )}

      {/* Recent Cash Drawer Transactions */}
      <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-zinc-100 text-xs flex items-center gap-2">
            <Receipt className="w-3.5 h-3.5 text-slate-500" />
            Drawer Activity Log
          </h3>
          <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500">{transactions.length} Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-zinc-300">
            <thead className="bg-slate-50/60 dark:bg-zinc-950/40 uppercase text-[10px] font-medium text-slate-500 dark:text-zinc-400 border-b border-slate-200/70 dark:border-zinc-800">
              <tr>
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Amount</th>
                <th className="py-2.5 px-3">Reason</th>
                <th className="py-2.5 px-3">Cashier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 dark:text-zinc-500 text-xs">No drawer movements logged today</td>
                </tr>
              ) : (
                transactions.slice(0, 15).map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400 dark:text-zinc-500">{new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        t.type === 'CashIn' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' :
                        t.type === 'CashOut' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' :
                        'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                      }`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-900 dark:text-zinc-100">
                      {currency}{t.amount.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300">{t.reason}</td>
                    <td className="py-2.5 px-3 text-slate-400 dark:text-zinc-500">{t.cashierName}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shifts History */}
      <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 space-y-3 shadow-xs">
        <h3 className="font-semibold text-slate-900 dark:text-zinc-100 text-xs flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-slate-500" />
          Previous Shifts
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-zinc-300">
            <thead className="bg-slate-50/60 dark:bg-zinc-950/40 uppercase text-[10px] font-medium text-slate-500 dark:text-zinc-400 border-b border-slate-200/70 dark:border-zinc-800">
              <tr>
                <th className="py-2.5 px-3">Shift ID</th>
                <th className="py-2.5 px-3">Start</th>
                <th className="py-2.5 px-3">End</th>
                <th className="py-2.5 px-3 font-mono">Opening</th>
                <th className="py-2.5 px-3 font-mono">Expected</th>
                <th className="py-2.5 px-3 font-mono">Counted</th>
                <th className="py-2.5 px-3">Difference</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
              {shiftsHistory.map(s => (
                <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition">
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 dark:text-zinc-400">{s.id}</td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">{new Date(s.startTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">{s.endTime ? new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  <td className="py-2.5 px-3 font-mono">{currency}{s.openingCash.toLocaleString()}</td>
                  <td className="py-2.5 px-3 font-mono">{s.expectedCash !== undefined ? `${currency}${s.expectedCash.toLocaleString()}` : '-'}</td>
                  <td className="py-2.5 px-3 font-mono font-medium">{s.closingCash !== undefined ? `${currency}${s.closingCash.toLocaleString()}` : '-'}</td>
                  <td className="py-2.5 px-3 font-mono">
                    {s.cashDifference !== undefined ? (
                      <span className={`font-medium ${s.cashDifference === 0 ? 'text-emerald-600 dark:text-emerald-400' : s.cashDifference > 0 ? 'text-sky-600 dark:text-sky-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {s.cashDifference >= 0 ? `+${currency}${s.cashDifference.toLocaleString()}` : `-${currency}${Math.abs(s.cashDifference).toLocaleString()}`}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      s.status === 'Open' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Open Shift */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleOpenShift} className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Unlock className="w-5 h-5 text-emerald-600" />
              Open Cash Register Shift
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Opening Cash Float ({currency})
              </label>
              <input
                type="number"
                min={0}
                onKeyDown={blockInvalidNumberKeys}
                value={openingFloat}
                onChange={e => setOpeningFloat(Math.max(0, Number(e.target.value)))}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-100"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Shift Notes / Remarks
              </label>
              <textarea
                value={shiftNotes}
                onChange={e => setShiftNotes(e.target.value)}
                placeholder="Initial drawer cash setup notes..."
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowOpenModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                Start Shift
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Close Shift with Full Calculation Breakdown */}
      {showCloseModal && currentShift && shiftCalc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCloseShift} className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Lock className="w-5 h-5 text-rose-600" />
              Close Register & Reconcile Cash
            </h3>

            {/* Shift Cash Calculation Breakdown Box */}
            <div className="bg-slate-50 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5 text-xs">
              <div className="font-bold text-slate-800 dark:text-slate-200 pb-2 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-emerald-600" />
                  Drawer Cash Calculation Breakdown
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Active Shift</span>
              </div>

              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>(+) Opening Cash Float</span>
                <span className="font-mono font-semibold">{currency}{shiftCalc.openingCash.toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-medium">
                <span>(+) Total Cash Sales (Current Shift)</span>
                <span className="font-mono font-semibold">+{currency}{shiftCalc.totalCashSales.toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-sky-700 dark:text-sky-400">
                <span>(+) Cash Added (In)</span>
                <span className="font-mono font-semibold">+{currency}{shiftCalc.cashInTotal.toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-amber-700 dark:text-amber-400">
                <span>(-) Cash Out (Payouts)</span>
                <span className="font-mono font-semibold">-{currency}{shiftCalc.cashOutTotal.toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-purple-700 dark:text-purple-400">
                <span>(-) Safe Drops</span>
                <span className="font-mono font-semibold">-{currency}{shiftCalc.safeDepositTotal.toLocaleString()}</span>
              </div>

              <div className="pt-2 border-t border-slate-300 dark:border-slate-600 flex justify-between items-center font-bold text-slate-900 dark:text-slate-100 text-sm">
                <span>= Expected Cash in Drawer</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">{currency}{shiftCalc.expectedCash.toLocaleString()}</span>
              </div>
            </div>

            {/* Non-Cash Sales Notice */}
            {shiftPaymentBreakdown && (shiftPaymentBreakdown.totalSales - shiftPaymentBreakdown.cashSales > 0) && (
              <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 rounded-xl text-xs text-blue-800 dark:text-blue-300 space-y-1">
                <div className="font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5" />
                    Non-Cash Payments (Excluded from Cash Drawer):
                  </span>
                  <span className="font-mono font-bold">{currency}{(shiftPaymentBreakdown.totalSales - shiftPaymentBreakdown.cashSales).toLocaleString()}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 text-[11px] text-blue-700 dark:text-blue-400">
                  {shiftPaymentBreakdown.upiSales > 0 && <span>UPI: {currency}{shiftPaymentBreakdown.upiSales.toLocaleString()}</span>}
                  {shiftPaymentBreakdown.cardSales > 0 && <span>Card: {currency}{shiftPaymentBreakdown.cardSales.toLocaleString()}</span>}
                  {shiftPaymentBreakdown.creditSales > 0 && <span>Credit: {currency}{shiftPaymentBreakdown.creditSales.toLocaleString()}</span>}
                  {shiftPaymentBreakdown.otherSales > 0 && <span>Other: {currency}{shiftPaymentBreakdown.otherSales.toLocaleString()}</span>}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Actual Cash Counted in Drawer ({currency})
              </label>
              {/* Blind-count input: cashier counts physical cash WITHOUT seeing the expected amount */}
              <input
                type="number"
                min={0}
                onKeyDown={blockInvalidNumberKeys}
                value={closingCashCount === 0 && !blindCountSubmitted ? '' : closingCashCount}
                onChange={e => {
                  setClosingCashCount(Math.max(0, Number(e.target.value)));
                  setBlindCountSubmitted(false);
                }}
                onBlur={() => {
                  if (closingCashCount > 0 || (closingCashCount === 0 && blindCountSubmitted === false)) {
                    setBlindCountSubmitted(true);
                  }
                }}
                placeholder="Enter physical cash count first…"
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-100"
                required
              />
              {!blindCountSubmitted && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                  ⚠ Count your physical cash first. Expected amount is hidden until you enter your count.
                </p>
              )}
            </div>

            {/* Live Variance: only revealed AFTER cashier enters their blind count */}
            {blindCountSubmitted && (
              <div className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between border ${
                closingCashCount - shiftCalc.expectedCash === 0
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : closingCashCount - shiftCalc.expectedCash > 0
                  ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
              }`}>
                <div className="space-y-0.5">
                  <div>Expected in Drawer: <span className="font-mono font-bold">{currency}{shiftCalc.expectedCash.toLocaleString()}</span></div>
                  <div>Your Count: <span className="font-mono font-bold">{currency}{Number(closingCashCount).toLocaleString()}</span></div>
                </div>
                <span className="font-bold font-mono text-xs">
                  {closingCashCount - shiftCalc.expectedCash === 0
                    ? '✓ Balanced'
                    : closingCashCount - shiftCalc.expectedCash > 0
                    ? `+${currency}${(closingCashCount - shiftCalc.expectedCash).toLocaleString()} Over`
                    : `-${currency}${Math.abs(closingCashCount - shiftCalc.expectedCash).toLocaleString()} Short`}
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Closing Remarks / Reason for Discrepancy
              </label>
              <textarea
                value={shiftNotes}
                onChange={e => setShiftNotes(e.target.value)}
                placeholder="Notes on drawer balancing..."
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                Complete & Close Shift
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Cash In/Out */}
      {showTxnModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleAddTxn} className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Record Cash Drawer Transaction
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Transaction Type</label>
              <select
                value={txnType}
                onChange={e => setTxnType(e.target.value as any)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-semibold"
              >
                <option value="CashIn">Cash In (Float Addition)</option>
                <option value="CashOut">Cash Out (Petty Cash Expense)</option>
                <option value="SafeDeposit">Safe Deposit Drop</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Amount ({currency})</label>
              <input
                type="number"
                min={1}
                onKeyDown={blockInvalidNumberKeys}
                value={txnAmount}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  setTxnAmount(isNaN(val) ? '' : Math.max(0, val));
                }}
                placeholder="0"
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-100"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Reason / Voucher Info</label>
              <input
                type="text"
                value={txnReason}
                onChange={e => setTxnReason(e.target.value)}
                placeholder="e.g. Milk delivery payment, Additional float change"
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowTxnModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                Save Transaction
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

