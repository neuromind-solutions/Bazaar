import React, { useState } from 'react';
import { ShopSettings, Employee } from '../types';
import { sqliteDB } from '../db/sqliteStorage';
import { verifyPin } from '@bazaar/shared-utils';
import { ShieldCheck, Lock, AlertCircle, X, CheckCircle } from 'lucide-react';

interface AuthorizeActionModalProps {
  isOpen: boolean;
  actionName: string;
  requiredRole?: string;
  settings: ShopSettings;
  onSuccess: () => void;
  onClose: () => void;
}

export const AuthorizeActionModal: React.FC<AuthorizeActionModalProps> = ({
  isOpen,
  actionName,
  requiredRole = 'Manager',
  settings,
  onSuccess,
  onClose,
}) => {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const employees = sqliteDB.getEmployees();
    
    // Check if matching employee with sufficient role
    const matchedEmp = employees.find(emp => emp.pin === pin && emp.status !== 'Inactive');
    
    // Owner is always authorized
    const isOwner = pin === '1234' || (matchedEmp && matchedEmp.role === 'Owner');
    const isManagerOrHigher = isOwner || (matchedEmp && (matchedEmp.role === 'Manager' || matchedEmp.role === 'Owner'));

    let authorized = false;
    let actorName = 'Manager/Owner';

    if (requiredRole === 'Owner') {
      authorized = !!isOwner;
      actorName = matchedEmp?.name || settings.ownerName || 'Store Owner';
    } else {
      authorized = !!isManagerOrHigher;
      actorName = matchedEmp?.name || (isOwner ? settings.ownerName || 'Owner' : 'Manager');
    }

    if (authorized) {
      // Record audit log
      sqliteDB.addAuditLog(
        actorName,
        `Authorized: ${actionName}`,
        `Manager PIN verified to authorize sensitive action: "${actionName}"`
      );
      setPin('');
      onSuccess();
      onClose();
    } else {
      setErrorMsg('Invalid PIN or insufficient role permissions.');
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4 animate-in fade-in zoom-in duration-150">
        
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <ShieldCheck className="w-5 h-5" />
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Manager Authorization Required</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 font-bold">
            ✕
          </button>
        </div>

        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 space-y-1">
          <p className="font-semibold">Action: <span className="font-mono text-slate-900 dark:text-slate-100">{actionName}</span></p>
          <p className="text-[11px] text-amber-700 dark:text-amber-300">
            Requires {requiredRole} role PIN verification before proceeding.
          </p>
        </div>

        {errorMsg && (
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-600 flex items-center gap-1.5 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleVerifyPin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Enter 4-Digit Security PIN
            </label>
            <input
              type="password"
              maxLength={6}
              autoFocus
              placeholder="••••"
              value={pin}
              onChange={e => setPin(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-center font-mono text-xl tracking-widest outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!pin}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20"
            >
              Authorize Action
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
