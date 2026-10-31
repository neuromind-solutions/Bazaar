import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ShopSettings, Employee } from '../types';
import { sqliteDB } from '../db/sqliteStorage';

interface BusinessModeContextType {
  isSoloMode: boolean;
  businessMode: 'solo' | 'multi';
  currentUser: Employee | null;
  setCurrentUser: (emp: Employee | null) => void;
  authorizeAction: (params: {
    actionName: string;
    requiredRole?: 'Owner' | 'Manager' | 'Cashier' | 'Inventory Staff';
    onSuccess: () => void;
    onCancel?: () => void;
  }) => void;
}

const BusinessModeContext = createContext<BusinessModeContextType | undefined>(undefined);

export const BusinessModeProvider: React.FC<{
  settings: ShopSettings;
  children: ReactNode;
  onRequestAuthModal?: (params: {
    actionName: string;
    requiredRole?: string;
    onSuccess: () => void;
    onCancel?: () => void;
  }) => void;
}> = ({ settings, children, onRequestAuthModal }) => {
  const isSoloMode = settings.businessMode !== 'multi';
  const businessMode = settings.businessMode === 'multi' ? 'multi' : 'solo';
  const [currentUser, setCurrentUser] = useState<Employee | null>(() => {
    const dbUser = (sqliteDB as unknown as { getCurrentUser?: () => Employee | null }).getCurrentUser?.();
    return dbUser || {
      id: 'EMP-01',
      name: settings.ownerName || 'Store Owner',
      role: 'Owner' as const,
      phone: settings.phone || '9999999999',
      pin: '1234',
      status: 'Active' as const,
      address: '',
      salary: 0,
      joiningDate: new Date().toISOString().split('T')[0],
    };
  });

  const authorizeAction = (params: {
    actionName: string;
    requiredRole?: 'Owner' | 'Manager' | 'Cashier' | 'Inventory Staff';
    onSuccess: () => void;
    onCancel?: () => void;
  }) => {
    // In Solo mode, all actions are authorized without PIN prompts
    if (isSoloMode) {
      params.onSuccess();
      return;
    }

    // In Multi-staff mode, if user is already Owner, permit immediately
    if (currentUser?.role === 'Owner') {
      params.onSuccess();
      return;
    }

    // Otherwise invoke the authorization modal
    if (onRequestAuthModal) {
      onRequestAuthModal(params);
    } else {
      params.onSuccess();
    }
  };

  return (
    <BusinessModeContext.Provider
      value={{
        isSoloMode,
        businessMode,
        currentUser,
        setCurrentUser,
        authorizeAction,
      }}
    >
      {children}
    </BusinessModeContext.Provider>
  );
};

export const useBusinessMode = (): BusinessModeContextType => {
  const context = useContext(BusinessModeContext);
  if (!context) {
    const settings = sqliteDB.getSettings();
    const isSoloMode = settings.businessMode !== 'multi';
    const businessMode = settings.businessMode === 'multi' ? 'multi' : 'solo';
    return {
      isSoloMode,
      businessMode,
      currentUser: (sqliteDB as unknown as { getCurrentUser?: () => Employee | null }).getCurrentUser?.() || null,
      setCurrentUser: () => {},
      authorizeAction: (params) => params.onSuccess(),
    };
  }
  return context;
};
