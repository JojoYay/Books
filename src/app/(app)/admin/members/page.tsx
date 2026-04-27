'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { deleteField } from 'firebase/firestore';
import { getAllUsers, updateUser } from '@/lib/firestore/users';
import { UserProfile, UserRole, GroupRole } from '@/types';
import { calcSchoolGrade, gradeBadgeClass } from '@/lib/utils/school-grade';

interface CreateUserForm {
  name: string;
  nameKana: string;
  email: string;
  password: string;
  role: UserRole;
  birthday: string;
  group: string;
  groupRole: '' | GroupRole;
}

const roleLabel: Record<UserRole, string> = {
  leader: 'リーダー',
  member: '隊員',
};

const roleBadgeColor: Record<UserRole, string> = {
  leader: 'bg-green-100 text-green-700',
  member: 'bg-blue-100 text-blue-700',
};

const groupRoleLabel: Record<GroupRole, string> = {
  kumicho: '組長',
  jicho: '次長',
};

const groupRoleBadgeColor: Record<GroupRole, string> = {
  kumicho: 'bg-amber-100 text-amber-700',
  jicho: 'bg-orange-100 text-orange-700',
};

function groupRoleRank(role?: GroupRole): number {
  if (role === 'kumicho') return 0;
  if (role === 'jicho') return 1;
  return 2;
}

const UNGROUPED_KEY = '__ungrouped__';

