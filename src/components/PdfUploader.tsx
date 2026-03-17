'use client';

import { useRef, useState } from 'react';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase/client';
import { savePage, deleteAllPages } from '@/lib/firestore/pages';
import { updateBook } from '@/lib/firestore/books';

interface PdfUploaderProps {
  bookId: string;
  onComplete: (totalPages: number, coverImageUrl: string) => void;
  onError: (message: string) => void;
}

interface ProgressState {
  current: number;
  total: number;
  phase: 'converting' | 'uploading' | 'done';
}

export default function PdfUploader({ bookId, onComplete, onError }: PdfUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  async function processPdf(file: File) {
    setDetailError(null);
    try {
      // Dynamic import（SSR回避）
      const pdfjs = await import('pdfjs-dist');

      // ローカルにコピーしたworkerを使用（CDN依存を排除）
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;

      setProgress({ current: 0, total: totalPages, phase: 'converting' });

      // 既存ページを削除
      await deleteAllPages(bookId);

      let coverImageUrl = '';

      for (let i = 1; i <= totalPages; i++) {
        // --- 変換フェーズ ---
        setProgress({ current: i, total: totalPages, phase: 'converting' });

        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });

        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context の取得に失敗しました');

        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        page.cleanup();

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('JPEG変換に失敗しました'))),
            'image/jpeg',
            0.85
          );
        });

        // --- アップロードフェーズ ---
        setProgress({ current: i, total: totalPages, phase: 'uploading' });

        const path = `books/${bookId}/pages/page_${String(i).padStart(4, '0')}.jpg`;
        const ref = storageRef(storage, path);
        await uploadBytes(ref, blob, { contentType: 'image/jpeg' });
        const url = await getDownloadURL(ref);

        await savePage(bookId, i, url);

        if (i === 1) coverImageUrl = url;
      }

      // 本のドキュメントを更新
      await updateBook(bookId, { totalPages, coverImageUrl });

      setProgress({ current: totalPages, total: totalPages, phase: 'done' });
      onComplete(totalPages, coverImageUrl);

    } catch (err) {
      console.error('PDF処理エラー:', err);
      setProgress(null);
      const msg = err instanceof Error ? err.message : String(err);
      setDetailError(msg);
      onError(`PDFの処理中にエラーが発生しました: ${msg}`);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processPdf(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === 'application/pdf') {
      processPdf(file);
    } else {
      onError('PDFファイルを選択してください。');
    }
  }

  const isProcessing = progress !== null && progress.phase !== 'done';
  const percent = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;
  const phaseLabel =
    progress?.phase === 'converting' ? '変換中' :
    progress?.phase === 'uploading' ? 'アップロード中' : '完了';

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">PDFファイル</label>

      {/* Drop zone */}
      <div
        className={`relative flex min-h-[140px] flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
          isDragging ? 'border-green-400 bg-green-50' :
          isProcessing ? 'border-gray-200 bg-gray-50' :
          'border-gray-200 bg-gray-50 hover:border-green-400 hover:bg-green-50 cursor-pointer'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileChange}
          disabled={isProcessing}
        />

        {isProcessing ? (
          <div className="w-full px-6 space-y-3">
            <div className="h-2 w-full rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-green-500 transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="text-center text-sm text-gray-600">
              {phaseLabel}: {progress!.current} / {progress!.total} ページ ({percent}%)
            </p>
          </div>
        ) : progress?.phase === 'done' ? (
          <div className="flex flex-col items-center gap-2 text-green-600">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium">{progress.total}ページのアップロード完了</p>
            <button
              type="button"
              className="text-xs text-gray-500 underline"
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            >
              別のPDFに変更
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-sm font-medium">PDFをドラッグ＆ドロップ</p>
            <p className="text-xs">またはクリックして選択</p>
          </div>
        )}
      </div>

      {/* エラー詳細（デバッグ用） */}
      {detailError && (
        <details className="rounded-lg bg-red-50 p-3 text-xs text-red-600">
          <summary className="cursor-pointer font-medium">エラー詳細（隊長向け）</summary>
          <pre className="mt-2 whitespace-pre-wrap break-all">{detailError}</pre>
        </details>
      )}

      <p className="text-xs text-gray-400">
        ※ PDFの各ページがJPEG画像に変換されてアップロードされます。大きなファイルは時間がかかります。
      </p>
    </div>
  );
}
