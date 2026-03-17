'use client';

import { useCallback } from 'react';

const STORAGE_KEY = 'scoutbooks_accounts';

export interface RememberedAccount {
  email: string;
  name: string;
  role: 'leader' | 'member';
}

function load(): RememberedAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function save(accounts: RememberedAccount[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

export function useAccountSwitcher() {
  const getAccounts = useCallback((): RememberedAccount[] => load(), []);

  const saveAccount = useCallback((account: RememberedAccount) => {
    const accounts = load();
    const idx = accounts.findIndex((a) => a.email === account.email);
    if (idx >= 0) {
      accounts[idx] = account; // 名前・ロールを最新に更新
    } else {
      accounts.push(account);
    }
    save(accounts);
  }, []);

  const removeAccount = useCallback((email: string) => {
    save(load().filter((a) => a.email !== email));
  }, []);

  return { getAccounts, saveAccount, removeAccount };
}
