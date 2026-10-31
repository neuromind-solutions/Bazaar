import React, { useState } from 'react';
import { Customer, ShopSettings, Sale } from '../types';
import { sqliteDB } from '../db/sqliteStorage';
import { 
  Users, 
  UserPlus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  Award, 
  CreditCard, 
  DollarSign, 
  Clock, 
  Edit, 
  Trash2, 
  X, 
  Plus, 
  CheckCircle,
  FileText,
  AlertCircle
} from 'lucide-react';
import {
  validatePhone,
  validateEmail,
  validateGstin,
  sanitizeNumericInput,
  blockInvalidNumberKeys,
  blockNonDigitKeys
} from '@bazaar/shared-utils';

interface CustomerManagementViewProps {
  settings: ShopSettings;
  onSelectCustomerForPOS?: (customer: Customer) => void;
}

export const CustomerManagementView: React.FC<CustomerManagementViewProps> = ({
  settings,
  onSelectCustomerForPOS
}) => {
  const [customers, setCustomers] = useState<Customer[]>(() => sqliteDB.getCustomers());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('ALL');
  
  // Modals state
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Partial<Customer> | null>(null);
  const [showDuesModal, setShowDuesModal] = useState<Customer | null>(null);
  const [payDuesAmount, setPayDuesAmount] = useState<number>(0);
  const [showHistoryModal, setShowHistoryModal] = useState<Customer | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const refreshCustomers = () => {
    setCustomers(sqliteDB.getCustomers());
  };

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesTag = selectedTag === 'ALL' || c.tag === selectedTag;
    return matchesSearch && matchesTag;
  });

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!editingCustomer?.name?.trim()) {
      errors.name = 'Customer full name is required';
    }

    const phoneVal = validatePhone(editingCustomer?.phone || '', true);
    if (!phoneVal.isValid) {
      errors.phone = phoneVal.error || 'Invalid phone number';
    }

    if (editingCustomer?.email) {
      const emailVal = validateEmail(editingCustomer.email, false);
      if (!emailVal.isValid) {
        errors.email = emailVal.error || 'Invalid email format';
      }
    }

    if (editingCustomer?.gstNumber) {
      const gstinVal = validateGstin(editingCustomer.gstNumber, false);
      if (!gstinVal.isValid) {
        errors.gstNumber = gstinVal.error || 'Invalid GSTIN format';
      }
    }

    if (editingCustomer?.outstandingDues && editingCustomer.outstandingDues < 0) {
      errors.outstandingDues = 'Outstanding dues cannot be negative';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    sqliteDB.saveCustomer({
      ...editingCustomer,
      name: editingCustomer!.name.trim(),
      phone: editingCustomer!.phone.trim(),
      email: editingCustomer?.email?.trim(),
      gstNumber: editingCustomer?.gstNumber?.trim().toUpperCase(),
      outstandingDues: Math.max(0, editingCustomer?.outstandingDues || 0),
    });

    setShowAddEditModal(false);
    setEditingCustomer(null);
    refreshCustomers();
  };

  const handleDeleteCustomer = (id: string) => {
    sqliteDB.deleteCustomer(id);
    refreshCustomers();
  };

  const handlePayDues = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showDuesModal || payDuesAmount <= 0) return;

    sqliteDB.payCustomerDues(showDuesModal.id, payDuesAmount);
    setShowDuesModal(null);
    setPayDuesAmount(0);
    refreshCustomers();
  };

  const getCustomerSales = (phone: string): Sale[] => {
    return sqliteDB.getSales().filter(s => s.customerPhone === phone);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            Customer Management & Dues Ledger
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track customer purchase history, loyalty rewards, store credits, and outstanding dues.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingCustomer({ tag: 'Regular' });
            setShowAddEditModal(true);
          }}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition shadow-xs self-start md:self-auto cursor-pointer"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Add Customer</span>
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Total Customers</p>
            <p className="text-xl font-mono font-semibold text-slate-900 dark:text-zinc-100 mt-0.5">{customers.length}</p>
          </div>
          <div className="p-2.5 bg-slate-100 dark:bg-zinc-800 rounded-xl text-slate-700 dark:text-zinc-300">
            <Users className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Total Outstanding Dues</p>
            <p className="text-xl font-mono font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
              {settings.currencySymbol}{customers.reduce((acc, c) => acc + (c.outstandingDues || 0), 0).toLocaleString()}
            </p>
          </div>
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 rounded-xl text-rose-600 dark:text-rose-400">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">VIP Members</p>
            <p className="text-xl font-mono font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
              {customers.filter(c => c.tag === 'VIP').length}
            </p>
          </div>
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Award className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Loyalty Points Issued</p>
            <p className="text-xl font-mono font-semibold text-slate-900 dark:text-zinc-100 mt-0.5">
              {customers.reduce((acc, c) => acc + (c.loyaltyPoints || 0), 0)} pts
            </p>
          </div>
          <div className="p-2.5 bg-slate-100 dark:bg-zinc-800 rounded-xl text-slate-700 dark:text-zinc-300">
            <CreditCard className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-2.5 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or mobile number..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-700/80 bg-slate-50 dark:bg-zinc-800/60 text-slate-800 dark:text-zinc-200 focus:outline-none focus:bg-white dark:focus:bg-zinc-900 focus:border-slate-400 dark:focus:border-zinc-500 placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-xl w-full sm:w-auto">
          {['ALL', 'VIP', 'Regular', 'Wholesale'].map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                selectedTag === tag
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/60 dark:bg-zinc-950/40 text-slate-500 dark:text-zinc-400 border-b border-slate-200/70 dark:border-zinc-800 font-medium uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3.5">Customer Info</th>
                <th className="py-2.5 px-3.5">Contact</th>
                <th className="py-2.5 px-3.5">Tier</th>
                <th className="py-2.5 px-3.5 text-right">Total Spent</th>
                <th className="py-2.5 px-3.5 text-right">Loyalty</th>
                <th className="py-2.5 px-3.5 text-right">Outstanding Dues</th>
                <th className="py-2.5 px-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80 text-slate-700 dark:text-zinc-300">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 dark:text-zinc-500 text-xs">
                    No matching customer records found.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(customer => (
                  <tr key={customer.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition">
                    <td className="py-2.5 px-3.5 font-medium">
                      <div className="font-medium text-slate-900 dark:text-zinc-100 text-xs">{customer.name}</div>
                      <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">{customer.id}</div>
                    </td>
                    <td className="py-2.5 px-3.5">
                      <div className="flex items-center gap-1 text-slate-600 dark:text-zinc-300 font-mono text-xs">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{customer.phone}</span>
                      </div>
                      {customer.email && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
                          <Mail className="w-3 h-3" />
                          <span>{customer.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        customer.tag === 'VIP' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300' :
                        customer.tag === 'Wholesale' ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' :
                        'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}>
                        {customer.tag}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono font-medium text-slate-800 dark:text-zinc-200 text-xs">
                      {settings.currencySymbol}{customer.totalSpent.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono text-slate-500 dark:text-zinc-400 text-xs">
                      {customer.loyaltyPoints} pts
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono">
                      {customer.outstandingDues > 0 ? (
                        <span className="font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded text-xs">
                          {settings.currencySymbol}{customer.outstandingDues.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-zinc-500 text-xs">Cleared</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {onSelectCustomerForPOS && (
                          <button
                            onClick={() => onSelectCustomerForPOS(customer)}
                            className="p-1 bg-slate-100 dark:bg-zinc-800 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/50 text-slate-700 dark:text-zinc-300 rounded font-medium text-[11px] px-2 transition cursor-pointer"
                            title="Select for POS Billing"
                          >
                            Bill POS
                          </button>
                        )}

                        <button
                          onClick={() => setShowHistoryModal(customer)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition cursor-pointer"
                          title="View Purchase History"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>

                        {customer.outstandingDues > 0 && (
                          <button
                            onClick={() => {
                              setShowDuesModal(customer);
                              setPayDuesAmount(customer.outstandingDues);
                            }}
                            className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-medium transition cursor-pointer"
                            title="Clear Dues"
                          >
                            Pay Dues
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setEditingCustomer(customer);
                            setShowAddEditModal(true);
                          }}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition cursor-pointer"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteCustomer(customer.id)}
                          className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      {showAddEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                {editingCustomer?.id ? 'Edit Customer Profile' : 'Add New Customer'}
              </h3>
              <button onClick={() => setShowAddEditModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  value={editingCustomer?.name || ''}
                  onChange={e => {
                    setEditingCustomer(prev => ({ ...prev, name: e.target.value }));
                    if (formErrors.name) setFormErrors(prev => ({ ...prev, name: '' }));
                  }}
                  placeholder="e.g. Rahul Sharma"
                  className={`w-full px-3 py-2 rounded-xl border ${
                    formErrors.name ? 'border-rose-500 bg-rose-50/30' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                  } text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                />
                {formErrors.name && (
                  <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {formErrors.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Mobile Phone Number (10 Digits) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-mono font-medium">+91</span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={editingCustomer?.phone || ''}
                    onKeyDown={blockNonDigitKeys}
                    onChange={e => {
                      const sanitized = sanitizeNumericInput(e.target.value, 10);
                      setEditingCustomer(prev => ({ ...prev, phone: sanitized }));
                      if (formErrors.phone) setFormErrors(prev => ({ ...prev, phone: '' }));
                    }}
                    placeholder="9876543210"
                    className={`w-full pl-11 pr-3 py-2 rounded-xl border font-mono tracking-wider ${
                      formErrors.phone ? 'border-rose-500 bg-rose-50/30' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                    } text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                  />
                </div>
                {formErrors.phone ? (
                  <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {formErrors.phone}
                  </p>
                ) : (
                  <p className="mt-0.5 text-[10px] text-slate-400">Must be a valid 10-digit number starting with 6-9</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address (Optional)</label>
                  <input
                    type="email"
                    value={editingCustomer?.email || ''}
                    onChange={e => {
                      setEditingCustomer(prev => ({ ...prev, email: e.target.value }));
                      if (formErrors.email) setFormErrors(prev => ({ ...prev, email: '' }));
                    }}
                    placeholder="rahul@example.com"
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

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">GSTIN (Optional)</label>
                  <input
                    type="text"
                    maxLength={15}
                    value={editingCustomer?.gstNumber || ''}
                    onChange={e => {
                      const upper = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15);
                      setEditingCustomer(prev => ({ ...prev, gstNumber: upper }));
                      if (formErrors.gstNumber) setFormErrors(prev => ({ ...prev, gstin: '' }));
                    }}
                    placeholder="22AAAAA0000A1Z5"
                    className={`w-full px-3 py-2 rounded-xl border font-mono ${
                      formErrors.gstNumber ? 'border-rose-500 bg-rose-50/30' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                    } text-slate-800 dark:text-slate-100 focus:outline-none`}
                  />
                  {formErrors.gstNumber && (
                    <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {formErrors.gstNumber}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Tag / Tier</label>
                  <select
                    value={editingCustomer?.tag || 'Regular'}
                    onChange={e => setEditingCustomer(prev => ({ ...prev, tag: e.target.value as any }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="Regular">Regular</option>
                    <option value="VIP">VIP Customer</option>
                    <option value="Wholesale">Wholesale Buyer</option>
                    <option value="Distributor">Distributor</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Initial Credit Dues ({settings.currencySymbol})</label>
                  <input
                    type="number"
                    min={0}
                    onKeyDown={blockInvalidNumberKeys}
                    value={editingCustomer?.outstandingDues || 0}
                    onChange={e => {
                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                      setEditingCustomer(prev => ({ ...prev, outstandingDues: val }));
                      if (formErrors.outstandingDues) setFormErrors(prev => ({ ...prev, outstandingDues: '' }));
                    }}
                    className={`w-full px-3 py-2 rounded-xl border ${
                      formErrors.outstandingDues ? 'border-rose-500 bg-rose-50/30' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                    } text-slate-800 dark:text-slate-100 focus:outline-none`}
                  />
                  {formErrors.outstandingDues && (
                    <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {formErrors.outstandingDues}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Address</label>
                <input
                  type="text"
                  value={editingCustomer?.address || ''}
                  onChange={e => setEditingCustomer(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Street / Apartment address"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-semibold shadow-sm"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Outstanding Dues Modal */}
      {showDuesModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">Clear Outstanding Dues</h3>
              <button onClick={() => setShowDuesModal(null)} className="p-1 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Customer: <span className="font-bold">{showDuesModal.name}</span> ({showDuesModal.phone})<br />
              Current Dues: <span className="font-bold text-rose-600">{settings.currencySymbol}{showDuesModal.outstandingDues}</span>
            </p>

            <form onSubmit={handlePayDues} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Amount Paid ({settings.currencySymbol})</label>
                <input
                  type="number"
                  min={1}
                  max={showDuesModal.outstandingDues}
                  onKeyDown={blockInvalidNumberKeys}
                  value={payDuesAmount || ''}
                  onChange={e => {
                    const entered = parseFloat(e.target.value) || 0;
                    const clamped = Math.min(Math.max(0, entered), showDuesModal.outstandingDues);
                    setPayDuesAmount(clamped);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none font-bold text-sm"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDuesModal(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-semibold shadow-sm"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Khata Statement & Running Ledger Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3 shrink-0">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Khata Account Statement: {showHistoryModal.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Phone: {showHistoryModal.phone} {showHistoryModal.tag && `• Tag: ${showHistoryModal.tag}`}
                </p>
              </div>
              <button onClick={() => setShowHistoryModal(null)} className="p-1 text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            {/* Dues & Summary Banner */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/70 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
              <div>
                <span className="text-[11px] font-semibold text-slate-500">Current Outstanding Balance</span>
                <div className={`text-xl font-bold font-mono ${showHistoryModal.outstandingDues > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {settings.currencySymbol}{showHistoryModal.outstandingDues}
                </div>
              </div>

              {showHistoryModal.outstandingDues > 0 && (
                <button
                  onClick={() => {
                    const cust = showHistoryModal;
                    setShowHistoryModal(null);
                    setShowDuesModal(cust);
                    setPayDuesAmount(cust.outstandingDues);
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  Clear Dues / Record Payment
                </button>
              )}
            </div>

            {/* Ledger Transactions Table */}
            <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-500 sticky top-0">
                  <tr>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Type / Ref</th>
                    <th className="p-2.5 text-right">Debit (+)</th>
                    <th className="p-2.5 text-right">Credit (-)</th>
                    <th className="p-2.5 text-right">Balance</th>
                    <th className="p-2.5">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-750 font-mono">
                  {sqliteDB.getCustomerLedger(showHistoryModal.id).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400 font-sans">
                        No ledger transactions recorded yet. Dues and payments will automatically log here.
                      </td>
                    </tr>
                  ) : (
                    sqliteDB.getCustomerLedger(showHistoryModal.id).map(entry => (
                      <tr key={entry.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-750">
                        <td className="p-2.5 text-slate-600 dark:text-slate-400 text-[11px]">
                          {new Date(entry.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' })}
                        </td>
                        <td className="p-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-bold ${
                            entry.type === 'SaleCredit'
                              ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                              : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          }`}>
                            {entry.type === 'SaleCredit' ? 'Credit Bill' : 'Payment'}
                          </span>
                          <span className="ml-1 text-[10px] text-slate-500 font-mono">{entry.referenceNo}</span>
                        </td>
                        <td className="p-2.5 text-right text-rose-600 font-bold">
                          {entry.debit > 0 ? `${settings.currencySymbol}${entry.debit}` : '—'}
                        </td>
                        <td className="p-2.5 text-right text-emerald-600 font-bold">
                          {entry.credit > 0 ? `${settings.currencySymbol}${entry.credit}` : '—'}
                        </td>
                        <td className="p-2.5 text-right font-bold text-slate-800 dark:text-slate-100">
                          {settings.currencySymbol}{entry.balance}
                        </td>
                        <td className="p-2.5 text-[11px] text-slate-500 font-sans truncate max-w-[140px]">
                          {entry.notes || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-right shrink-0">
              <button
                onClick={() => setShowHistoryModal(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-200"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

