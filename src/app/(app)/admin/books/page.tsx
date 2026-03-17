'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getBooks, updateBook } from '@/lib/firestore/books';
import { getAllMembers } from '@/lib/firestore/users';
import { Book, UserProfile } from '@/types';
import BookFormModal from './BookFormModal';

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

  // 隊員割り当てモーダル
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningBook, setAssigningBook] = useState<Book | null>(null);
  const [assignSelected, setAssignSelected] = useState<Set<string>>(new Set());
  const [assignSubmitting, setAssignSubmitting] = useState(false);

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
                {book.description && (
                  <p className="mt-2 text-xs text-gray-500 line-clamp-2">{book.description}</p>
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
    </div>
  );
}
