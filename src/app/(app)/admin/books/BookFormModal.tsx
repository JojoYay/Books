'use client';

import { useState, useRef } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase/client';
import { createBook, updateBook } from '@/lib/firestore/books';
import { Book } from '@/types';

interface BookFormModalProps {
  book?: Book;
  onClose: () => void;
  onSaved: () => void;
}

interface BookFormData {
  title: string;
  description: string;
  coverImageUrl: string;
  totalPages: number;
  assignedMembers: string[];
}

export default function BookFormModal({
  book,
  onClose,
  onSaved,
}: BookFormModalProps) {
  const isEditing = !!book;

  const [form, setForm] = useState<BookFormData>({
    title: book?.title ?? '',
    description: book?.description ?? '',
    coverImageUrl: book?.coverImageUrl ?? '',
    totalPages: book?.totalPages ?? 0,
    assignedMembers: book?.assignedMembers ?? [],
  });

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(
    book?.coverImageUrl ?? null
  );
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const coverInputRef = useRef<HTMLInputElement>(null);

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    const objectUrl = URL.createObjectURL(file);
    setCoverPreview(objectUrl);
  }

  async function uploadCover(bookId: string): Promise<string> {
    if (!coverFile) return form.coverImageUrl;
    const storageRef = ref(storage, `books/${bookId}/cover.jpg`);
    await uploadBytes(storageRef, coverFile);
    return getDownloadURL(storageRef);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.title.trim()) {
      setError('タイトルを入力してください。');
      return;
    }

    try {
      setSubmitting(true);

      if (isEditing && book) {
        setUploading(true);
        const coverImageUrl = await uploadCover(book.id);
        setUploading(false);
        await updateBook(book.id, { ...form, coverImageUrl });
      } else {
        // Create with a placeholder cover first, then update with the real URL
        const newBookId = await createBook({ ...form, coverImageUrl: '' });
        if (coverFile) {
          setUploading(true);
          const coverImageUrl = await uploadCover(newBookId);
          setUploading(false);
          await updateBook(newBookId, { coverImageUrl });
        }
      }

      onSaved();
    } catch (err) {
      console.error('本の保存エラー:', err);
      setUploading(false);
      setError('保存に失敗しました。もう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  }

  const isBusy = submitting || uploading;
  const busyLabel = uploading ? '画像アップロード中...' : '保存中...';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">
            {isEditing ? '本を編集' : '新規本を追加'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-50"
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          {/* Cover image upload */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              表紙画像
            </label>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverChange}
            />
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="relative flex w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 hover:border-green-400 hover:bg-green-50 transition-colors"
              style={{ minHeight: '120px' }}
            >
              {coverPreview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverPreview}
                    alt="表紙プレビュー"
                    className="h-32 w-full object-cover rounded-xl"
                  />
                  <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/30 text-xs font-medium text-white opacity-0 hover:opacity-100 transition-opacity">
                    画像を変更
                  </span>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 py-6 text-gray-400">
                  <svg
                    className="h-8 w-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                    />
                  </svg>
                  <span className="text-sm">表紙画像を選択</span>
                </div>
              )}
            </button>
          </div>

          {/* Title */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              タイトル <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="本のタイトルを入力"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              説明
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="本の説明を入力（任意）"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
            />
          </div>

          {/* Total pages */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              総ページ数
            </label>
            <input
              type="number"
              min={0}
              value={form.totalPages}
              onChange={(e) =>
                setForm({ ...form, totalPages: Number(e.target.value) })
              }
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1 pb-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isBusy}
              className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-60"
            >
              {isBusy ? busyLabel : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
