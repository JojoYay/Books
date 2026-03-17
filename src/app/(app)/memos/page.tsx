'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getMemos, deleteMemo } from '@/lib/firestore/memos';
import { getBook } from '@/lib/firestore/books';
import { Memo, Book } from '@/types';

interface MemoWithBook extends Memo {
  bookTitle: string;
}

type GroupedMemos = Record<string, MemoWithBook[]>;

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function MemosPage() {
  const { user } = useAuth();
  const [grouped, setGrouped] = useState<GroupedMemos>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadMemos = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const memos = await getMemos(user.uid);

      // Fetch book titles in parallel (cache by bookId)
      const bookCache = new Map<string, Book | null>();
      await Promise.all(
        memos.map(async (memo) => {
          if (!bookCache.has(memo.bookId)) {
            try {
              const book = await getBook(memo.bookId);
              bookCache.set(memo.bookId, book);
            } catch {
              bookCache.set(memo.bookId, null);
            }
          }
        })
      );

      const enriched: MemoWithBook[] = memos.map((memo) => ({
        ...memo,
        bookTitle: bookCache.get(memo.bookId)?.title ?? memo.bookId,
      }));

      // Group by bookId
      const groups: GroupedMemos = {};
      for (const memo of enriched) {
        if (!groups[memo.bookId]) groups[memo.bookId] = [];
        groups[memo.bookId].push(memo);
      }

      setGrouped(groups);
    } catch (err) {
      console.error('メモの取得に失敗:', err);
      setError('メモを取得できませんでした。');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadMemos();
  }, [loadMemos]);

  async function handleDelete(memoId: string) {
    if (!user || deletingId) return;
    setDeletingId(memoId);
    try {
      await deleteMemo(user.uid, memoId);
      await loadMemos();
    } catch (err) {
      console.error('削除エラー:', err);
    } finally {
      setDeletingId(null);
    }
  }

  const totalCount = Object.values(grouped).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">メモ</h1>
        <p className="mt-1 text-sm text-gray-500">
          各ページに書いたメモの一覧です
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl bg-white shadow-sm p-4 animate-pulse"
            >
              <div className="h-5 bg-gray-200 rounded w-1/3 mb-3" />
              <div className="space-y-3">
                <div className="h-20 bg-gray-100 rounded-xl" />
                <div className="h-20 bg-gray-100 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && totalCount === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <svg
              className="h-8 w-8 text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700">
            メモがありません
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            本を読みながらメモを書くとここに表示されます。
          </p>
          <Link
            href="/"
            className="mt-4 text-sm font-medium text-green-600 hover:underline"
          >
            本一覧へ
          </Link>
        </div>
      )}

      {/* Grouped list */}
      {!loading && totalCount > 0 && (
        <div className="space-y-6">
          {Object.entries(grouped).map(([bookId, memos]) => (
            <div
              key={bookId}
              className="rounded-2xl bg-white shadow-sm overflow-hidden"
            >
              {/* Group header */}
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 truncate">
                  {memos[0].bookTitle}
                </h2>
                <span className="flex-shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  {memos.length}件
                </span>
              </div>

              {/* Memos in this book */}
              <ul className="divide-y divide-gray-100">
                {memos.map((memo) => (
                  <li key={memo.id} className="flex items-start gap-3 px-4 py-4">
                    <Link
                      href={`/books/${memo.bookId}?page=${memo.pageNumber}`}
                      className="flex-1 min-w-0 group"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <svg
                          className="h-4 w-4 flex-shrink-0 text-blue-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                          />
                        </svg>
                        <span className="text-sm font-medium text-gray-700 group-hover:text-green-700 transition-colors">
                          {memo.pageNumber}ページ
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatDate(memo.updatedAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed">
                        {memo.text || (
                          <span className="text-gray-400 italic">
                            （空のメモ）
                          </span>
                        )}
                      </p>
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleDelete(memo.id)}
                      disabled={deletingId === memo.id}
                      className="flex-shrink-0 mt-0.5 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
                      aria-label="削除"
                    >
                      {deletingId === memo.id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-red-500" />
                      ) : (
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                          />
                        </svg>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
