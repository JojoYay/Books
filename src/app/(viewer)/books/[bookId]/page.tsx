'use client';

import { useEffect, useState, useCallback, useRef, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getBook } from '@/lib/firestore/books';
import { getTasksByPage } from '@/lib/firestore/tasks';
import { getSubmission } from '@/lib/firestore/submissions';
import {
  isBookmarked,
  addBookmark,
  removeBookmark,
  getBookmarkId,
} from '@/lib/firestore/bookmarks';
import { getMemo, saveMemo } from '@/lib/firestore/memos';
import { Book, BookPage, Task, TaskSubmission } from '@/types';
import TaskPanel from './TaskPanel';

interface BookViewerPageProps {
  params: Promise<{ bookId: string }>;
}

export default function BookViewerPage({ params }: BookViewerPageProps) {
  const { bookId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userProfile, isLeader } = useAuth();

  const [book, setBook] = useState<Book | null>(null);
  const [pageData, setPageData] = useState<BookPage | null>(null);
  const [currentPage, setCurrentPage] = useState(
    Number(searchParams.get('page') ?? '1')
  );
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Page slider
  const [sliderValue, setSliderValue] = useState(
    Number(searchParams.get('page') ?? '1')
  );
  const [showSlider, setShowSlider] = useState(false);

  // Tasks
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [showTaskPanel, setShowTaskPanel] = useState(false);

  // Bookmark
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  // Memo
  const [showMemoPanel, setShowMemoPanel] = useState(false);
  const [memoText, setMemoText] = useState('');
  const [memoId, setMemoId] = useState<string | null>(null);
  const [memoSaving, setMemoSaving] = useState(false);

  // Share
  const [shareToast, setShareToast] = useState(false);

  // Touch gesture tracking
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Load book info once
  useEffect(() => {
    async function loadBook() {
      try {
        const b = await getBook(bookId);
        setBook(b);
      } catch {
        setBook(null);
      } finally {
        setLoading(false);
      }
    }
    loadBook();
  }, [bookId]);

  // Load page image + tasks + bookmark + memo whenever page changes
  const loadPageData = useCallback(
    async (pageNum: number) => {
      if (!user) return;
      setPageLoading(true);
      setImageError(false);
      setOffline(false);

      try {
        // Page image - 正しいパス: books/{bookId}/pages/{pageNum}
        const pageRef = doc(db, 'books', bookId, 'pages', String(pageNum));
        const pageSnap = await getDoc(pageRef);
        if (pageSnap.exists()) {
          const data = pageSnap.data() as { imageUrl?: string };
          setPageData({
            pageNumber: pageNum,
            imageUrl: data.imageUrl ?? '',
          });
        } else {
          setPageData({ pageNumber: pageNum, imageUrl: '' });
        }

        // Tasks for this page
        const pageTasks = await getTasksByPage(bookId, pageNum);
        setTasks(pageTasks);

        // Submissions for these tasks
        const subs = await Promise.all(
          pageTasks.map((t) => getSubmission(t.id, user.uid))
        );
        setSubmissions(subs.filter(Boolean) as TaskSubmission[]);

        // Bookmark status
        const bm = await isBookmarked(user.uid, bookId, pageNum);
        setBookmarked(bm);

        // Memo
        const memo = await getMemo(user.uid, bookId, pageNum);
        setMemoText(memo?.text ?? '');
        setMemoId(memo?.id ?? null);
      } catch (err) {
        console.error('ページ読み込みエラー:', err);
        if (!navigator.onLine) {
          setOffline(true);
        }
      } finally {
        setPageLoading(false);
      }
    },
    [bookId, user]
  );

  useEffect(() => {
    loadPageData(currentPage);
  }, [currentPage, loadPageData]);

  // Sync URL param
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(currentPage));
    router.replace(`/books/${bookId}?${params.toString()}`, { scroll: false });
  }, [currentPage, bookId, router, searchParams]);

  function goToPage(page: number) {
    if (!book) return;
    const clamped = Math.max(1, Math.min(book.totalPages, page));
    setCurrentPage(clamped);
    setSliderValue(clamped);
    setShowTaskPanel(false);
    setShowMemoPanel(false);
  }

  // Touch gesture handlers
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;

    // Only treat as horizontal swipe if horizontal movement dominates
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) {
        goToPage(currentPage + 1); // swipe left → next
      } else {
        goToPage(currentPage - 1); // swipe right → prev
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  }

  // Bookmark toggle
  async function toggleBookmark() {
    if (!user || bookmarkLoading) return;
    setBookmarkLoading(true);
    try {
      if (bookmarked) {
        const bmId = await getBookmarkId(user.uid, bookId, currentPage);
        if (bmId) await removeBookmark(user.uid, bmId);
        setBookmarked(false);
      } else {
        await addBookmark(user.uid, { bookId, pageNumber: currentPage });
        setBookmarked(true);
      }
    } catch (err) {
      console.error('しおりエラー:', err);
    } finally {
      setBookmarkLoading(false);
    }
  }

  // Share URL
  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: book?.title, url });
      } catch {
        // cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
    }
  }

  // Save memo
  async function handleSaveMemo() {
    if (!user) return;
    setMemoSaving(true);
    try {
      const id = await saveMemo(user.uid, {
        bookId,
        pageNumber: currentPage,
        text: memoText,
      });
      setMemoId(id);
      setShowMemoPanel(false);
    } catch (err) {
      console.error('メモ保存エラー:', err);
    } finally {
      setMemoSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
          <p className="text-sm text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <p className="text-lg font-semibold text-gray-700">
          本が見つかりません
        </p>
        <Link
          href="/"
          className="mt-4 text-sm text-green-600 hover:underline"
        >
          本一覧に戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-900 overflow-hidden">
      {/* Header */}
      <header className="shrink-0 z-30 flex items-center justify-between bg-gray-900/95 backdrop-blur px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm font-medium text-gray-300 hover:text-white transition-colors"
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
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
          戻る
        </Link>
        <h1 className="max-w-[200px] truncate text-sm font-semibold text-white sm:max-w-xs">
          {book.title}
        </h1>
        <span className="text-sm text-gray-400">
          {currentPage} / {book.totalPages}
        </span>
      </header>

      {/* Share toast */}
      {shareToast && (
        <div className="fixed top-16 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-800 px-4 py-2.5 text-sm font-medium text-white shadow-lg animate-fade-in">
          URLをコピーしました
        </div>
      )}

      {/* Page image area */}
      <div
        className="relative flex flex-1 min-h-0 items-center justify-center"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {pageLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/60 z-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
          </div>
        )}

        {offline && (
          <div className="flex flex-col items-center gap-3 text-center px-4">
            <svg
              className="h-12 w-12 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3"
              />
            </svg>
            <p className="text-lg font-semibold text-gray-300">
              オフラインです
            </p>
            <p className="text-sm text-gray-500">
              インターネット接続を確認してください
            </p>
          </div>
        )}

        {!offline && pageData?.imageUrl && !imageError && (
          <TransformWrapper
            key={currentPage}
            initialScale={1}
            minScale={0.5}
            maxScale={5}
            centerOnInit
            wheel={{ step: 0.1 }}
            panning={{ excluded: [] }}
          >
            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%' }}
              contentStyle={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pageData.imageUrl}
                alt={`ページ ${currentPage}`}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', userSelect: 'none' }}
                onError={() => setImageError(true)}
                draggable={false}
              />
            </TransformComponent>
          </TransformWrapper>
        )}

        {!offline && (!pageData?.imageUrl || imageError) && !pageLoading && (
          <div className="flex flex-col items-center gap-3 text-gray-500 px-4 text-center">
            <svg
              className="h-16 w-16 text-gray-600"
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
            <p className="text-sm">画像がありません</p>
          </div>
        )}

        {/* Task indicator on page */}
        {tasks.length > 0 && !showTaskPanel && (
          <button
            type="button"
            onClick={() => setShowTaskPanel(true)}
            className="absolute top-4 right-4 flex items-center gap-1.5 rounded-full bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg hover:bg-orange-600 transition-colors z-20"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
              />
            </svg>
            課題 {tasks.length}
          </button>
        )}
      </div>

      {/* Page slider bar */}
      <div className="shrink-0 z-30 bg-gray-900/95 backdrop-blur border-t border-gray-700">
        {/* Slider toggle & slider */}
        <div className="flex items-center gap-3 px-4 pt-2 pb-1">
          <span className="text-xs text-gray-500 shrink-0 w-6 text-right">1</span>
          <div className="relative flex-1">
            <input
              type="range"
              min={1}
              max={book.totalPages || 1}
              value={sliderValue}
              onChange={(e) => setSliderValue(Number(e.target.value))}
              onMouseUp={(e) => goToPage(Number((e.target as HTMLInputElement).value))}
              onTouchEnd={(e) => goToPage(Number((e.target as HTMLInputElement).value))}
              onKeyUp={(e) => goToPage(Number((e.target as HTMLInputElement).value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                bg-gray-600
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-5
                [&::-webkit-slider-thumb]:h-5
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-green-400
                [&::-webkit-slider-thumb]:shadow-md
                [&::-webkit-slider-thumb]:cursor-grab
                [&::-moz-range-thumb]:w-5
                [&::-moz-range-thumb]:h-5
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-green-400
                [&::-moz-range-thumb]:border-0"
              style={{
                background: `linear-gradient(to right, #4ade80 0%, #4ade80 ${
                  ((sliderValue - 1) / Math.max(book.totalPages - 1, 1)) * 100
                }%, #4b5563 ${
                  ((sliderValue - 1) / Math.max(book.totalPages - 1, 1)) * 100
                }%, #4b5563 100%)`,
              }}
              aria-label="ページスライダー"
            />
            {/* Page preview bubble */}
            {sliderValue !== currentPage && (
              <div
                className="pointer-events-none absolute -top-8 flex items-center justify-center"
                style={{
                  left: `calc(${
                    ((sliderValue - 1) / Math.max(book.totalPages - 1, 1)) * 100
                  }% )`,
                  transform: 'translateX(-50%)',
                }}
              >
                <span className="rounded-lg bg-green-500 px-2 py-0.5 text-xs font-bold text-white shadow-lg whitespace-nowrap">
                  {sliderValue}
                </span>
              </div>
            )}
          </div>
          <span className="text-xs text-gray-500 shrink-0 w-6">
            {book.totalPages}
          </span>
        </div>

      {/* Bottom toolbar */}
      <div className="flex items-center justify-between px-4 py-3 gap-2">
        {/* Prev button */}
        <button
          type="button"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          className="flex items-center gap-1.5 rounded-xl bg-gray-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-600 disabled:opacity-40 transition-colors"
          aria-label="前のページ"
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
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
        </button>

        {/* Center action buttons */}
        <div className="flex items-center gap-2">
          {/* Bookmark */}
          <button
            type="button"
            onClick={toggleBookmark}
            disabled={bookmarkLoading}
            className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
              bookmarked
                ? 'bg-yellow-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            aria-label={bookmarked ? 'しおりを削除' : 'しおりを追加'}
          >
            <svg
              className="h-5 w-5"
              fill={bookmarked ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
              />
            </svg>
            <span>{bookmarked ? 'しおり済' : 'しおり'}</span>
          </button>

          {/* Share */}
          <button
            type="button"
            onClick={handleShare}
            className="flex flex-col items-center gap-0.5 rounded-xl bg-gray-700 px-3 py-2 text-xs font-medium text-gray-300 hover:bg-gray-600 transition-colors"
            aria-label="URLを共有"
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
                d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
              />
            </svg>
            <span>共有</span>
          </button>

          {/* Memo */}
          <button
            type="button"
            onClick={() => setShowMemoPanel((prev) => !prev)}
            className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
              memoText
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            aria-label="メモ"
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
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
              />
            </svg>
            <span>メモ</span>
          </button>

          {/* Task button */}
          {tasks.length > 0 && (
            <button
              type="button"
              onClick={() => setShowTaskPanel((prev) => !prev)}
              className="flex flex-col items-center gap-0.5 rounded-xl bg-orange-500 px-3 py-2 text-xs font-medium text-white hover:bg-orange-600 transition-colors"
              aria-label="課題"
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
                  d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
                />
              </svg>
              <span>課題</span>
            </button>
          )}
        </div>

        {/* Next button */}
        <button
          type="button"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= book.totalPages}
          className="flex items-center gap-1.5 rounded-xl bg-gray-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-600 disabled:opacity-40 transition-colors"
          aria-label="次のページ"
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
              d="M8.25 4.5l7.5 7.5-7.5 7.5"
            />
          </svg>
        </button>
      </div>
      </div>{/* /sticky slider+toolbar wrapper */}

      {/* Memo panel (slide-up) */}
      {showMemoPanel && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setShowMemoPanel(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white shadow-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">
                メモ — {currentPage}ページ
              </h3>
              <button
                type="button"
                onClick={() => setShowMemoPanel(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors"
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
            <textarea
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
              rows={5}
              placeholder="このページのメモを入力..."
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
            <button
              type="button"
              onClick={handleSaveMemo}
              disabled={memoSaving}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {memoSaving ? '保存中...' : '保存する'}
            </button>
          </div>
        </>
      )}

      {/* Task panel */}
      {showTaskPanel && user && (
        <TaskPanel
          tasks={tasks}
          submissions={submissions}
          currentUserId={user.uid}
          bookId={bookId}
          memberName={userProfile?.name}
          bookTitle={book.title}
          isLeader={isLeader}
          onClose={() => setShowTaskPanel(false)}
          onSubmissionChange={() => loadPageData(currentPage)}
        />
      )}
    </div>
  );
}
