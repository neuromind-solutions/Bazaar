import React, { useState } from 'react';
import { Supplier, ShopSettings } from '../types';
import { sqliteDB } from '../db/sqliteStorage';
import { 
  Truck, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  Building2, 
  Edit, 
  Trash2, 
  X,
  CreditCard,
  AlertCircle
} from 'lucide-react';
import {
  validatePhone,
  validateEmail,
  validateGstin,
  blockNonDigitKeys,
  sanitizeNumericInput
} from '@bazaar/shared-utils';

interface SupplierManagementViewProps {
  settings: ShopSettings;
}

export const SupplierManagementView: React.FC<SupplierManagementViewProps> = ({ settings }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => sqliteDB.getSuppliers());
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier> | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const refreshSuppliers = () => {
    setSuppliers(sqliteDB.getSuppliers());
  };

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.phone.includes(searchTerm)
  );

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!editingSupplier?.name?.trim()) {
      errors.name = 'Contact person name is required';
    }

    if (!editingSupplier?.companyName?.trim()) {
      errors.companyName = 'Company / Distributor name is required';
    }

    const phoneVal = validatePhone(editingSupplier?.phone || '', true);
    if (!phoneVal.isValid) {
      errors.phone = phoneVal.error || 'Invalid phone number';
    }

    if (editingSupplier?.email) {
      const emailVal = validateEmail(editingSupplier.email, false);
      if (!emailVal.isValid) {
        errors.email = emailVal.error || 'Invalid email address';
      }
    }

    if (editingSupplier?.gstin) {
      const gstinVal = validateGstin(editingSupplier.gstin, false);
      if (!gstinVal.isValid) {
        errors.gstin = gstinVal.error || 'Invalid GSTIN number';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    sqliteDB.saveSupplier({
      ...editingSupplier,
      name: editingSupplier!.name.trim(),
      companyName: editingSupplier!.companyName.trim(),
      phone: editingSupplier!.phone.trim(),
      email: editingSupplier?.email?.trim(),
      gstin: editingSupplier?.gstin?.trim().toUpperCase(),
    });

    setShowAddModal(false);
    setEditingSupplier(null);
    refreshSuppliers();
  };

  const handleDeleteSupplier = (id: string) => {
    sqliteDB.deleteSupplier(id);
    refreshSuppliers();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Truck className="w-6 h-6 text-emerald-600" />
            Supplier Directory & Vendor Accounts
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage wholesale distributors, payment terms, contact details, and outstanding balances.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingSupplier({ paymentTerms: '15 Days Credit' });
            setShowAddModal(true);
          }}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-sm self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Supplier</span>
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Active Suppliers</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{suppliers.length}</p>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-600 dark:text-emerald-400">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Vendor Payable Balance</p>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
              {settings.currencySymbol}{suppliers.reduce((acc, s) => acc + (s.outstandingBalance || 0), 0).toLocaleString()}
            </p>
          </div>
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 rounded-xl text-rose-600 dark:text-rose-400">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Suppliers with Pending Credit</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {suppliers.filter(s => s.outstandingBalance > 0).length}
            </p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/50 rounded-xl text-amber-600 dark:text-amber-400">
            <Building2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search supplier or company name..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSuppliers.map(sup => (
          <div key={sup.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-3 shadow-xs hover:shadow-md transition">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md text-slate-500 dark:text-slate-400">{sup.id}</span>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm mt-1">{sup.name}</h3>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" />
                  {sup.companyName}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setEditingSupplier(sup);
                    setShowAddModal(true);
                  }}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteSupplier(sup.id)}
                  className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{sup.phone}</span>
              </div>

              {sup.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{sup.email}</span>
                </div>
              )}

              {sup.gstin && (
                <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
                  <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>GSTIN: {sup.gstin}</span>
                </div>
              )}

              {sup.address && (
                <div className="flex items-center gap-2 text-[11px]">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{sup.address}</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs">
              <span className="text-[11px] font-medium text-slate-500">Credit Terms: {sup.paymentTerms}</span>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block uppercase">Outstanding</span>
                <span className={`font-bold ${sup.outstandingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {settings.currencySymbol}{sup.outstandingBalance.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                {editingSupplier?.id ? 'Edit Supplier Profile' : 'Add New Supplier'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Contact Person Name *</label>
                <input
                  type="text"
                  required
                  value={editingSupplier?.name || ''}
                  onChange={e => {
                    setEditingSupplier(prev => ({ ...prev, name: e.target.value }));
                    if (formErrors.name) setFormErrors(prev => ({ ...prev, name: '' }));
                  }}
                  placeholder="e.g. Ramesh Kumar"
                  className={`w-full px-3 py-2 rounded-xl border ${
                    formErrors.name ? 'border-rose-500 bg-rose-50/30' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                  } text-slate-800 dark:text-slate-100 focus:outline-none`}
                />
                {formErrors.name && (
                  <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {formErrors.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Company / Distributor Name *</label>
                <input
                  type="text"
                  required
                  value={editingSupplier?.companyName || ''}
                  onChange={e => {
                    setEditingSupplier(prev => ({ ...prev, companyName: e.target.value }));
                    if (formErrors.companyName) setFormErrors(prev => ({ ...prev, companyName: '' }));
                  }}
                  placeholder="e.g. ITC Wholesale Agro"
                  className={`w-full px-3 py-2 rounded-xl border ${
                    formErrors.companyName ? 'border-rose-500 bg-rose-50/30' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                  } text-slate-800 dark:text-slate-100 focus:outline-none`}
                />
                {formErrors.companyName && (
                  <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {formErrors.companyName}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Mobile / Phone (10 Digits) *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={editingSupplier?.phone || ''}
                    onKeyDown={blockNonDigitKeys}
                    onChange={e => {
                      const sanitized = sanitizeNumericInput(e.target.value, 10);
                      setEditingSupplier(prev => ({ ...prev, phone: sanitized }));
                      if (formErrors.phone) setFormErrors(prev => ({ ...prev, phone: '' }));
                    }}
                    placeholder="9876543210"
                    className={`w-full px-3 py-2 rounded-xl border font-mono tracking-wider ${
                      formErrors.phone ? 'border-rose-500 bg-rose-50/30' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                    } text-slate-800 dark:text-slate-100 focus:outline-none`}
                  />
                  {formErrors.phone && (
                    <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {formErrors.phone}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={editingSupplier?.email || ''}
                    onChange={e => {
                      setEditingSupplier(prev => ({ ...prev, email: e.target.value }));
                      if (formErrors.email) setFormErrors(prev => ({ ...prev, email: '' }));
                    }}
                    placeholder="orders@distributor.com"
                    className={`w-full px-3 py-2 rounded-xl border ${
                      formErrors.email ? 'border-rose-500 bg-rose-50/30' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                    } text-slate-800 dark:text-slate-100 focus:outline-none`}
                  />
                  {formErrors.email && (
                    <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {formErrors.email}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">GSTIN (Optional)</label>
                  <input
                    type="text"
                    maxLength={15}
                    value={editingSupplier?.gstin || ''}
                    onChange={e => {
                      const upper = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15);
                      setEditingSupplier(prev => ({ ...prev, gstin: upper }));
                      if (formErrors.gstin) setFormErrors(prev => ({ ...prev, gstin: '' }));
                    }}
                    placeholder="29AAAAA0000A1Z5"
                    className={`w-full px-3 py-2 rounded-xl border font-mono ${
                      formErrors.gstin ? 'border-rose-500 bg-rose-50/30' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                    } text-slate-800 dark:text-slate-100 focus:outline-none`}
                  />
                  {formErrors.gstin && (
                    <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {formErrors.gstin}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Payment Terms</label>
                  <input
                    type="text"
                    value={editingSupplier?.paymentTerms || '15 Days Credit'}
                    onChange={e => setEditingSupplier(prev => ({ ...prev, paymentTerms: e.target.value }))}
                    placeholder="e.g. Cash / 15 Days / 30 Days"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Warehouse Address</label>
                <input
                  type="text"
                  value={editingSupplier?.address || ''}
                  onChange={e => setEditingSupplier(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Godown / Address details"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 shadow-sm"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
