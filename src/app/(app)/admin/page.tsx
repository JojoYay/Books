'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

interface AdminCard {
  href: string;
  icon: string;
  title: string;
  description: string;
}

const adminCards: AdminCard[] = [
  {
    href: '/admin/members',
    icon: '👥',
    title: '隊員管理',
    description: '隊員の追加・編集・無効化を行います。',
  },
  {
    href: '/admin/books',
    icon: '📚',
    title: '本の管理',
    description: '本の追加・編集・課題管理・隊員割り当てを行います。',
  },
  {
    href: '/admin/settings',
    icon: '⚙️',
    title: '設定',
    description: '保護者確認PINなどのアプリ設定を変更します。',
  },
];

export default function AdminPage() {
  const { user, isLeader, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (!isLeader) {
        router.replace('/');
      }
    }
  }, [loading, user, isLeader, router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    );
  }

  if (!isLeader) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">管理</h1>
        <p className="mt-1 text-sm text-gray-500">
          リーダー専用の管理機能です。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {adminCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-green-300 hover:shadow-md"
          >
            <span className="text-3xl">{card.icon}</span>
            <div>
              <h2 className="font-semibold text-gray-900 group-hover:text-green-700 transition-colors">
                {card.title}
              </h2>
              <p className="mt-1 text-sm text-gray-500">{card.description}</p>
            </div>
            <svg
              className="ml-auto h-5 w-5 flex-shrink-0 text-gray-300 group-hover:text-green-500 transition-colors"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  );
}
