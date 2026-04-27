'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { getAllUsers } from '@/lib/firestore/users';
import { UserProfile, GroupRole } from '@/types';
import { calcSchoolGrade, gradeBadgeClass } from '@/lib/utils/school-grade';

const ROLE_LABEL: Record<string, string> = {
  leader: 'リーダー',
  member: '隊員',
};

const ROLE_BADGE: Record<string, string> = {
  leader: 'bg-green-100 text-green-700',
  member: 'bg-blue-100 text-blue-700',
};

const GROUP_ROLE_LABEL: Record<GroupRole, string> = {
  kumicho: '組長',
  jicho: '次長',
};

const GROUP_ROLE_BADGE: Record<GroupRole, string> = {
  kumicho: 'bg-amber-100 text-amber-700',
  jicho: 'bg-orange-100 text-orange-700',
};

function groupRoleRank(role?: GroupRole): number {
  if (role === 'kumicho') return 0;
  if (role === 'jicho') return 1;
  return 2;
}

const UNGROUPED_KEY = '__ungrouped__';

export default function MembersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;
    getAllUsers()
      .then((all) => setUsers(all))
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = users.filter(
    (u) =>
      u.name.includes(search) ||
      (u.nameKana ?? '').includes(search) ||
      (u.group ?? '').includes(search) ||
      (u.tagline ?? '').includes(search)
  );

  // 組ごとにグループ化（組長/次長 → 通常 → 名前順）
  const groupEntries = (() => {
    const map = new Map<string, UserProfile[]>();
    for (const u of filtered) {
      const key = u.group && u.group.trim() ? u.group : UNGROUPED_KEY;
      const arr = map.get(key) ?? [];
      arr.push(u);
      map.set(key, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const rankDiff = groupRoleRank(a.groupRole) - groupRoleRank(b.groupRole);
        if (rankDiff !== 0) return rankDiff;
        if (a.role !== b.role) return a.role === 'leader' ? -1 : 1;
        return a.name.localeCompare(b.name, 'ja');
      });
    }
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === UNGROUPED_KEY) return 1;
      if (b[0] === UNGROUPED_KEY) return -1;
      return a[0].localeCompare(b[0], 'ja');
    });
  })();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">メンバー</h1>
        <p className="mt-1 text-sm text-gray-500">隊員・リーダーのプロフィール一覧</p>
      </div>

      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="名前・組・ひとことで検索"
          className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </div>

      {/* 組ごと */}
      {groupEntries.map(([groupKey, groupUsers]) => (
        <section key={groupKey}>
          <h2 className="mb-3 flex items-baseline gap-2 text-sm font-semibold tracking-wide text-gray-700">
            <span>{groupKey === UNGROUPED_KEY ? '組未設定' : groupKey}</span>
            <span className="text-xs font-normal text-gray-400">
              {groupUsers.length}人
            </span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groupUsers.map((u) => (
              <MemberCard key={u.id} user={u} />
            ))}
          </div>
        </section>
      ))}

      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center text-gray-400">
          {search ? '該当するメンバーが見つかりません' : 'メンバーがいません'}
        </div>
      )}
    </div>
  );

  function MemberCard({ user: u }: { user: UserProfile }) {
    const grade = u.birthday ? calcSchoolGrade(u.birthday) : null;
    return (
      <Link
        href={`/members/${u.id}`}
        className="group flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
      >
        {/* Avatar */}
        <div className="h-14 w-14 shrink-0 rounded-full overflow-hidden bg-green-100 ring-2 ring-white shadow">
          {u.photoUrl ? (
            <Image
              src={u.photoUrl}
              alt={u.name}
              width={56}
              height={56}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-green-700 font-bold text-xl">
              {u.name.charAt(0)}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          {u.nameKana && (
            <p className="text-[10px] text-gray-400 leading-none mb-0.5">{u.nameKana}</p>
          )}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-gray-900 truncate">{u.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${ROLE_BADGE[u.role]}`}>
              {ROLE_LABEL[u.role]}
            </span>
            {u.groupRole && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${GROUP_ROLE_BADGE[u.groupRole]}`}
              >
                {GROUP_ROLE_LABEL[u.groupRole]}
              </span>
            )}
            {grade && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${gradeBadgeClass(grade.level)}`}>
                {grade.label}
              </span>
            )}
          </div>
          {u.tagline && (
            <p className="mt-0.5 text-xs text-gray-400 truncate">&ldquo;{u.tagline}&rdquo;</p>
          )}
        </div>

        <svg
          className="h-4 w-4 text-gray-300 group-hover:text-gray-400 transition-colors shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </Link>
    );
  }
}
