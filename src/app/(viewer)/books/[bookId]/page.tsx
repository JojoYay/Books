'use client';

import { useEffect, useState, useCallback, useRef, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getBook } from '@/lib/firestore/books';
import {
  isBookmarked,
  addBookmark,
  removeBookmark,
  getBookmarkId,
} from '@/lib/firestore/bookmarks';
import { Book, BookPage } from '@/types';
import BookTasksPanel from './BookTasksPanel';

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

  // Tasks panel (mobile drawer)
  const [showBookTasksPanel, setShowBookTasksPanel] = useState(false);

  // Bookmark
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [bookmarkModal, setBookmarkModal] = useState(false);
  const [bookmarkLabel, setBookmarkLabel] = useState('');
  const [bookmarkVisibility, setBookmarkVisibility] = useState<'private' | 'shared'>('private');

  // Share
  const [shareToast, setShareToast] = useState(false);

  // Zoom scale persistence across pages
  const [savedScale, setSavedScale] = useState(1);
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);

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

  // Load page image + tasks + bookmark whenever page changes
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

        // Bookmark status
        const bm = await isBookmarked(user.uid, bookId, pageNum);
        setBookmarked(bm);
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
    setShowBookTasksPanel(false);
    // Reset position but keep scale
    setTimeout(() => {
      if (transformRef.current) {
        transformRef.current.setTransform(0, 0, savedScale, 0);
      }
    }, 50);
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

  // Bookmark toggle — 削除はすぐ実行、追加はモーダルを開く
  async function toggleBookmark() {
    if (!user || bookmarkLoading) return;
    if (bookmarked) {
      setBookmarkLoading(true);
      try {
        const bmId = await getBookmarkId(user.uid, bookId, currentPage);
        if (bmId) await removeBookmark(user.uid, bmId);
        setBookmarked(false);
      } catch (err) {
        console.error('しおり削除エラー:', err);
      } finally {
        setBookmarkLoading(false);
      }
    } else {
      // モーダルを開く
      setBookmarkLabel('');
      setBookmarkVisibility('private');
      setBookmarkModal(true);
    }
  }

  async function handleBookmarkSave() {
    if (!user || bookmarkLoading) return;
    setBookmarkLoading(true);
    setBookmarkModal(false);
    try {
      await addBookmark(user.uid, userProfile?.name ?? '', {
        bookId,
        pageNumber: currentPage,
        label: bookmarkLabel.trim() || undefined,
        visibility: bookmarkVisibility,
      });
      setBookmarked(true);
    } catch (err) {
      console.error('しおり追加エラー:', err);
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

      {/* Main row: image area + persistent tasks panel (desktop) */}
      <div className="flex flex-1 min-h-0">
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
            initialScale={savedScale}
            minScale={0.5}
            maxScale={5}
            centerOnInit
            wheel={{ step: 0.1 }}
            panning={{ excluded: [] }}
            onTransformed={(_ref, state) => {
              setSavedScale(state.scale);
            }}
            ref={transformRef}
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

      </div>
      {/* Persistent tasks panel (desktop) */}
      {user && (
        <BookTasksPanel
          bookId={bookId}
          bookTitle={book.title}
          currentPage={currentPage}
          currentUserId={user.uid}
          memberName={userProfile?.name}
          isLeader={isLeader}
          onJumpToPage={(p) => goToPage(p)}
          className="hidden sm:flex sm:w-[340px] sm:shrink-0 sm:border-l sm:border-gray-200"
        />
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

          {/* Book-wide tasks list (mobile only) */}
          <button
            type="button"
            onClick={() => setShowBookTasksPanel(true)}
            className="flex sm:hidden flex-col items-center gap-0.5 rounded-xl bg-gray-700 px-3 py-2 text-xs font-medium text-gray-300 hover:bg-gray-600 transition-colors"
            aria-label="課題一覧"
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
                d="M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5"
              />
            </svg>
            <span>課題一覧</span>
          </button>

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

      {/* Bookmark modal */}
      {bookmarkModal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setBookmarkModal(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">
                しおりを追加 — {currentPage}ページ
              </h3>
              <button
                type="button"
                onClick={() => setBookmarkModal(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Label input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                名前（任意）
              </label>
              <input
                type="text"
                value={bookmarkLabel}
                onChange={(e) => setBookmarkLabel(e.target.value)}
                placeholder="例: 大切なページ、あとで確認"
                maxLength={40}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                autoFocus
              />
            </div>

            {/* Visibility */}
            <div>
              <p className="block text-sm font-medium text-gray-700 mb-2">公開範囲</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBookmarkVisibility('private')}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-sm font-medium transition-colors ${
                    bookmarkVisibility === 'private'
                      ? 'border-yellow-400 bg-yellow-50 text-yellow-700'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  自分だけ
                </button>
                <button
                  type="button"
                  onClick={() => setBookmarkVisibility('shared')}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-sm font-medium transition-colors ${
                    bookmarkVisibility === 'shared'
                      ? 'border-green-400 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                  みんなと共有
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleBookmarkSave}
              className="w-full rounded-xl bg-yellow-500 py-3 text-sm font-semibold text-white hover:bg-yellow-600 transition-colors"
            >
              しおりを追加
            </button>
          </div>
        </>
      )}

      {/* Mobile tasks drawer */}
      {showBookTasksPanel && user && (
        <>
          <div
            className="sm:hidden fixed inset-0 z-40 bg-black/40"
            onClick={() => setShowBookTasksPanel(false)}
            aria-hidden="true"
          />
          <div className="sm:hidden fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-hidden rounded-t-2xl shadow-xl">
            <BookTasksPanel
              bookId={bookId}
              bookTitle={book.title}
              currentPage={currentPage}
              currentUserId={user.uid}
              memberName={userProfile?.name}
              isLeader={isLeader}
              showCloseButton
              onClose={() => setShowBookTasksPanel(false)}
              onJumpToPage={(pageNum) => {
                setShowBookTasksPanel(false);
                goToPage(pageNum);
              }}
              className="max-h-[85vh]"
            />
          </div>
        </>
      )}
    </div>
  );
}
