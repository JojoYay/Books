'use client';

import { useState, useEffect, useRef } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import {
  useAccountSwitcher,
  RememberedAccount,
} from '@/hooks/useAccountSwitcher';

interface AccountSwitcherProps {
  currentEmail: string;
  currentName: string;
  isLeader: boolean;
}

export default function AccountSwitcher({
  currentEmail,
  currentName,
  isLeader,
}: AccountSwitcherProps) {
  const { getAccounts, saveAccount, removeAccount } = useAccountSwitcher();
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<RememberedAccount[]>([]);
  const [mode, setMode] = useState<'list' | 'switch' | 'add'>('list');
  const [selectedAccount, setSelectedAccount] =
    useState<RememberedAccount | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // パネルを開くたびに最新のアカウント一覧を取得
  useEffect(() => {
    if (open) {
      setAccounts(getAccounts());
      setMode('list');
      setError('');
      setPassword('');
    }
  }, [open, getAccounts]);

  // パネル外クリックで閉じる
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // 他のアカウントに切り替え
  async function handleSwitch(account: RememberedAccount) {
    setSelectedAccount(account);
    setEmail(account.email);
    setPassword('');
    setError('');
    setMode('switch');
  }

  // 新規アカウント追加
  function handleAddNew() {
    setSelectedAccount(null);
    setEmail('');
    setPassword('');
    setError('');
    setMode('add');
  }

  // サインイン実行（切り替え or 追加）
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signOut(auth);
      const cred = await signInWithEmailAndPassword(auth, email, password);

      // Firestoreからプロフィールを取得して保存
      const snap = await getDoc(doc(db, 'users', cred.user.uid));
      if (snap.exists()) {
        const data = snap.data();
        saveAccount({
          email,
          name: data.name ?? email,
          role: data.role ?? 'member',
        });
      }

      setOpen(false);
      // ページをリロードして状態をリセット
      window.location.href = '/';
    } catch {
      setError('メールアドレスまたはパスワードが正しくありません。');
    } finally {
      setLoading(false);
    }
  }

  // アカウントをリストから削除
  function handleRemove(e: React.MouseEvent, acctEmail: string) {
    e.stopPropagation();
    removeAccount(acctEmail);
    setAccounts(getAccounts());
  }

  const otherAccounts = accounts.filter((a) => a.email !== currentEmail);

  return (
    <div className="relative" ref={panelRef}>
      {/* トリガーボタン */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
        aria-label="アカウント切り替え"
      >
        {/* アバター */}
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700 shrink-0">
          {currentName.charAt(0)}
        </span>
        <span className="max-w-[100px] truncate font-medium">{currentName}</span>
        {isLeader && (
          <span className="hidden sm:inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
            L
          </span>
        )}
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* ドロップダウンパネル */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-gray-100 bg-white shadow-xl z-50 overflow-hidden">
          {/* ヘッダー */}
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              アカウント
            </p>
          </div>

          {/* --- リスト表示 --- */}
          {mode === 'list' && (
            <>
              {/* 現在のアカウント */}
              <div className="flex items-center gap-3 bg-green-50 px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-200 text-sm font-bold text-green-800 shrink-0">
                  {currentName.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {currentName}
                  </p>
                  <p className="truncate text-xs text-gray-500">{currentEmail}</p>
                </div>
                <span className="text-xs text-green-600 font-medium shrink-0">
                  使用中
                </span>
              </div>

              {/* 他のアカウント */}
              {otherAccounts.length > 0 && (
                <div className="divide-y divide-gray-50">
                  {otherAccounts.map((acct) => (
                    <button
                      key={acct.email}
                      type="button"
                      onClick={() => handleSwitch(acct)}
                      className="group flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600 shrink-0">
                        {acct.name.charAt(0)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {acct.name}
                        </p>
                        <p className="truncate text-xs text-gray-400">
                          {acct.email}
                        </p>
                      </div>
                      {/* 削除ボタン */}
                      <button
                        type="button"
                        onClick={(e) => handleRemove(e, acct.email)}
                        className="hidden group-hover:flex h-6 w-6 items-center justify-center rounded-full text-gray-300 hover:bg-red-50 hover:text-red-400 transition-colors shrink-0"
                        aria-label="リストから削除"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </button>
                  ))}
                </div>
              )}

              {/* 新しいアカウントを追加 */}
              <div className="border-t border-gray-100 p-2">
                <button
                  type="button"
                  onClick={handleAddNew}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-dashed border-gray-300 text-gray-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </span>
                  別のアカウントでログイン
                </button>
              </div>
            </>
          )}

          {/* --- 切り替え / 新規追加フォーム --- */}
          {(mode === 'switch' || mode === 'add') && (
            <form onSubmit={handleSignIn} className="p-4 space-y-3">
              <button
                type="button"
                onClick={() => setMode('list')}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors mb-1"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                戻る
              </button>

              {mode === 'switch' && selectedAccount && (
                <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700 shrink-0">
                    {selectedAccount.name.charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {selectedAccount.name}
                    </p>
                    <p className="truncate text-xs text-gray-400">{selectedAccount.email}</p>
                  </div>
                </div>
              )}

              {mode === 'add' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  パスワード
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="パスワードを入力"
                  autoFocus
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>

              {error && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
              >
                {loading ? 'ログイン中...' : 'ログイン'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
