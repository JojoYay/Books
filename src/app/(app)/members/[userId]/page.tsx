'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { getUser } from '@/lib/firestore/users';
import { UserProfile } from '@/types';
import { calcSchoolGrade, gradeBadgeClass } from '@/lib/utils/school-grade';
import { useAuth } from '@/contexts/AuthContext';

const ROLE_LABEL: Record<string, string> = {
  leader: 'リーダー',
  member: '隊員',
};

const ROLE_BADGE: Record<string, string> = {
  leader: 'bg-green-100 text-green-700',
  member: 'bg-blue-100 text-blue-700',
};

export default function MemberProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    getUser(userId)
      .then((p) => {
        if (!p) router.replace('/members');
        else setProfile(p);
      })
      .finally(() => setLoading(false));
  }, [userId, router]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    );
  }

  if (!profile) return null;

  const grade = profile.birthday ? calcSchoolGrade(profile.birthday) : null;
  const isOwnProfile = user?.uid === userId;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        メンバー一覧に戻る
      </button>

      {/* Profile card */}
      <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
        {/* Hero / avatar area */}
        <div className="flex flex-col items-center gap-3 bg-gradient-to-br from-green-50 to-emerald-100 px-6 py-8">
          <div className="h-24 w-24 rounded-full overflow-hidden bg-green-100 ring-4 ring-white shadow-md">
            {profile.photoUrl ? (
              <Image
                src={profile.photoUrl}
                alt={profile.name}
                width={96}
                height={96}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-green-700 font-bold text-3xl">
                {profile.name.charAt(0)}
              </div>
            )}
          </div>

          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900">{profile.name}</h1>
            <div className="mt-1.5 flex items-center justify-center gap-1.5 flex-wrap">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_BADGE[profile.role]}`}>
                {ROLE_LABEL[profile.role]}
              </span>
              {grade && (
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${gradeBadgeClass(grade.level)}`}>
                  {grade.label}
                </span>
              )}
              {profile.group && (
                <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                  {profile.group}
                </span>
              )}
            </div>
            {profile.tagline && (
              <p className="mt-2 text-sm text-gray-600 italic">"{profile.tagline}"</p>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="divide-y divide-gray-100">
          {profile.bio && (
            <div className="px-6 py-4">
              <p className="mb-1 text-xs font-medium text-gray-400">自己紹介</p>
              <p className="whitespace-pre-wrap text-sm text-gray-700">{profile.bio}</p>
            </div>
          )}

          {profile.group && (
            <div className="flex items-center gap-3 px-6 py-3">
              <span className="text-xs font-medium text-gray-400 w-16 shrink-0">組</span>
              <span className="text-sm text-gray-900">{profile.group}</span>
            </div>
          )}

          <div className="flex items-center gap-3 px-6 py-3">
            <span className="text-xs font-medium text-gray-400 w-16 shrink-0">役割</span>
            <span className="text-sm text-gray-900">{ROLE_LABEL[profile.role]}</span>
          </div>
        </div>
      </div>

      {/* Own profile link */}
      {isOwnProfile && (
        <div className="text-center">
          <a
            href="/profile"
            className="text-sm text-green-600 hover:text-green-700 underline underline-offset-2 transition-colors"
          >
            プロフィールを編集する
          </a>
        </div>
      )}
    </div>
  );
}
