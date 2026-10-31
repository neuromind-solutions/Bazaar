import React, { useState } from 'react';
import { TabType } from '../types';
import { useBusinessMode } from '../context/BusinessModeContext';
import { 
  ShoppingCart, 
  Package, 
  Users, 
  BarChart3, 
  Settings,
  ChevronRight,
  ChevronLeft,
  DollarSign,
  Receipt,
  RotateCcw,
  Zap,
  Barcode,
  Truck,
  FileCheck,
  TrendingDown,
  UserCheck,
  Clock,
  ShieldCheck,
  Building2,
  Trash2,
  Activity,
  History,
  DatabaseBackup,
  LayoutDashboard,
  X,
  Layers
} from 'lucide-react';

interface SidebarProps {
  activeTab: TabType;
  onNavigate: (tab: TabType) => void;
  lowStockCount: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavHub {
  id: TabType;
  label: string;
  icon: React.FC<{ className?: string }>;
  badgeCount?: number;
  associatedTabs: TabType[];
  subItems: { id: TabType; label: string; icon: React.FC<{ className?: string }> }[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onNavigate,
  lowStockCount,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { isSoloMode } = useBusinessMode();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pos_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    try {
      localStorage.setItem('pos_sidebar_collapsed', String(next));
    } catch {}
  };

  // 5 Streamlined Core Navigation Hubs with contextual sub-modules
  const hubs: NavHub[] = [
    {
      id: 'pos',
      label: 'POS Terminal',
      icon: ShoppingCart,
      associatedTabs: ['pos', 'cash_register', 'sales_history', 'returns'],
      subItems: [
        { id: 'pos', label: 'Billing Terminal', icon: ShoppingCart },
        ...(!isSoloMode ? [{ id: 'cash_register' as TabType, label: 'Cash Shift Drawer', icon: DollarSign }] : []),
        { id: 'sales_history', label: 'Sales Invoices', icon: Receipt },
        { id: 'returns', label: 'Returns & Refunds', icon: RotateCcw },
      ]
    },
    {
      id: 'products',
      label: 'Inventory',
      icon: Package,
      badgeCount: lowStockCount,
      associatedTabs: ['products', 'smart_reorder', 'barcodes', 'suppliers', 'purchase_orders'],
      subItems: [
        { id: 'products', label: 'Products & Stock', icon: Package },
        { id: 'smart_reorder', label: 'Smart Reorders', icon: Zap },
        { id: 'barcodes', label: 'Barcode Studio', icon: Barcode },
        { id: 'suppliers', label: 'Suppliers Directory', icon: Truck },
        { id: 'purchase_orders', label: 'Purchase Orders', icon: FileCheck },
      ]
    },
    {
      id: 'customers',
      label: 'Khata CRM',
      icon: Users,
      associatedTabs: ['customers'],
      subItems: [
        { id: 'customers', label: 'Customer Ledgers & Dues', icon: Users },
      ]
    },
    {
      id: 'dashboard',
      label: 'Analytics',
      icon: BarChart3,
      associatedTabs: ['dashboard', 'reports', 'expenses', 'price_history'],
      subItems: [
        { id: 'dashboard', label: 'Overview Dashboard', icon: LayoutDashboard },
        { id: 'reports', label: 'Sales & GST Reports', icon: BarChart3 },
        { id: 'expenses', label: 'Store Expenses', icon: TrendingDown },
        { id: 'price_history', label: 'Price Audit Log', icon: History },
      ]
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      associatedTabs: ['settings', 'employees', 'attendance', 'branches', 'backup', 'health_monitor', 'audit_logs', 'recycle_bin'],
      subItems: [
        { id: 'settings', label: 'Shop Settings', icon: Settings },
        ...(!isSoloMode ? [
          { id: 'employees' as TabType, label: 'Staff Accounts', icon: UserCheck },
          { id: 'attendance' as TabType, label: 'Staff Attendance', icon: Clock },
        ] : []),
        { id: 'branches', label: 'Branch Outlets', icon: Building2 },
        { id: 'backup', label: 'Backup & Restore', icon: DatabaseBackup },
        { id: 'health_monitor', label: 'System Diagnostics', icon: Activity },
        { id: 'audit_logs', label: 'Security Audit Logs', icon: ShieldCheck },
        { id: 'recycle_bin', label: 'Recycle Bin', icon: Trash2 },
      ]
    }
  ];

  // Active hub detection
  const currentHub = hubs.find(h => h.associatedTabs.includes(activeTab)) || hubs[0];

  const handleNavigate = (tab: TabType) => {
    onNavigate(tab);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="md:hidden fixed inset-0 bg-zinc-950/40 backdrop-blur-xs z-40 animate-in fade-in duration-200"
        />
      )}

