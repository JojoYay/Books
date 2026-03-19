'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
  getBookmarks,
  removeBookmark,
  updateBookmarkLabel,
  getSharedBookmarks,
} from '@/lib/firestore/bookmarks';
import { getBook } from '@/lib/firestore/books';
import { Bookmark, Book } from '@/types';

interface BookmarkWithBook extends Bookmark {
  bookTitle: string;
}

type GroupedBookmarks = Record<string, BookmarkWithBook[]>;
type Tab = 'mine' | 'shared';

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export default function BookmarksPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('mine');
  const [myGrouped, setMyGrouped] = useState<GroupedBookmarks>({});
  const [sharedGrouped, setSharedGrouped] = useState<GroupedBookmarks>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelValue, setEditingLabelValue] = useState('');
  const [savingLabelId, setSavingLabelId] = useState<string | null>(null);

  async function handleShare(bm: BookmarkWithBook) {
    const url = `${window.location.origin}/books/${bm.bookId}?page=${bm.pageNumber}`;
    if (navigator.share) {
      try { await navigator.share({ title: `${bm.bookTitle} ${bm.pageNumber}ページ`, url }); }
      catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      setCopiedId(bm.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  async function buildGrouped(bookmarks: Bookmark[]): Promise<GroupedBookmarks> {
    const bookCache = new Map<string, Book | null>();
    await Promise.all(
      bookmarks.map(async (bm) => {
        if (!bookCache.has(bm.bookId)) {
          try { bookCache.set(bm.bookId, await getBook(bm.bookId)); }
          catch { bookCache.set(bm.bookId, null); }
        }
      })
    );
    const enriched: BookmarkWithBook[] = bookmarks.map((bm) => ({
      ...bm,
      bookTitle: bookCache.get(bm.bookId)?.title ?? bm.bookId,
    }));
    const groups: GroupedBookmarks = {};
    for (const bm of enriched) {
      if (!groups[bm.bookId]) groups[bm.bookId] = [];
      groups[bm.bookId].push(bm);
    }
    return groups;
  }

  const loadBookmarks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [mine, shared] = await Promise.all([
        getBookmarks(user.uid),
        getSharedBookmarks(),
      ]);
      const [myG, sharedG] = await Promise.all([
        buildGrouped(mine),
        buildGrouped(shared),
      ]);
      setMyGrouped(myG);
      setSharedGrouped(sharedG);
    } catch (err) {
      console.error('しおりの取得に失敗:', err);
      setError('しおりを取得できませんでした。');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadBookmarks(); }, [loadBookmarks]);

  async function handleDelete(bookmarkId: string) {
    if (!user || deletingId) return;
    setDeletingId(bookmarkId);
    try {
      await removeBookmark(user.uid, bookmarkId);
      await loadBookmarks();
    } catch (err) {
      console.error('削除エラー:', err);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSaveLabel(bm: BookmarkWithBook) {
    if (!user) return;
    setSavingLabelId(bm.id);
    try {
      await updateBookmarkLabel(user.uid, bm.id, editingLabelValue.trim());
      setEditingLabelId(null);
      await loadBookmarks();
    } catch (err) {
      console.error('ラベル保存エラー:', err);
    } finally {
      setSavingLabelId(null);
    }
  }

  const myTotal = Object.values(myGrouped).reduce((s, a) => s + a.length, 0);
  const sharedTotal = Object.values(sharedGrouped).reduce((s, a) => s + a.length, 0);
  const grouped = activeTab === 'mine' ? myGrouped : sharedGrouped;
  const total = activeTab === 'mine' ? myTotal : sharedTotal;
  const isOwn = activeTab === 'mine';

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">しおり</h1>
        <p className="mt-1 text-sm text-gray-500">ページに付けたしおりの一覧です</p>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('mine')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
            activeTab === 'mine' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          🔒 自分のしおり
          {myTotal > 0 && (
            <span className="ml-1.5 rounded-full bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-700">
              {myTotal}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('shared')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
            activeTab === 'shared' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          👥 共有しおり
          {sharedTotal > 0 && (
            <span className="ml-1.5 rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
              {sharedTotal}
            </span>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-white shadow-sm p-4 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-1/3 mb-3" />
              <div className="space-y-2">
                <div className="h-14 bg-gray-100 rounded-xl" />
                <div className="h-14 bg-gray-100 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && total === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
            <svg className="h-8 w-8 text-yellow-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700">しおりがありません</h3>
          <p className="mt-2 text-sm text-gray-500">
            {activeTab === 'mine'
              ? '本を読みながらしおりを付けるとここに表示されます。'
              : 'まだ共有されたしおりはありません。'}
          </p>
          {activeTab === 'mine' && (
            <Link href="/" className="mt-4 text-sm font-medium text-green-600 hover:underline">本一覧へ</Link>
          )}
        </div>
      )}

      {!loading && total > 0 && (
        <div className="space-y-6">
          {Object.entries(grouped).map(([bookId, bookmarks]) => (
            <div key={bookId} className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 truncate">{bookmarks[0].bookTitle}</h2>
                <span className="flex-shrink-0 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
                  {bookmarks.length}件
                </span>
              </div>

              <ul className="divide-y divide-gray-100">
                {bookmarks.map((bm) => {
                  const isEditingLabel = editingLabelId === bm.id;
                  return (
                    <li key={bm.id} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <Link href={`/books/${bm.bookId}?page=${bm.pageNumber}`} className="flex-shrink-0 mt-1">
                          <svg className="h-4 w-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                            <path fillRule="evenodd" d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 18.089l-7.165 3.583A.75.75 0 013.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z" clipRule="evenodd" />
                          </svg>
                        </Link>

                        <div className="flex-1 min-w-0">
                          {isEditingLabel ? (
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <input
                                type="text"
                                value={editingLabelValue}
                                onChange={(e) => setEditingLabelValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveLabel(bm);
                                  if (e.key === 'Escape') setEditingLabelId(null);
                                }}
                                autoFocus
                                maxLength={40}
                                placeholder="しおりの名前"
                                className="w-36 rounded-lg border border-yellow-400 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveLabel(bm)}
                                disabled={savingLabelId === bm.id}
                                className="rounded-lg bg-yellow-500 px-2 py-1 text-xs text-white hover:bg-yellow-600 disabled:opacity-60"
                              >
                                {savingLabelId === bm.id ? '保存中' : '保存'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingLabelId(null)}
                                className="text-xs text-gray-400 hover:text-gray-600"
                              >
                                キャンセル
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 mb-0.5">
                              {bm.label ? (
                                <span className="text-sm font-medium text-gray-900">{bm.label}</span>
                              ) : (
                                <span className="text-sm text-gray-600">{bm.pageNumber}ページ</span>
                              )}
                              {isOwn && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingLabelId(bm.id);
                                    setEditingLabelValue(bm.label ?? '');
                                  }}
                                  className="ml-1 text-gray-300 hover:text-yellow-500 transition-colors"
                                  aria-label="名前を編集"
                                >
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                            {bm.label && <span>{bm.pageNumber}ページ</span>}
                            {!isOwn && bm.userName && <span className="text-gray-500">👤 {bm.userName}</span>}
                            {bm.visibility === 'shared' && isOwn && (
                              <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-green-600">共有</span>
                            )}
                            <span>{formatDate(bm.createdAt)}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleShare(bm)}
                          className="flex-shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-green-50 hover:text-green-600 transition-colors"
                          title={copiedId === bm.id ? 'コピーしました！' : 'URLを共有'}
                        >
                          {copiedId === bm.id ? (
                            <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          ) : (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                            </svg>
                          )}
                        </button>

                        {isOwn && (
                          <button
                            type="button"
                            onClick={() => handleDelete(bm.id)}
                            disabled={deletingId === bm.id}
                            className="flex-shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
                            aria-label="削除"
                          >
                            {deletingId === bm.id ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-red-500" />
                            ) : (
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
