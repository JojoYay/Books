'use client';

import { useState } from 'react';
import { Task, TaskSubmission, UserProfile, Book } from '@/types';
import { completeSubmission } from '@/lib/firestore/submissions';
import { LinkifiedText } from '@/components/LinkifiedText';

interface SubmissionReviewModalProps {
  submission: TaskSubmission;
  task: Task;
  member: UserProfile;
  book: Book;
  currentUserId: string;
  onClose: () => void;
  onCompleted: () => void;
}

export default function SubmissionReviewModal({
  submission,
  task,
  member,
  book,
  currentUserId,
  onClose,
  onCompleted,
}: SubmissionReviewModalProps) {
  const [feedback, setFeedback] = useState('');
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoZoom, setPhotoZoom] = useState<string | null>(null);

  async function handleComplete() {
    setCompleting(true);
    setError(null);
    try {
      await completeSubmission(submission.id, currentUserId, feedback || undefined);
      onCompleted();
    } catch {
      setError('承認処理に失敗しました。');
    } finally {
      setCompleting(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-x-3 bottom-3 top-14 z-50 flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:inset-x-auto sm:left-1/2 sm:top-10 sm:bottom-10 sm:w-full sm:max-w-lg sm:-translate-x-1/2">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 truncate">
              提出内容の確認
            </h2>
            <p className="text-xs text-gray-500 truncate">
              {member.name} — {book.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="閉じる"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Task info */}
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs font-medium text-green-700">{task.category}</p>
            <p className="text-sm font-semibold text-gray-800">{task.question}</p>
            <p className="text-xs text-gray-500 mt-0.5">p.{task.pageNumber}</p>
          </div>

          {/* Submission info */}
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-yellow-800">提出済み</span>
              {submission.submittedAt && (
                <span className="text-xs text-yellow-700">
                  {new Date(submission.submittedAt).toLocaleString('ja-JP')}
                </span>
              )}
            </div>
          </div>

          {/* Photos */}
          {submission.photos.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">
                写真（{submission.photos.length}枚）
              </p>
              <div className="grid grid-cols-2 gap-2">
                {submission.photos.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPhotoZoom(url)}
                    className="relative aspect-square overflow-hidden rounded-lg border border-gray-200 hover:opacity-90 transition-opacity"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`写真 ${i + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          {submission.files.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">
                ファイル（{submission.files.length}件）
              </p>
              <div className="space-y-1">
                {submission.files.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-gray-200 p-2 text-sm text-blue-600 hover:bg-gray-50"
                  >
                    <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                    </svg>
                    ファイル {i + 1}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Comment */}
          {submission.comment && (
            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">コメント</p>
              <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-wrap break-words">
                <LinkifiedText text={submission.comment} />
              </p>
            </div>
          )}

          {/* No content */}
          {submission.photos.length === 0 && submission.files.length === 0 && !submission.comment && (
            <p className="text-sm text-gray-400 text-center py-4">
              提出内容がありません
            </p>
          )}
        </div>

        {/* Footer: approve action */}
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={2}
            placeholder="フィードバックコメント（任意）"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
          />
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</p>
          )}
          <button
            type="button"
            onClick={handleComplete}
            disabled={completing}
            className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
          >
            {completing ? '処理中...' : '承認する（完了にする）'}
          </button>
        </div>
      </div>

      {/* Photo zoom overlay */}
      {photoZoom && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/80"
            onClick={() => setPhotoZoom(null)}
            aria-hidden="true"
          />
          <div className="fixed inset-4 z-[60] flex items-center justify-center" onClick={() => setPhotoZoom(null)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoZoom}
              alt="拡大写真"
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          </div>
        </>
      )}
    </>
  );
}
