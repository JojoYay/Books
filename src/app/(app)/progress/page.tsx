'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getBooks } from '@/lib/firestore/books';
import { getTasksByBook } from '@/lib/firestore/tasks';
import { getSubmissionsByBook } from '@/lib/firestore/submissions';
import { Book, Task, TaskSubmission, TaskStatus } from '@/types';

interface BookProgress {
  book: Book;
  tasks: Task[];
  submissions: TaskSubmission[];
  completedCount: number;
  achievementRate: number;
}

const statusLabel: Record<TaskStatus, string> = {
  not_started: '未着手',
  submitted: '提出済み',
  completed: '完了',
};

const statusColor: Record<TaskStatus, string> = {
  not_started: 'bg-gray-100 text-gray-600',
  submitted: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
};

export default function ProgressPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [bookProgressList, setBookProgressList] = useState<BookProgress[]>([]);
  const [expandedBookIds, setExpandedBookIds] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;

    async function fetchProgress() {
      if (!user) return;
      try {
        setFetching(true);
        const books = await getBooks(user.uid, false);

        const progressList = await Promise.all(
          books.map(async (book) => {
            const [tasks, submissions] = await Promise.all([
              getTasksByBook(book.id),
              getSubmissionsByBook(book.id, user.uid),
            ]);

            const submissionMap = new Map<string, TaskSubmission>();
            for (const sub of submissions) {
              submissionMap.set(sub.taskId, sub);
            }

            const completedCount = tasks.filter((t) => {
              const sub = submissionMap.get(t.id);
              return sub?.status === 'completed';
            }).length;

            const achievementRate =
              tasks.length > 0
                ? Math.round((completedCount / tasks.length) * 100)
                : 0;

            return { book, tasks, submissions, completedCount, achievementRate };
          })
        );

        setBookProgressList(progressList);
      } catch (err) {
        console.error(err);
        setError('データの読み込みに失敗しました。');
      } finally {
        setFetching(false);
      }
    }

    fetchProgress();
  }, [user]);

  const toggleExpand = (bookId: string) => {
    setExpandedBookIds((prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) {
        next.delete(bookId);
      } else {
        next.add(bookId);
      }
      return next;
    });
  };

  if (loading || fetching) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
          <p className="text-sm text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">達成率</h1>
        <p className="mt-1 text-sm text-gray-500">課題の進捗を確認できます。</p>
      </div>

      {bookProgressList.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-gray-500">割り当てられた本がありません。</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookProgressList.map(({ book, tasks, submissions, completedCount, achievementRate }) => {
            const isExpanded = expandedBookIds.has(book.id);

            const submissionMap = new Map<string, TaskSubmission>();
            for (const sub of submissions) {
              submissionMap.set(sub.taskId, sub);
            }

            return (
              <div
                key={book.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                {/* Book summary row */}
                <button
                  type="button"
                  onClick={() => toggleExpand(book.id)}
                  className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors focus:outline-none"
                >
                  <div className="flex items-center gap-4">
                    {/* Cover thumbnail */}
                    {book.coverImageUrl ? (
                      <img
                        src={book.coverImageUrl}
                        alt={book.title}
                        className="h-14 w-10 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-14 w-10 rounded bg-green-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xl">📖</span>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="font-semibold text-gray-900 truncate">{book.title}</h2>
                        <span className="text-sm font-bold text-green-700 flex-shrink-0">
                          {achievementRate}%
                        </span>
                      </div>

                      <p className="mt-0.5 text-xs text-gray-500">
                        {completedCount} / {tasks.length} 課題完了
                      </p>

                      {/* Progress bar */}
                      <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
                        <div
                          className="h-2 rounded-full bg-green-500 transition-all"
                          style={{ width: `${achievementRate}%` }}
                        />
                      </div>
                    </div>

                    {/* Expand chevron */}
                    <svg
                      className={`h-5 w-5 text-gray-400 flex-shrink-0 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded task list */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {tasks.length === 0 ? (
                      <p className="px-5 py-4 text-sm text-gray-500">課題がありません。</p>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {tasks.map((task) => {
                          const sub = submissionMap.get(task.id);
                          const status: TaskStatus = sub?.status ?? 'not_started';

                          return (
                            <li key={task.id} className="flex items-start gap-3 px-5 py-3">
                              {/* Status indicator */}
                              <div className="mt-0.5 flex-shrink-0">
                                {status === 'completed' ? (
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white text-xs">
                                    ✓
                                  </span>
                                ) : status === 'submitted' ? (
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-white text-xs">
                                    →
                                  </span>
                                ) : (
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-gray-300" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">
                                      {task.title}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                      p.{task.pageNumber}
                                    </p>
                                  </div>
                                  <span
                                    className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[status]}`}
                                  >
                                    {statusLabel[status]}
                                  </span>
                                </div>

                                {sub?.completedAt && (
                                  <p className="mt-1 text-xs text-gray-400">
                                    完了日:{' '}
                                    {sub.completedAt.toLocaleDateString('ja-JP')}
                                  </p>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
