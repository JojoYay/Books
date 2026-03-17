'use client';

import { useState } from 'react';
import { createBook, updateBook } from '@/lib/firestore/books';
import { Book } from '@/types';
import PdfUploader from '@/components/PdfUploader';

interface BookFormModalProps {
  book?: Book;
  onClose: () => void;
  onSaved: () => void;
}

export default function BookFormModal({ book, onClose, onSaved }: BookFormModalProps) {
  const isEditing = !!book;

  const [title, setTitle] = useState(book?.title ?? '');
  const [description, setDescription] = useState(book?.description ?? '');

  // 本登録の2ステップ管理
  const [bookId, setBookId] = useState<string | null>(book?.id ?? null);
  const [step, setStep] = useState<'form' | 'pdf'>(book ? 'pdf' : 'form');

  const [pdfDone, setPdfDone] = useState(isEditing ? book.totalPages > 0 : false);
  const [totalPages, setTotalPages] = useState(book?.totalPages ?? 0);
  const [coverImageUrl, setCoverImageUrl] = useState(book?.coverImageUrl ?? '');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateBook(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('タイトルを入力してください。'); return; }
    setError(null);
    try {
      setSubmitting(true);
      const id = await createBook({
        title: title.trim(),
        description: description.trim(),
        coverImageUrl: '',
        totalPages: 0,
        assignedMembers: [],
      });
      setBookId(id);
      setStep('pdf');
    } catch {
      setError('本の作成に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateMeta(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('タイトルを入力してください。'); return; }
    if (!bookId) return;
    setError(null);
    try {
      setSubmitting(true);
      await updateBook(bookId, { title: title.trim(), description: description.trim() });
      setStep('pdf');
    } catch {
      setError('更新に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  }

  function handlePdfComplete(pages: number, cover: string) {
    setTotalPages(pages);
    setCoverImageUrl(cover);
    setPdfDone(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isEditing ? '本を編集' : '新規本を追加'}
            </h2>
            {!isEditing && (
              <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                <span className={step === 'form' ? 'font-semibold text-green-600' : ''}>① 基本情報</span>
                <span>→</span>
                <span className={step === 'pdf' ? 'font-semibold text-green-600' : ''}>② PDFアップロード</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* ── Step 1: 基本情報 ── */}
          {step === 'form' && (
            <form onSubmit={isEditing ? handleUpdateMeta : handleCreateBook} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  タイトル <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例: スカウトハンドブック2024"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">説明</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="本の説明（任意）"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
                />
              </div>

              {error && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600">{error}</p>}

              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  キャンセル
                </button>
                <button type="submit" disabled={submitting} className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">
                  {submitting ? '作成中...' : '次へ → PDFをアップロード'}
                </button>
              </div>
            </form>
          )}

          {/* ── Step 2: PDF アップロード ── */}
          {step === 'pdf' && bookId && (
            <div className="space-y-5">
              {/* タイトル確認 */}
              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-xs text-gray-500">登録する本</p>
                  <p className="font-semibold text-gray-900">{title}</p>
                </div>
                {!pdfDone && (
                  <button type="button" onClick={() => setStep('form')} className="text-xs text-green-600 underline">
                    変更
                  </button>
                )}
              </div>

              <PdfUploader
                bookId={bookId}
                onComplete={handlePdfComplete}
                onError={(msg) => setError(msg)}
              />

              {error && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600">{error}</p>}

              {/* 完了プレビュー */}
              {pdfDone && coverImageUrl && (
                <div className="flex items-center gap-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverImageUrl} alt="表紙" className="h-16 w-12 rounded object-cover shadow" />
                  <div>
                    <p className="text-sm font-medium text-green-800">アップロード完了</p>
                    <p className="text-xs text-green-700">{totalPages} ページ登録済み</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-1">
                {!pdfDone && (
                  <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                    後でアップロード
                  </button>
                )}
                {pdfDone && (
                  <button type="button" onClick={onSaved} className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700">
                    完了
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
