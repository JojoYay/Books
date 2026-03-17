'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

export default function AdminSettingsPage() {
  const { user, isLeader, loading } = useAuth();
  const router = useRouter();

  const [currentPin, setCurrentPin] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [showPin, setShowPin] = useState(false);

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (!isLeader) {
        router.replace('/');
      }
    }
  }, [loading, user, isLeader, router]);

  useEffect(() => {
    if (!user || !isLeader) return;

    async function fetchPin() {
      try {
        setFetching(true);
        const docRef = doc(db, 'settings', 'parentPin');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setCurrentPin((snap.data().pin as string) ?? null);
        } else {
          setCurrentPin(null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setFetching(false);
      }
    }

    fetchPin();
  }, [user, isLeader]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!pin) {
      setFormError('PINを入力してください。');
      return;
    }

    if (pin.length < 4) {
      setFormError('PINは4桁以上で設定してください。');
      return;
    }

    if (pin !== confirmPin) {
      setFormError('PINが一致しません。');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/admin/update-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error ?? 'PINの更新に失敗しました。');
        return;
      }

      setCurrentPin(pin);
      setPin('');
      setConfirmPin('');
      setSuccessMessage('PINを更新しました。');
    } catch (err) {
      console.error(err);
      setFormError('PINの更新中にエラーが発生しました。');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || fetching) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">設定</h1>
        <p className="mt-1 text-sm text-gray-500">アプリの設定を管理します。</p>
      </div>

      {/* Parent PIN section */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-gray-900">
          保護者確認PIN
        </h2>
        <p className="mb-4 text-sm text-gray-500">
          保護者が課題を承認する際に使用するPINコードです。
        </p>

        {/* Current PIN display */}
        <div className="mb-6 flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3">
          <span className="text-sm text-gray-600">現在のPIN:</span>
          <span className="font-mono text-lg tracking-widest text-gray-800">
            {currentPin === null
              ? '未設定'
              : showPin
              ? currentPin
              : '●'.repeat(currentPin.length)}
          </span>
          {currentPin !== null && (
            <button
              type="button"
              onClick={() => setShowPin((prev) => !prev)}
              className="ml-auto text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showPin ? '非表示' : '表示'}
            </button>
          )}
        </div>

        {/* Update PIN form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              新しいPIN <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono tracking-widest focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder="4桁以上の数字"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              新しいPIN（確認） <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono tracking-widest focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder="もう一度入力"
            />
          </div>

          {formError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {formError}
            </p>
          )}

          {successMessage && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              {successMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-60"
          >
            {submitting ? '更新中...' : 'PINを更新'}
          </button>
        </form>
      </div>
    </div>
  );
}
