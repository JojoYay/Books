'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getAllMembers } from '@/lib/firestore/users';
import { getBooks } from '@/lib/firestore/books';
import { getTasksByBook } from '@/lib/firestore/tasks';
import {
  getSubmissionsByBook,
  getPendingSubmissions,
} from '@/lib/firestore/submissions';
import { Book, Task, TaskSubmission, UserProfile } from '@/types';
import { calcSchoolGrade, gradeBadgeClass } from '@/lib/utils/school-grade';
import SubmissionReviewModal from './SubmissionReviewModal';

interface MemberBookStat {
  book: Book;
  completedCount: number;
  totalTasks: number;
  achievementRate: number;
  submittedPending: number;
}

interface MemberRow {
  member: UserProfile;
  stats: MemberBookStat[];
  overallRate: number;
  pendingReviewCount: number;
}

interface PendingItem {
  submission: TaskSubmission;
  task: Task;
  member: UserProfile;
  book: Book;
}

function rateColor(rate: number): string {
  if (rate >= 66) return 'bg-green-100 text-green-800';
  if (rate >= 33) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

export default function DashboardPage() {
  const { user, isLeader, loading } = useAuth();
  const router = useRouter();

  const [members, setMembers] = useState<UserProfile[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [memberRows, setMemberRows] = useState<MemberRow[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [expandedMemberIds, setExpandedMemberIds] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Review modal
  const [reviewItem, setReviewItem] = useState<PendingItem | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (!isLeader) {
        router.replace('/');
      }
    }
  }, [loading, user, isLeader, router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      setFetching(true);
      const [fetchedMembers, fetchedBooks, pendingSubs] = await Promise.all([
        getAllMembers(),
        getBooks(user.uid, true),
        getPendingSubmissions(),
      ]);

      setMembers(fetchedMembers);
      setBooks(fetchedBooks);

      // Pre-fetch all tasks per book
      const tasksByBook = new Map<string, Task[]>();
      await Promise.all(
        fetchedBooks.map(async (book) => {
          const tasks = await getTasksByBook(book.id);
          tasksByBook.set(book.id, tasks);
        })
      );

      // Build task lookup
      const taskMap = new Map<string, Task>();
      for (const tasks of tasksByBook.values()) {
        for (const t of tasks) taskMap.set(t.id, t);
      }

      // Build member lookup
      const memberMap = new Map<string, UserProfile>();
      for (const m of fetchedMembers) memberMap.set(m.id, m);

      // Build book lookup
      const bookMap = new Map<string, Book>();
      for (const b of fetchedBooks) bookMap.set(b.id, b);

      // Build pending items (with full details)
      const items: PendingItem[] = [];
      for (const sub of pendingSubs) {
        const task = taskMap.get(sub.taskId);
        const member = memberMap.get(sub.memberId);
        const book = bookMap.get(sub.bookId);
        if (task && member && book) {
          items.push({ submission: sub, task, member, book });
        }
      }
      // Sort by submission date (newest first)
      items.sort((a, b) => {
        const da = a.submission.submittedAt?.getTime() ?? 0;
        const db = b.submission.submittedAt?.getTime() ?? 0;
        return db - da;
      });
      setPendingItems(items);

      // Build member rows for progress table
      const rows: MemberRow[] = await Promise.all(
        fetchedMembers.map(async (member) => {
          const stats: MemberBookStat[] = await Promise.all(
            fetchedBooks
              .filter((b) => b.assignedMembers.includes(member.id))
              .map(async (book) => {
                const tasks = tasksByBook.get(book.id) ?? [];
                const submissions: TaskSubmission[] = await getSubmissionsByBook(
                  book.id,
                  member.id
                );

                const subMap = new Map<string, TaskSubmission>();
                for (const sub of submissions) {
                  subMap.set(sub.taskId, sub);
                }

                const completedCount = tasks.filter(
                  (t) => subMap.get(t.id)?.status === 'completed'
                ).length;

                const submittedPending = tasks.filter(
                  (t) => subMap.get(t.id)?.status === 'submitted'
                ).length;

                const achievementRate =
                  tasks.length > 0
                    ? Math.round((completedCount / tasks.length) * 100)
                    : 0;

                return {
                  book,
                  completedCount,
                  totalTasks: tasks.length,
                  achievementRate,
                  submittedPending,
                };
              })
          );

          const totalCompleted = stats.reduce((sum, s) => sum + s.completedCount, 0);
          const totalTaskCount = stats.reduce((sum, s) => sum + s.totalTasks, 0);
          const overallRate =
            totalTaskCount > 0 ? Math.round((totalCompleted / totalTaskCount) * 100) : 0;

          const pendingReviewCount = stats.reduce(
            (sum, s) => sum + s.submittedPending,
            0
          );

          return { member, stats, overallRate, pendingReviewCount };
        })
      );

      setMemberRows(rows);
    } catch (err) {
      console.error(err);
      setError('データの読み込みに失敗しました。');
    } finally {
      setFetching(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && isLeader) {
      fetchData();
    }
  }, [user, isLeader, fetchData]);

  const toggleMember = (memberId: string) => {
    setExpandedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  const handleReviewCompleted = () => {
    setReviewItem(null);
    fetchData();
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
      <div className="rounded-lg bg-red-50 p-6 text-center text-red-700">{error}</div>
    );
  }

  const totalCompleted = memberRows.reduce(
    (sum, row) => sum + row.stats.reduce((s, st) => s + st.completedCount, 0),
    0
  );
  const totalTasks = memberRows.reduce(
    (sum, row) => sum + row.stats.reduce((s, st) => s + st.totalTasks, 0),
    0
  );
  const overallRate =
    totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
        <p className="mt-1 text-sm text-gray-500">全隊員の進捗状況を確認できます。</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: '隊員数', value: members.length },
          { label: '本の数', value: books.length },
          { label: '総課題数', value: totalTasks },
          { label: '全体達成率', value: `${overallRate}%` },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm"
          >
            <p className="text-2xl font-bold text-green-700">{card.value}</p>
            <p className="mt-1 text-xs text-gray-500">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Pending submissions — clickable to review */}
      {pendingItems.length > 0 && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-yellow-800">
            <span>🔔</span>
            提出済み課題（確認待ち {pendingItems.length}件）
          </h2>
          <ul className="space-y-2">
            {pendingItems.map((item) => (
              <li key={item.submission.id}>
                <button
                  type="button"
                  onClick={() => setReviewItem(item)}
                  className="w-full flex items-center gap-3 rounded-lg bg-white px-3 py-2.5 text-left shadow-sm hover:bg-yellow-100 transition-colors border border-yellow-100"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-gray-900">{item.member.name}</span>
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-600 truncate">{item.book.title}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500 truncate">
                      {item.task.category} — {item.task.question}
                      {item.submission.photos.length > 0 && ` — 写真${item.submission.photos.length}枚`}
                      {item.submission.comment && ' — コメントあり'}
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {item.submission.submittedAt && (
                      <span className="text-[10px] text-gray-400">
                        {new Date(item.submission.submittedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Member grid / table */}
      {memberRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-gray-500">隊員がいません。</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">隊員別進捗</h2>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    隊員名
                  </th>
                  {books.map((book) => (
                    <th
                      key={book.id}
                      className="px-3 py-3 text-center font-medium text-gray-600 max-w-[120px]"
                    >
                      <span className="block truncate">{book.title}</span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center font-medium text-gray-600">
                    全体
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {memberRows.map((row) => (
                  <>
                    <tr
                      key={row.member.id}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => toggleMember(row.member.id)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <svg
                            className={`h-4 w-4 text-gray-400 transition-transform ${
                              expandedMemberIds.has(row.member.id) ? 'rotate-90' : ''
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                          {row.member.name}
                          {row.member.birthday && (() => {
                            const grade = calcSchoolGrade(row.member.birthday!);
                            return grade ? (
                              <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${gradeBadgeClass(grade.level)}`}>
                                {grade.label}
                              </span>
                            ) : null;
                          })()}
                          {row.pendingReviewCount > 0 && (
                            <span className="rounded-full bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-700">
                              {row.pendingReviewCount}
                            </span>
                          )}
                        </div>
                      </td>
                      {books.map((book) => {
                        const stat = row.stats.find((s) => s.book.id === book.id);
                        if (!stat) {
                          return (
                            <td key={book.id} className="px-3 py-3 text-center text-gray-300">
                              —
                            </td>
                          );
                        }
                        return (
                          <td key={book.id} className="px-3 py-3 text-center">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${rateColor(
                                stat.achievementRate
                              )}`}
                            >
                              {stat.achievementRate}%
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${rateColor(
                            row.overallRate
                          )}`}
                        >
                          {row.overallRate}%
                        </span>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {expandedMemberIds.has(row.member.id) && (
                      <tr key={`${row.member.id}-detail`}>
                        <td colSpan={books.length + 2} className="bg-gray-50 px-6 py-3">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {row.stats.map((stat) => (
                              <div
                                key={stat.book.id}
                                className="rounded-lg border border-gray-200 bg-white p-3"
                              >
                                <p className="mb-1 font-medium text-gray-800 truncate">
                                  {stat.book.title}
                                </p>
                                <div className="mb-1 h-1.5 w-full rounded-full bg-gray-100">
                                  <div
                                    className="h-1.5 rounded-full bg-green-500"
                                    style={{ width: `${stat.achievementRate}%` }}
                                  />
                                </div>
                                <p className="text-xs text-gray-500">
                                  {stat.completedCount} / {stat.totalTasks} 課題完了
                                  {stat.submittedPending > 0 && (
                                    <span className="ml-2 text-yellow-600">
                                      提出済 {stat.submittedPending} 件
                                    </span>
                                  )}
                                </p>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked cards */}
          <div className="space-y-3 md:hidden">
            {memberRows.map((row) => (
              <div
                key={row.member.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => toggleMember(row.member.id)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{row.member.name}</span>
                      {row.member.birthday && (() => {
                        const grade = calcSchoolGrade(row.member.birthday!);
                        return grade ? (
                          <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${gradeBadgeClass(grade.level)}`}>
                            {grade.label}
                          </span>
                        ) : null;
                      })()}
                      {row.pendingReviewCount > 0 && (
                        <span className="rounded-full bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-700">
                          確認待ち {row.pendingReviewCount} 件
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${rateColor(
                          row.overallRate
                        )}`}
                      >
                        {row.overallRate}%
                      </span>
                      <svg
                        className={`h-4 w-4 text-gray-400 transition-transform ${
                          expandedMemberIds.has(row.member.id) ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </button>

                {expandedMemberIds.has(row.member.id) && (
                  <div className="border-t border-gray-100 px-4 py-3 space-y-2">
                    {row.stats.length === 0 ? (
                      <p className="text-sm text-gray-500">割り当てられた本がありません。</p>
                    ) : (
                      row.stats.map((stat) => (
                        <div key={stat.book.id}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-gray-800 truncate max-w-[70%]">
                              {stat.book.title}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${rateColor(
                                stat.achievementRate
                              )}`}
                            >
                              {stat.achievementRate}%
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100">
                            <div
                              className="h-1.5 rounded-full bg-green-500"
                              style={{ width: `${stat.achievementRate}%` }}
                            />
                          </div>
                          <p className="mt-0.5 text-xs text-gray-400">
                            {stat.completedCount} / {stat.totalTasks} 課題完了
                            {stat.submittedPending > 0 && (
                              <span className="ml-2 text-yellow-600">
                                提出済 {stat.submittedPending} 件
                              </span>
                            )}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewItem && user && (
        <SubmissionReviewModal
          submission={reviewItem.submission}
          task={reviewItem.task}
          member={reviewItem.member}
          book={reviewItem.book}
          currentUserId={user.uid}
          onClose={() => setReviewItem(null)}
          onCompleted={handleReviewCompleted}
        />
      )}
    </div>
  );
}
