'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getBooks, updateBook, deleteBook } from '@/lib/firestore/books';
import { getAllMembers } from '@/lib/firestore/users';
import { Book, UserProfile } from '@/types';
import BookFormModal from './BookFormModal';
import { LinkifiedText } from '@/components/LinkifiedText';

export default function AdminBooksPage() {
  const { user, isLeader, loading } = useAuth();
  const router = useRouter();

  const [books, setBooks] = useState<Book[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 本追加・編集モーダル
  const [showBookModal, setShowBookModal] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);

  // 削除確認
  const [deletingBook, setDeletingBook] = useState<Book | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // 隊員割り当てモーダル
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningBook, setAssigningBook] = useState<Book | null>(null);
  const [assignSelected, setAssignSelected] = useState<Set<string>>(new Set());
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  // インライン表示順編集
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingOrderValue, setEditingOrderValue] = useState('');
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);

  async function handleSaveOrder(bookId: string) {
    setSavingOrderId(bookId);
    try {
      const val = editingOrderValue.trim();
      const order = val === '' ? undefined : Number(val);
      await updateBook(bookId, { order });
      setBooks((prev) =>
        prev.map((b) => (b.id === bookId ? { ...b, order } : b))
      );
      setEditingOrderId(null);
      // Re-sort after order change
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('保存に失敗しました。');
    } finally {
      setSavingOrderId(null);
    }
  }

  useEffect(() => {
    if (!loading) {
      if (!user) router.replace('/login');
      else if (!isLeader) router.replace('/');
    }
  }, [loading, user, isLeader, router]);

  async function fetchData() {
    if (!user) return;
    try {
      setFetching(true);
      const [fetchedBooks, fetchedMembers] = await Promise.all([
        getBooks(user.uid, true),
        getAllMembers(),
      ]);
      setBooks(fetchedBooks);
      setMembers(fetchedMembers);
    } catch (err) {
      console.error(err);
      setError('データの読み込みに失敗しました。');
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    if (user && isLeader) fetchData();
  }, [user, isLeader]);

  const openCreateModal = () => {
    setEditingBook(null);
    setShowBookModal(true);
  };

  const openEditModal = (book: Book) => {
    setEditingBook(book);
    setShowBookModal(true);
  };

  const openAssignModal = (book: Book) => {
    setAssigningBook(book);
    setAssignSelected(new Set(book.assignedMembers));
    setShowAssignModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingBook) return;
    try {
      setDeleteSubmitting(true);
      await deleteBook(deletingBook.id);
      setDeletingBook(null);
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('削除に失敗しました。');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleAssignSave = async () => {
    if (!assigningBook) return;
    try {
      setAssignSubmitting(true);
      await updateBook(assigningBook.id, {
        assignedMembers: Array.from(assignSelected),
      });
      setShowAssignModal(false);
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('割り当ての更新に失敗しました。');
    } finally {
      setAssignSubmitting(false);
    }
  };

  if (loading || fetching) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return <div className="rounded-lg bg-red-50 p-6 text-center text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">本の管理</h1>
          <p className="mt-1 text-sm text-gray-500">本の追加・編集・課題管理を行います。</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          新規本を追加
        </button>
      </div>

      {/* Book list */}
      {books.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-gray-500">本がありません。「新規本を追加」から追加してください。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <div key={book.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              {/* Cover */}
              <div className="relative h-36 bg-gray-100 flex items-center justify-center">
                {book.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={book.coverImageUrl} alt={book.title} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-4xl">📖</span>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <h2 className="font-semibold text-gray-900 truncate">{book.title}</h2>
                <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                  <span>{book.totalPages} ページ</span>
                  <span>隊員 {book.assignedMembers.length} 人</span>
                </div>
                {/* 表示順 — inline edit */}
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-400">表示順:</span>
                  {editingOrderId === book.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        value={editingOrderValue}
                        onChange={(e) => setEditingOrderValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveOrder(book.id);
                          if (e.key === 'Escape') setEditingOrderId(null);
                        }}
                        autoFocus
                        className="w-14 rounded border border-green-400 px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-green-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveOrder(book.id)}
                        disabled={savingOrderId === book.id}
                        className="rounded bg-green-600 px-1.5 py-0.5 text-[10px] text-white hover:bg-green-700 disabled:opacity-60"
                      >
                        {savingOrderId === book.id ? '...' : '保存'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingOrderId(null)}
                        className="text-[10px] text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingOrderId(book.id);
                        setEditingOrderValue(book.order != null ? String(book.order) : '');
                      }}
                      className="flex items-center gap-0.5 text-[10px] text-gray-500 hover:text-green-700 transition-colors"
                    >
                      <span>{book.order != null ? book.order : '未設定'}</span>
                      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                  )}
                </div>
                {book.description && (
                  <p className="mt-2 text-xs text-gray-500 line-clamp-2 break-words">
                    <LinkifiedText text={book.description} />
                  </p>
                )}

                {/* Actions */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(book)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    編集・PDF差替
                  </button>
                  <Link
                    href={`/admin/books/${book.id}/tasks`}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    課題管理
                  </Link>
                  <button
                    type="button"
                    onClick={() => openAssignModal(book)}
                    className="rounded-lg border border-green-200 px-3 py-1.5 text-xs text-green-700 hover:bg-green-50 transition-colors"
                  >
                    隊員割り当て
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingBook(book)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 本追加・編集モーダル（PDFアップロード付き） */}
      {showBookModal && (
        <BookFormModal
          book={editingBook ?? undefined}
          onClose={() => setShowBookModal(false)}
          onSaved={() => {
            setShowBookModal(false);
            fetchData();
          }}
        />
      )}

      {/* 隊員割り当てモーダル */}
      {showAssignModal && assigningBook && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAssignModal(false); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-bold text-gray-900">隊員割り当て</h2>
            <p className="mb-4 text-sm text-gray-500">
              「{assigningBook.title}」に割り当てる隊員を選択してください。
            </p>

            {members.length === 0 ? (
              <p className="text-sm text-gray-500">隊員がいません。</p>
            ) : (
              <ul className="space-y-2 max-h-60 overflow-y-auto">
                {members.map((m) => (
                  <li key={m.id}>
                    <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={assignSelected.has(m.id)}
                        onChange={(e) => {
                          const next = new Set(assignSelected);
                          e.target.checked ? next.add(m.id) : next.delete(m.id);
                          setAssignSelected(next);
                        }}
                        className="rounded text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-800">{m.name}</span>
                      <span className="ml-auto text-xs text-gray-400">{m.email}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleAssignSave}
                disabled={assignSubmitting}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-60"
              >
                {assignSubmitting ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認ダイアログ */}
      {deletingBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900">本を削除しますか？</h2>
            </div>
            <p className="mb-1 text-sm text-gray-600">
              「<span className="font-medium">{deletingBook.title}</span>」を削除します。
            </p>
            <p className="mb-6 text-xs text-red-500">
              ※ ページ画像・課題・提出データはStorageやFirestoreに残ります。完全削除は手動で行ってください。
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingBook(null)}
                disabled={deleteSubmitting}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteSubmitting}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {deleteSubmitting ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