      {/* Modern Minimalist Sidebar */}
      <aside
        className={`no-print h-full bg-white dark:bg-zinc-900 border-r border-slate-200/80 dark:border-zinc-800/80 flex flex-col justify-between shrink-0 select-none z-40 transition-all duration-200 ${
          isCollapsed ? 'w-16' : 'w-60'
        } ${
          isMobileOpen
            ? 'fixed inset-y-0 left-0 shadow-2xl flex w-64'
            : 'hidden md:flex'
        }`}
      >
        {/* Top Header / App Branding */}
        <div>
          <div className="h-14 border-b border-slate-200/60 dark:border-zinc-800/60 px-3 flex items-center justify-between">
            <div className={`flex items-center gap-2.5 overflow-hidden ${isCollapsed ? 'justify-center w-full' : ''}`}>
              <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center shrink-0 text-white dark:text-zinc-900 font-bold text-sm tracking-tight shadow-2xs">
                B
              </div>
              {!isCollapsed && (
                <div className="truncate">
                  <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 tracking-tight block">
                    Bazaar POS
                  </span>
                  <span className="text-[10px] text-zinc-600 dark:text-zinc-400 font-mono block tracking-normal">
                    v2.0 • Offline
                  </span>
                </div>
              )}
            </div>

            {/* Mobile close */}
            {isMobileOpen && (
              <button
                onClick={onCloseMobile}
                className="md:hidden p-1.5 rounded-md text-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Core Hub Navigation */}
          <div className="p-2 space-y-1">
            {!isCollapsed && (
              <div className="px-2.5 py-1.5 text-[10px] font-semibold tracking-wider uppercase text-zinc-600 dark:text-zinc-400">
                Core Hubs
              </div>
            )}

            {hubs.map(hub => {
              const Icon = hub.icon;
              const isHubActive = hub.associatedTabs.includes(activeTab);

              return (
                <button
                  key={hub.id}
                  onClick={() => handleNavigate(hub.id)}
                  title={isCollapsed ? hub.label : undefined}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors relative group ${
                    isHubActive
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  {/* Subtle active accent bar on left */}
                  {isHubActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-emerald-600 dark:bg-emerald-500 rounded-r-full" />
                  )}

                  <Icon className={`w-4 h-4 shrink-0 ${
                    isHubActive 
                      ? 'text-emerald-600 dark:text-emerald-400' 
                      : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'
                  }`} />

                  {!isCollapsed && (
                    <span className="truncate flex-1 text-left">{hub.label}</span>
                  )}

                  {!isCollapsed && hub.badgeCount !== undefined && hub.badgeCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[10px] font-mono font-medium rounded-full">
                      {hub.badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Contextual Sub-Items for Current Hub (Expanded Mode Only) */}
          {!isCollapsed && currentHub.subItems.length > 1 && (
            <div className="mt-3 px-2 pt-3 border-t border-slate-200/60 dark:border-zinc-800/60">
              <div className="px-2.5 pb-1 text-[10px] font-semibold tracking-wider uppercase text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                <span>{currentHub.label} Modules</span>
                <Layers className="w-3 h-3 text-zinc-500" />
              </div>

              <div className="space-y-0.5">
                {currentHub.subItems.map(sub => {
                  const SubIcon = sub.icon;
                  const isCurrentSub = activeTab === sub.id;

                  return (
                    <button
                      key={sub.id}
                      onClick={() => handleNavigate(sub.id)}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] transition-colors ${
                        isCurrentSub
                          ? 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium'
                          : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                      }`}
                    >
                      <SubIcon className={`w-3.5 h-3.5 shrink-0 ${isCurrentSub ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'}`} />
                      <span className="truncate">{sub.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Section: Status & Collapse Toggle */}
        <div className="p-2 border-t border-slate-200/60 dark:border-zinc-800/60 space-y-2">
          {/* Subtle Online / Offline Status */}
          {!isCollapsed ? (
            <div className="px-2.5 py-1.5 flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                Offline Engine
              </span>
              <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 font-semibold">100% Local</span>
            </div>
          ) : (
            <div className="flex justify-center py-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="Offline Engine Active" />
            </div>
          )}

          {/* Desktop Collapse / Expand Toggle Button */}
          <button
            onClick={toggleCollapsed}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden md:flex w-full items-center justify-center p-1.5 rounded-md text-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-300">
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Collapse</span>
              </div>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};
