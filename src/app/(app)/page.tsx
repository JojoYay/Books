'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { getBooks } from '@/lib/firestore/books';
import { getAchievementRate, getSubmissionsByBook } from '@/lib/firestore/submissions';
import { getTasksByBook } from '@/lib/firestore/tasks';
import { Book } from '@/types';
import { LinkifiedText } from '@/components/LinkifiedText';

interface BookWithProgress extends Book {
  achievementRate: number | null;
}

function BookCardSkeleton() {
  return (
    <div className="rounded-2xl bg-white shadow-sm overflow-hidden animate-pulse">
      <div className="aspect-[3/4] bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-2/3" />
        <div className="flex items-center justify-between pt-1">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-6 bg-gray-200 rounded-full w-14" />
        </div>
      </div>
    </div>
  );
}

function AchievementBadge({ rate, isLeader }: { rate: number | null; isLeader?: boolean }) {
  if (rate === null) {
    if (isLeader) return null;
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
        集計中
      </span>
    );
  }

  const color =
    rate >= 80
      ? 'bg-green-100 text-green-700'
      : rate >= 50
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-gray-100 text-gray-600';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${color}`}
    >
      {rate}%
    </span>
  );
}

function BookCard({
  book,
  isLeader,
  userId,
  userName,
}: {
  book: BookWithProgress;
  isLeader?: boolean;
  userId?: string;
  userName?: string;
}) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownloadPdf(e: React.MouseEvent) {
    e.preventDefault();
    if (!userId || !userName) return;
    setDownloading(true);
    try {
      const [tasks, submissions] = await Promise.all([
        getTasksByBook(book.id),
        getSubmissionsByBook(book.id, userId),
      ]);
      const subMap = new Map(submissions.map((s) => [s.taskId, s]));
      const pdfTasks = tasks.map((task) => ({ task, submission: subMap.get(task.id) ?? null }));
      const { generateBookPdf } = await import('@/lib/utils/generate-book-pdf');
      await generateBookPdf(book, userName, pdfTasks);
    } catch (err) {
      console.error('PDF生成エラー:', err);
      alert('PDF生成に失敗しました。もう一度お試しください。');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="group flex flex-col rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden relative">
      <Link href={`/books/${book.id}`} className="flex flex-col flex-1">
        {/* Cover image */}
        <div className="relative aspect-[3/4] bg-gray-100 overflow-hidden">
          {book.coverImageUrl ? (
            <Image
              src={book.coverImageUrl}
              alt={book.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-green-50 to-green-100">
              <svg
                className="h-16 w-16 text-green-300"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="flex flex-1 flex-col gap-2 p-4">
          <h2 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-green-700 transition-colors">
            {book.title}
          </h2>
          {book.description && (
            <p className="text-sm text-gray-500 line-clamp-2 flex-1 break-words">
              <LinkifiedText text={book.description} />
            </p>
          )}
          <div className="mt-auto flex items-center justify-between pt-2">
            <span className="text-xs text-gray-400">{book.totalPages}ページ</span>
            <AchievementBadge rate={book.achievementRate} isLeader={isLeader} />
          </div>

          {/* Progress bar */}
          {book.achievementRate !== null && (
            <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  book.achievementRate >= 80
                    ? 'bg-green-500'
                    : book.achievementRate >= 50
                    ? 'bg-yellow-400'
                    : 'bg-gray-300'
                }`}
                style={{ width: `${book.achievementRate}%` }}
              />
            </div>
          )}
        </div>
      </Link>

      {/* PDF Download button — member only */}
      {!isLeader && userId && (
        <div className="border-t border-gray-100 px-4 py-2.5">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-green-700 disabled:opacity-50 transition-colors"
          >
            {downloading ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                PDF生成中...
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                課題記録をPDFで保存
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 text-6xl">📚</div>
      <h3 className="text-lg font-semibold text-gray-700">
        本がまだ割り当てられていません
      </h3>
      <p className="mt-2 text-sm text-gray-500">
        リーダーから本が割り当てられるとここに表示されます。
      </p>
    </div>
  );
}

export default function HomePage() {
  const { user, userProfile, isLeader, loading: authLoading } = useAuth();
  const [books, setBooks] = useState<BookWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user || !userProfile) return;

    async function fetchBooks() {
      if (!user || !userProfile) return;
      setLoading(true);
      setError(null);

      try {
        const rawBooks = await getBooks(user.uid, isLeader);

        // Fetch achievement rates in parallel (members only; leaders see all)
        const booksWithProgress: BookWithProgress[] = await Promise.all(
          rawBooks.map(async (book) => {
            if (isLeader) {
              return { ...book, achievementRate: null };
            }
            try {
              const rate = await getAchievementRate(book.id, user.uid);
              return { ...book, achievementRate: rate };
            } catch {
              return { ...book, achievementRate: null };
            }
          })
        );

        setBooks(booksWithProgress);
      } catch (err) {
        console.error('本の取得に失敗しました:', err);
        setError('本の一覧を取得できませんでした。');
      } finally {
        setLoading(false);
      }
    }

    fetchBooks();
  }, [authLoading, user, userProfile, isLeader]);

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">本一覧</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isLeader
              ? 'すべての本を管理できます'
              : '割り当てられた本を確認しましょう'}
          </p>
        </div>
        {isLeader && (
          <Link
            href="/admin/books"
            className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition-colors"
          >
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
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            本を追加
          </Link>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <BookCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Book grid */}
      {!loading && books.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              isLeader={isLeader}
              userId={user?.uid}
              userName={userProfile?.name}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && books.length === 0 && !error && <EmptyState />}
    </div>
  );
}
