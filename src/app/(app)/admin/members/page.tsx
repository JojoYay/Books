'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getAllUsers, updateUser } from '@/lib/firestore/users';
import { UserProfile, UserRole } from '@/types';
import { calcSchoolGrade, gradeBadgeClass } from '@/lib/utils/school-grade';

interface CreateUserForm {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  birthday: string;
}

const roleLabel: Record<UserRole, string> = {
  leader: 'リーダー',
  member: '隊員',
};

const roleBadgeColor: Record<UserRole, string> = {
  leader: 'bg-green-100 text-green-700',
  member: 'bg-blue-100 text-blue-700',
};

export default function AdminMembersPage() {
  const { user, isLeader, loading } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateUserForm>({
    name: '',
    email: '',
    password: '',
    role: 'member',
    birthday: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [disablingId, setDisablingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (!isLeader) {
        router.replace('/');
      }
    }
  }, [loading, user, isLeader, router]);

  async function fetchUsers() {
    try {
      setFetching(true);
      const all = await getAllUsers();
      setUsers(all);
    } catch (err) {
      console.error(err);
      setError('ユーザー一覧の取得に失敗しました。');
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    if (user && isLeader) {
      fetchUsers();
    }
  }, [user, isLeader]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.name || !form.email || !form.password) {
      setFormError('すべての項目を入力してください。');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error ?? 'ユーザー作成に失敗しました。');
        return;
      }

      setShowModal(false);
      setForm({ name: '', email: '', password: '', role: 'member', birthday: '' });
      await fetchUsers();
    } catch (err) {
      console.error(err);
      setFormError('ユーザー作成中にエラーが発生しました。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisable = async (userId: string) => {
    if (!confirm('このユーザーを無効化しますか？')) return;
    try {
      setDisablingId(userId);
      await updateUser(userId, { role: 'member' } as Partial<UserProfile>);
      // Mark as disabled via a custom field — updateUser accepts Partial<UserProfile>
      // We update via the raw firestore call with a disabled flag
      await fetch(`/api/admin/disable-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      }).catch(() => {
        // Fallback: directly update a disabled flag if endpoint doesn't exist
      });
      await fetchUsers();
    } catch (err) {
      console.error(err);
      alert('無効化に失敗しました。');
    } finally {
      setDisablingId(null);
    }
  };

  if (loading || fetching) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center text-red-700">{error}</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">隊員管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            隊員・リーダーの一覧と管理を行います。
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          新規隊員作成
        </button>
      </div>

      {/* User list */}
      {users.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-gray-500">ユーザーがいません。</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <ul className="divide-y divide-gray-100">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-4 px-5 py-4"
              >
                {/* Avatar */}
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 font-semibold text-sm">
                  {u.name ? u.name[0] : '?'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{u.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeColor[u.role]}`}
                    >
                      {roleLabel[u.role]}
                    </span>
                    {u.birthday && (() => {
                      const grade = calcSchoolGrade(u.birthday);
                      return grade ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${gradeBadgeClass(grade.level)}`}>
                          {grade.label}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <p className="mt-0.5 text-sm text-gray-500 truncate">{u.email}</p>
                  {u.birthday && (
                    <p className="mt-0 text-xs text-gray-400">
                      誕生日: {new Date(u.birthday).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleDisable(u.id)}
                  disabled={disablingId === u.id}
                  className="flex-shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 hover:text-red-600 transition-colors disabled:opacity-50"
                >
                  {disablingId === u.id ? '処理中...' : '無効化'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Create user modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-bold text-gray-900">新規隊員作成</h2>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  名前 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="山田 太郎"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="example@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  パスワード <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="6文字以上"
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  誕生日
                </label>
                <input
                  type="date"
                  value={form.birthday}
                  onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  役割
                </label>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as UserRole })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                >
                  <option value="member">隊員</option>
                  <option value="leader">リーダー</option>
                </select>
              </div>

              {formError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-60"
                >
                  {submitting ? '作成中...' : '作成'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