export default function AdminMembersPage() {
  const { user, isLeader, loading } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateUserForm>({
    name: '',
    nameKana: '',
    email: '',
    password: '',
    role: 'member',
    birthday: '',
    group: '',
    groupRole: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [disablingId, setDisablingId] = useState<string | null>(null);

  // インライン「ふりがな」編集
  const [editingKanaId, setEditingKanaId] = useState<string | null>(null);
  const [editingKanaValue, setEditingKanaValue] = useState('');
  const [savingKanaId, setSavingKanaId] = useState<string | null>(null);

  // インライン「組」編集
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupValue, setEditingGroupValue] = useState('');
  const [savingGroupId, setSavingGroupId] = useState<string | null>(null);

  // インライン「誕生日」編集
  const [editingBirthdayId, setEditingBirthdayId] = useState<string | null>(null);
  const [editingBirthdayValue, setEditingBirthdayValue] = useState('');
  const [savingBirthdayId, setSavingBirthdayId] = useState<string | null>(null);

  // 組内役職の保存処理中ID
  const [savingGroupRoleId, setSavingGroupRoleId] = useState<string | null>(null);

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
      all.sort((a, b) => {
        // 組ごとに並べ、組内では 組長 → 次長 → その他、最後に未設定
        const ag = a.group ?? '';
        const bg = b.group ?? '';
        if (ag !== bg) {
          if (!ag) return 1;
          if (!bg) return -1;
          return ag.localeCompare(bg, 'ja');
        }
        const rankDiff = groupRoleRank(a.groupRole) - groupRoleRank(b.groupRole);
        if (rankDiff !== 0) return rankDiff;
        if (a.role !== b.role) return a.role === 'leader' ? -1 : 1;
        return a.name.localeCompare(b.name, 'ja');
      });
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
      setFormError('必須項目を入力してください。');
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
      setForm({
        name: '',
        nameKana: '',
        email: '',
        password: '',
        role: 'member',
        birthday: '',
        group: '',
        groupRole: '',
      });
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
      await fetch(`/api/admin/disable-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      }).catch(() => {});
      await fetchUsers();
    } catch (err) {
      console.error(err);
      alert('無効化に失敗しました。');
    } finally {
      setDisablingId(null);
    }
  };

  async function handleSaveKana(userId: string) {
    setSavingKanaId(userId);
    try {
      await updateUser(userId, { nameKana: editingKanaValue.trim() || undefined });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, nameKana: editingKanaValue.trim() || undefined } : u
        )
      );
      setEditingKanaId(null);
    } catch (err) {
      console.error(err);
      alert('保存に失敗しました。');
    } finally {
      setSavingKanaId(null);
    }
  }

  async function handleSaveGroup(userId: string) {
    setSavingGroupId(userId);
    try {
      await updateUser(userId, { group: editingGroupValue.trim() || undefined });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, group: editingGroupValue.trim() || undefined } : u
        )
      );
      setEditingGroupId(null);
    } catch (err) {
      console.error(err);
      alert('保存に失敗しました。');
    } finally {
      setSavingGroupId(null);
    }
  }

  async function handleSaveGroupRole(
    userId: string,
    next: GroupRole | null
  ) {
    setSavingGroupRoleId(userId);
    try {
      if (next === null) {
        // フィールド削除
        await updateUser(userId, {
          groupRole: deleteField() as unknown as undefined,
        });
      } else {
        await updateUser(userId, { groupRole: next });
      }
      setUsers((prev) =>
        prev
          .map((u) =>
            u.id === userId ? { ...u, groupRole: next ?? undefined } : u
          )
          .sort((a, b) => {
            const ag = a.group ?? '';
            const bg = b.group ?? '';
            if (ag !== bg) {
              if (!ag) return 1;
              if (!bg) return -1;
              return ag.localeCompare(bg, 'ja');
            }
            const rankDiff =
              groupRoleRank(a.groupRole) - groupRoleRank(b.groupRole);
            if (rankDiff !== 0) return rankDiff;
            if (a.role !== b.role) return a.role === 'leader' ? -1 : 1;
            return a.name.localeCompare(b.name, 'ja');
          })
      );
    } catch (err) {
      console.error(err);
      alert('保存に失敗しました。');
    } finally {
      setSavingGroupRoleId(null);
    }
  }

  async function handleSaveBirthday(userId: string) {
    setSavingBirthdayId(userId);
    try {
      await updateUser(userId, { birthday: editingBirthdayValue || undefined });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, birthday: editingBirthdayValue || undefined } : u
        )
      );
      setEditingBirthdayId(null);
    } catch (err) {
      console.error(err);
      alert('保存に失敗しました。');
    } finally {
      setSavingBirthdayId(null);
    }
  }

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
            隊員・リーダーの一覧、組の設定を行います。
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
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          新規隊員作成
        </button>
      </div>

      {/* User list — 組ごとにグループ表示 */}
      {users.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-gray-500">ユーザーがいません。</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(() => {
            const grouped = new Map<string, UserProfile[]>();
            for (const u of users) {
              const key = u.group && u.group.trim() ? u.group : UNGROUPED_KEY;
              const arr = grouped.get(key) ?? [];
              arr.push(u);
              grouped.set(key, arr);
            }
            const entries = Array.from(grouped.entries()).sort((a, b) => {
              if (a[0] === UNGROUPED_KEY) return 1;
              if (b[0] === UNGROUPED_KEY) return -1;
              return a[0].localeCompare(b[0], 'ja');
            });
            return entries.map(([groupKey, groupUsers]) => (
              <div
                key={groupKey}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                <div className="flex items-baseline justify-between gap-2 border-b border-gray-100 bg-gray-50 px-5 py-2.5">
                  <h2 className="text-sm font-semibold text-gray-800">
                    {groupKey === UNGROUPED_KEY ? '組未設定' : groupKey}
                  </h2>
                  <span className="text-xs text-gray-500">{groupUsers.length}人</span>
                </div>
                <ul className="divide-y divide-gray-100">
                  {groupUsers.map((u) => {
              const grade = u.birthday ? calcSchoolGrade(u.birthday) : null;
              const isEditingKana = editingKanaId === u.id;
              const isEditingGroup = editingGroupId === u.id;
              const isEditingBirthday = editingBirthdayId === u.id;

              return (
                <li key={u.id} className="px-5 py-4">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="h-10 w-10 shrink-0 rounded-full overflow-hidden bg-green-100">
                      {u.photoUrl ? (
                        <Image
                          src={u.photoUrl}
                          alt={u.name}
                          width={40}
                          height={40}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-green-700 font-semibold text-sm">
                          {u.name ? u.name[0] : '?'}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Name + badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{u.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeColor[u.role]}`}>
                          {roleLabel[u.role]}
                        </span>
                        {u.groupRole && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${groupRoleBadgeColor[u.groupRole]}`}
                          >
                            {groupRoleLabel[u.groupRole]}
                          </span>
                        )}
                        {grade && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${gradeBadgeClass(grade.level)}`}>
                            {grade.label}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-gray-500 truncate">{u.email}</p>

                      {/* ふりがな — inline edit */}
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-gray-400 shrink-0">ふりがな:</span>
                        {isEditingKana ? (
                          <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                            <input
                              type="text"
                              value={editingKanaValue}
                              onChange={(e) => setEditingKanaValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveKana(u.id);
                                if (e.key === 'Escape') setEditingKanaId(null);
                              }}
                              autoFocus
                              placeholder="やまだ たろう"
                              className="w-36 rounded-lg border border-green-400 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveKana(u.id)}
                              disabled={savingKanaId === u.id}
                              className="rounded-lg bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
                            >
                              {savingKanaId === u.id ? '保存中' : '保存'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingKanaId(null)}
                              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              キャンセル
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingKanaId(u.id);
                              setEditingKanaValue(u.nameKana ?? '');
                            }}
                            className="flex items-center gap-1 text-xs text-gray-600 hover:text-green-700 transition-colors group"
                          >
                            <span className={u.nameKana ? 'font-medium' : 'text-gray-400'}>
                              {u.nameKana ?? '未設定'}
                            </span>
                            <svg
                              className="h-3 w-3 text-gray-300 group-hover:text-green-600 transition-colors"
                              fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* 組 — inline edit */}
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-gray-400 shrink-0">組:</span>
                        {isEditingGroup ? (
                          <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                            <input
                              type="text"
                              value={editingGroupValue}
                              onChange={(e) => setEditingGroupValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveGroup(u.id);
                                if (e.key === 'Escape') setEditingGroupId(null);
                              }}
                              autoFocus
                              placeholder="例: ビーバー組"
                              className="w-36 rounded-lg border border-green-400 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveGroup(u.id)}
                              disabled={savingGroupId === u.id}
                              className="rounded-lg bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
                            >
                              {savingGroupId === u.id ? '保存中' : '保存'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingGroupId(null)}
                              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              キャンセル
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingGroupId(u.id);
                              setEditingGroupValue(u.group ?? '');
                            }}
                            className="flex items-center gap-1 text-xs text-gray-600 hover:text-green-700 transition-colors group"
                          >
                            <span className={u.group ? 'font-medium' : 'text-gray-400'}>
                              {u.group ?? '未設定'}
                            </span>
                            <svg
                              className="h-3 w-3 text-gray-300 group-hover:text-green-600 transition-colors"
                              fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* 組内役職 — select */}
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-gray-400 shrink-0">役職:</span>
                        <select
                          value={u.groupRole ?? ''}
                          disabled={savingGroupRoleId === u.id}
                          onChange={(e) => {
                            const v = e.target.value;
                            handleSaveGroupRole(
                              u.id,
                              v === 'kumicho' || v === 'jicho' ? (v as GroupRole) : null
                            );
                          }}
                          className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-60"
                        >
                          <option value="">通常</option>
                          <option value="kumicho">組長</option>
                          <option value="jicho">次長</option>
                        </select>
                        {savingGroupRoleId === u.id && (
                          <span className="text-xs text-gray-400">保存中...</span>
                        )}
                      </div>

                      {/* 誕生日 — inline edit */}
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-gray-400 shrink-0">誕生日:</span>
                        {isEditingBirthday ? (
                          <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                            <input
                              type="date"
                              value={editingBirthdayValue}
                              onChange={(e) => setEditingBirthdayValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveBirthday(u.id);
                                if (e.key === 'Escape') setEditingBirthdayId(null);
                              }}
                              autoFocus
                              className="w-40 rounded-lg border border-green-400 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveBirthday(u.id)}
                              disabled={savingBirthdayId === u.id}
                              className="rounded-lg bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
                            >
                              {savingBirthdayId === u.id ? '保存中' : '保存'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingBirthdayId(null)}
                              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              キャンセル
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBirthdayId(u.id);
                              setEditingBirthdayValue(u.birthday ?? '');
                            }}
                            className="flex items-center gap-1 text-xs text-gray-600 hover:text-green-700 transition-colors group"
                          >
                            <span className={u.birthday ? 'font-medium' : 'text-gray-400'}>
                              {u.birthday ?? '未設定'}
                            </span>
                            <svg
                              className="h-3 w-3 text-gray-300 group-hover:text-green-600 transition-colors"
                              fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDisable(u.id)}
                      disabled={disablingId === u.id}
                      className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 hover:text-red-600 transition-colors disabled:opacity-50"
                    >
                      {disablingId === u.id ? '処理中...' : '無効化'}
                    </button>
                  </div>
                </li>
              );
            })}
                </ul>
              </div>
            ));
          })()}
        </div>
      )}

      {/* Create user modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">ふりがな</label>
                <input
                  type="text"
                  value={form.nameKana}
                  onChange={(e) => setForm({ ...form, nameKana: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="やまだ たろう"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">誕生日</label>
                <input
                  type="date"
                  value={form.birthday}
                  onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">組</label>
                <input
                  type="text"
                  value={form.group}
                  onChange={(e) => setForm({ ...form, group: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="例: ビーバー組"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">組内役職</label>
                <select
                  value={form.groupRole}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      groupRole: (e.target.value as '' | GroupRole) ?? '',
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                >
                  <option value="">通常</option>
                  <option value="kumicho">組長</option>
                  <option value="jicho">次長</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">役割</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                >
                  <option value="member">隊員</option>
                  <option value="leader">リーダー</option>
                </select>
              </div>

              {formError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</p>
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
