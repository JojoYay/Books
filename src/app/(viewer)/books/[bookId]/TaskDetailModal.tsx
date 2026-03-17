'use client';

import { useState, useRef } from 'react';
import { Task, TaskSubmission } from '@/types';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase/client';
import { createOrUpdateSubmission, completeSubmission } from '@/lib/firestore/submissions';

interface TaskDetailModalProps {
  task: Task;
  submission: TaskSubmission | null;
  currentUserId: string;
  bookId: string;
  memberName?: string;
  bookTitle?: string;
  isLeader: boolean;
  onClose: () => void;
  onSubmissionChange: () => void;
}

export default function TaskDetailModal({
  task,
  submission,
  currentUserId,
  bookId,
  memberName,
  bookTitle,
  isLeader,
  onClose,
  onSubmissionChange,
}: TaskDetailModalProps) {
  const [comment, setComment] = useState(submission?.comment ?? '');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [attachFiles, setAttachFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parent PIN flow
  const [showPinInput, setShowPinInput] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [verifyingPin, setVerifyingPin] = useState(false);

  // Leader completion flow
  const [showLeaderComplete, setShowLeaderComplete] = useState(false);
  const [leaderFeedback, setLeaderFeedback] = useState('');
  const [completingAsLeader, setCompletingAsLeader] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const status = submission?.status ?? 'not_started';

  async function uploadFiles(
    files: File[],
    folder: string
  ): Promise<string[]> {
    return Promise.all(
      files.map(async (file) => {
        const storageRef = ref(
          storage,
          `submissions/${currentUserId}/${task.id}/${folder}/${Date.now()}_${file.name}`
        );
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
      })
    );
  }

  async function handleSubmit() {
    setUploading(true);
    setError(null);
    try {
      const [uploadedPhotos, uploadedFiles] = await Promise.all([
        uploadFiles(photoFiles, 'photos'),
        uploadFiles(attachFiles, 'files'),
      ]);

      const existingPhotos = submission?.photos ?? [];
      const existingFiles = submission?.files ?? [];

      const submittedAt = new Date();

      await createOrUpdateSubmission({
        taskId: task.id,
        bookId,
        memberId: currentUserId,
        photos: [...existingPhotos, ...uploadedPhotos],
        files: [...existingFiles, ...uploadedFiles],
        comment,
        status: 'submitted',
        submittedAt,
        completedAt: null,
        completedBy: null,
        leaderFeedback: null,
      });

      // Fire-and-forget: notify leaders via email
      if (memberName && bookTitle) {
        fetch('/api/notify-submission', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: task.id,
            memberId: currentUserId,
            memberName,
            bookTitle,
            taskTitle: task.title,
            submittedAt: submittedAt.toISOString(),
          }),
        }).catch((err) =>
          console.warn('通知メール送信エラー:', err)
        );
      }

      onSubmissionChange();
    } catch (err) {
      console.error('提出エラー:', err);
      setError('提出に失敗しました。もう一度お試しください。');
    } finally {
      setUploading(false);
    }
  }

  async function handleVerifyPin() {
    if (!submission) return;
    setPinError(null);
    setVerifyingPin(true);
    try {
      const res = await fetch('/api/verify-parent-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: submission.id, pin }),
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (data.success) {
        onSubmissionChange();
      } else {
        setPinError(data.error ?? 'PINが正しくありません');
      }
    } catch {
      setPinError('エラーが発生しました');
    } finally {
      setVerifyingPin(false);
    }
  }

  async function handleLeaderComplete() {
    if (!submission) return;
    setCompletingAsLeader(true);
    try {
      await completeSubmission(submission.id, currentUserId, leaderFeedback);
      onSubmissionChange();
    } catch {
      setError('完了処理に失敗しました');
    } finally {
      setCompletingAsLeader(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-60 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-x-4 bottom-4 top-16 z-70 flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:inset-x-auto sm:left-1/2 sm:top-12 sm:w-full sm:max-w-lg sm:-translate-x-1/2">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900 truncate pr-4">
            {task.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
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

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Description */}
          {task.description && (
            <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
              {task.description}
            </div>
          )}

          {/* Completion info */}
          {status === 'completed' && (
            <div className="rounded-xl bg-green-50 border border-green-200 p-3 space-y-1">
              <p className="text-sm font-medium text-green-800">完了済み</p>
              {submission?.completedAt && (
                <p className="text-xs text-green-700">
                  完了日時:{' '}
                  {new Date(submission.completedAt).toLocaleString('ja-JP')}
                </p>
              )}
              {submission?.completedBy && (
                <p className="text-xs text-green-700">
                  確認者:{' '}
                  {submission.completedBy === 'parent'
                    ? '保護者'
                    : `リーダー (${submission.completedBy})`}
                </p>
              )}
              {submission?.leaderFeedback && (
                <p className="text-xs text-green-700 mt-1">
                  コメント: {submission.leaderFeedback}
                </p>
              )}
            </div>
          )}

          {/* Existing submission */}
          {submission && submission.photos.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">
                提出済み写真
              </p>
              <div className="grid grid-cols-3 gap-2">
                {submission.photos.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={url}
                    alt={`写真 ${i + 1}`}
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                ))}
              </div>
            </div>
          )}

          {submission && submission.files.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">
                提出済みファイル
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
                    <svg
                      className="h-4 w-4 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
                      />
                    </svg>
                    ファイル {i + 1}
                  </a>
                ))}
              </div>
            </div>
          )}

          {submission?.comment && (
            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">
                提出コメント
              </p>
              <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                {submission.comment}
              </p>
            </div>
          )}

          {/* Submit form — only when not completed */}
          {status !== 'completed' && (
            <div className="space-y-4 border-t border-gray-100 pt-4">
              <p className="text-sm font-semibold text-gray-800">
                {status === 'submitted' ? '再提出する' : '課題を提出する'}
              </p>

              {/* Photo upload */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  写真
                </label>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) =>
                    setPhotoFiles(Array.from(e.target.files ?? []))
                  }
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 px-4 py-3 text-sm text-gray-500 hover:border-green-400 hover:text-green-600 transition-colors w-full justify-center"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
                    />
                  </svg>
                  {photoFiles.length > 0
                    ? `${photoFiles.length}枚選択中`
                    : '写真を選択'}
                </button>
              </div>

              {/* File upload */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  ファイル
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) =>
                    setAttachFiles(Array.from(e.target.files ?? []))
                  }
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 px-4 py-3 text-sm text-gray-500 hover:border-green-400 hover:text-green-600 transition-colors w-full justify-center"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
                    />
                  </svg>
                  {attachFiles.length > 0
                    ? `${attachFiles.length}件選択中`
                    : 'ファイルを選択'}
                </button>
              </div>

              {/* Comment */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  コメント
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="コメントを入力（任意）"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={uploading}
                className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
              >
                {uploading ? '提出中...' : '提出する'}
              </button>
            </div>
          )}

          {/* Parent PIN verification — only when submitted */}
          {status === 'submitted' && !isLeader && (
            <div className="border-t border-gray-100 pt-4">
              {!showPinInput ? (
                <button
                  type="button"
                  onClick={() => setShowPinInput(true)}
                  className="w-full rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  保護者確認
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">
                    保護者PINを入力してください
                  </p>
                  <input
                    type="password"
                    inputMode="numeric"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="PIN"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                  {pinError && (
                    <p className="text-sm text-red-600">{pinError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPinInput(false);
                        setPin('');
                        setPinError(null);
                      }}
                      className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={handleVerifyPin}
                      disabled={verifyingPin || !pin}
                      className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
                    >
                      {verifyingPin ? '確認中...' : '確認'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Leader completion — only when submitted and user is leader */}
          {status === 'submitted' && isLeader && (
            <div className="border-t border-gray-100 pt-4">
              {!showLeaderComplete ? (
                <button
                  type="button"
                  onClick={() => setShowLeaderComplete(true)}
                  className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  完了サイン
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">
                    フィードバックコメント（任意）
                  </p>
                  <textarea
                    value={leaderFeedback}
                    onChange={(e) => setLeaderFeedback(e.target.value)}
                    rows={3}
                    placeholder="フィードバックを入力"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                  {error && (
                    <p className="text-sm text-red-600">{error}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowLeaderComplete(false)}
                      className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={handleLeaderComplete}
                      disabled={completingAsLeader}
                      className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
                    >
                      {completingAsLeader ? '処理中...' : '完了にする'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
