'use client';

import { useEffect, useMemo, useState } from 'react';
import { Task, TaskSubmission } from '@/types';
import { getTasksByBook } from '@/lib/firestore/tasks';
import { getSubmissionsByBook } from '@/lib/firestore/submissions';
import { LinkifiedText } from '@/components/LinkifiedText';
import TaskDetailModal from './TaskDetailModal';

interface BookTasksPanelProps {
  bookId: string;
  bookTitle: string;
  currentPage: number;
  currentUserId: string;
  memberName?: string;
  isLeader: boolean;
  className?: string;
  showCloseButton?: boolean;
  onClose?: () => void;
  onJumpToPage: (pageNumber: number) => void;
}

type StatusLabel = '未着手' | '提出済み' | '完了';
type StatusFilter = 'all' | StatusLabel;

function getStatusLabel(
  taskId: string,
  submissions: TaskSubmission[]
): StatusLabel {
  const sub = submissions.find((s) => s.taskId === taskId);
  if (!sub || sub.status === 'not_started') return '未着手';
  if (sub.status === 'submitted') return '提出済み';
  return '完了';
}

function StatusBadge({ label }: { label: StatusLabel }) {
  const styles: Record<StatusLabel, string> = {
    '未着手': 'bg-gray-100 text-gray-600',
    '提出済み': 'bg-yellow-100 text-yellow-700',
    '完了': 'bg-green-100 text-green-700',
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[label]}`}
    >
      {label}
    </span>
  );
}

export default function BookTasksPanel({
  bookId,
  bookTitle,
  currentPage,
  currentUserId,
  memberName,
  isLeader,
  className,
  showCloseButton,
  onClose,
  onJumpToPage,
}: BookTasksPanelProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [allTasks, allSubs] = await Promise.all([
          getTasksByBook(bookId),
          getSubmissionsByBook(bookId, currentUserId),
        ]);
        if (cancelled) return;
        setTasks(allTasks);
        setSubmissions(allSubs);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [bookId, currentUserId]);

  async function refreshSubmissions() {
    const allSubs = await getSubmissionsByBook(bookId, currentUserId);
    setSubmissions(allSubs);
  }

  const counts = useMemo(() => {
    const c = { all: tasks.length, '未着手': 0, '提出済み': 0, '完了': 0 };
    for (const t of tasks) {
      c[getStatusLabel(t.id, submissions)] += 1;
    }
    return c;
  }, [tasks, submissions]);

  const filteredTasks = useMemo(() => {
    if (filter === 'all') return tasks;
    return tasks.filter((t) => getStatusLabel(t.id, submissions) === filter);
  }, [tasks, submissions, filter]);

  const groups = useMemo(() => {
    const map = new Map<number, Task[]>();
    for (const t of filteredTasks) {
      const arr = map.get(t.pageNumber) ?? [];
      arr.push(t);
      map.set(t.pageNumber, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [filteredTasks]);

  const filterButtons: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'すべて', count: counts.all },
    { key: '未着手', label: '未着手', count: counts['未着手'] },
    { key: '提出済み', label: '提出済み', count: counts['提出済み'] },
    { key: '完了', label: '完了', count: counts['完了'] },
  ];

  return (
    <>
      <div className={`flex min-h-0 flex-col bg-white ${className ?? ''}`}>
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-gray-900">課題一覧</span>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              {tasks.length}件
            </span>
          </div>
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              aria-label="閉じる"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-gray-100 px-3 py-2">
          {filterButtons.map((b) => {
            const active = filter === b.key;
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => setFilter(b.key)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {b.label} {b.count}
              </button>
            );
          })}
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-7 w-7 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-sm text-gray-500">
              <svg
                className="mb-3 h-10 w-10 text-gray-300"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
                />
              </svg>
              {tasks.length === 0
                ? 'この本にはまだ課題がありません'
                : '該当する課題はありません'}
            </div>
          ) : (
            <ul>
              {groups.map(([pageNumber, pageTasks]) => {
                const isCurrent = pageNumber === currentPage;
                return (
                  <li key={pageNumber}>
                    <div
                      className={`sticky top-0 z-10 flex items-center justify-between px-4 py-1.5 text-xs font-semibold ${
                        isCurrent
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-50 text-gray-600'
                      }`}
                    >
                      <span>
                        {pageNumber}ページ
                        {isCurrent && (
                          <span className="ml-1.5 rounded-full bg-green-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            表示中
                          </span>
                        )}
                      </span>
                      <span className="text-gray-400">{pageTasks.length}件</span>
                    </div>
                    <ul className="divide-y divide-gray-100">
                      {pageTasks.map((task) => {
                        const label = getStatusLabel(task.id, submissions);
                        return (
                          <li
                            key={task.id}
                            className={`flex items-stretch ${
                              isCurrent ? 'bg-green-50/30' : ''
                            } hover:bg-green-50 transition-colors`}
                          >
                            <button
                              type="button"
                              onClick={() => onJumpToPage(task.pageNumber)}
                              className="min-w-0 flex-1 px-4 py-3 text-left"
                              aria-label={`${task.pageNumber}ページへ移動`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium text-green-700">
                                    {task.category}
                                  </p>
                                  <p className="mt-0.5 break-words text-sm text-gray-900">
                                    <LinkifiedText text={task.question} />
                                  </p>
                                </div>
                                <StatusBadge label={label} />
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedTask(task)}
                              className="shrink-0 border-l border-gray-100 px-3 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
                              aria-label="課題に回答する"
                              title="回答する"
                            >
                              回答
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          submission={
            submissions.find((s) => s.taskId === selectedTask.id) ?? null
          }
          currentUserId={currentUserId}
          bookId={bookId}
          memberName={memberName}
          bookTitle={bookTitle}
          isLeader={isLeader}
          onClose={() => setSelectedTask(null)}
          onSubmissionChange={() => {
            refreshSubmissions();
            setSelectedTask(null);
          }}
        />
      )}
    </>
  );
}
