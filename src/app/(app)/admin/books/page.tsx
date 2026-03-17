'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getBooks, createBook, updateBook } from '@/lib/firestore/books';
import { getAllMembers } from '@/lib/firestore/users';
import { Book, UserProfile } from '@/types';

interface BookFormData {
  title: string;
  description: string;
  coverImageUrl: string;
  totalPages: number;
  assignedMembers: string[];
}

const emptyForm: BookFormData = {
  title: '',
  description: '',
  coverImageUrl: '',
  totalPages: 0,
  assignedMembers: [],
};

export default function AdminBooksPage() {
  const { user, isLeader, loading } = useAuth();
  const router = useRouter();

  const [books, setBooks] = useState<Book[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [form, setForm] = useState<BookFormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Assign modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningBook, setAssigningBook] = useState<Book | null>(null);
  const [assignSelected, setAssignSelected] = useState<Set<string>>(new Set());
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (!isLeader) {
        router.replace('/');
      }
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
    if (user && isLeader) {
      fetchData();
    }
  }, [user, isLeader]);

  const openCreateModal = () => {
    setEditingBook(null);
    setForm(emptyForm);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (book: Book) => {
    setEditingBook(book);
    setForm({
      title: book.title,
      description: book.description,
      coverImageUrl: book.coverImageUrl,
      totalPages: book.totalPages,
      assignedMembers: [...book.assignedMembers],
    });
    setFormError(null);
    setShowModal(true);
  };

  const openAssignModal = (book: Book) => {
    setAssigningBook(book);
    setAssignSelected(new Set(book.assignedMembers));
    setShowAssignModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.title.trim()) {
      setFormError('タイトルを入力してください。');
      return;
    }

    try {
      setSubmitting(true);
      if (editingBook) {
        await updateBook(editingBook.id, form);
      } else {
        await createBook(form);
      }
      setShowModal(false);
      await fetchData();
    } catch (err) {
      console.error(err);
      setFormError('保存に失敗しました。');
    } finally {
      setSubmitting(false);
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
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center text-red-700">{error}</div>
    );
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
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
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
            <div
              key={book.id}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              {/* Cover */}
              <div className="relative h-36 bg-gray-100 flex items-center justify-center">
                {book.coverImageUrl ? (
                  <img
                    src={book.coverImageUrl}
                    alt={book.title}
                    className="h-full w-full object-cover"
                  />
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
                  <p className="mt-2 text-xs text-gray-500 line-clamp-2">
                    {book.description}
                  </p>
                )}

                {/* Actions */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(book)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    編集
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

      {/* Book form modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="mb-4 text-lg font-bold text-gray-900">
              {editingBook ? '本を編集' : '新規本を追加'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  タイトル <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  説明
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  表紙画像URL
                </label>
                <input
                  type="url"
                  value={form.coverImageUrl}
                  onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  総ページ数
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.totalPages}
                  onChange={(e) =>
                    setForm({ ...form, totalPages: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>

              {formError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-60"
                >
                  {submitting ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign members modal */}
      {showAssignModal && assigningBook && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAssignModal(false);
          }}
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
                          if (e.target.checked) {
                            next.add(m.id);
                          } else {
                            next.delete(m.id);
                          }
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
