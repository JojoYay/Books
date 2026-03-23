'use client';

import { Task, TaskSubmission } from '@/types';
import TaskDetailModal from './TaskDetailModal';
import { useState } from 'react';
import { LinkifiedText } from '@/components/LinkifiedText';

interface TaskPanelProps {
  tasks: Task[];
  submissions: TaskSubmission[];
  currentUserId: string;
  bookId: string;
  memberName?: string;
  bookTitle?: string;
  isLeader: boolean;
  onClose: () => void;
  onSubmissionChange: () => void;
}

type StatusLabel = '未着手' | '提出済み' | '完了';

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
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[label]}`}
    >
      {label}
    </span>
  );
}

export default function TaskPanel({
  tasks,
  submissions,
  currentUserId,
  bookId,
  memberName,
  bookTitle,
  isLeader,
  onClose,
  onSubmissionChange,
}: TaskPanelProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col rounded-t-2xl bg-white shadow-xl sm:inset-auto sm:right-0 sm:top-0 sm:h-full sm:w-96 sm:rounded-none sm:rounded-l-2xl">
        {/* Handle / Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-gray-900">課題一覧</span>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              {tasks.length}件
            </span>
          </div>
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
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {tasks.length === 0 ? (
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
              このページに課題はありません
            </div>
          ) : (
            tasks.map((task) => {
              const label = getStatusLabel(task.id, submissions);
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => setSelectedTask(task)}
                  className="w-full px-4 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-green-700">
                        {task.category}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-900 line-clamp-2 break-words">
                        <LinkifiedText text={task.question} />
                      </p>
                    </div>
                    <StatusBadge label={label} />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Task detail modal */}
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
            onSubmissionChange();
            setSelectedTask(null);
          }}
        />
      )}
    </>
  );
}
