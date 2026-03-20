'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getBook } from '@/lib/firestore/books';
import { getPages } from '@/lib/firestore/pages';
import {
  getTasksByBook,
  createTask,
  updateTask,
  deleteTask,
} from '@/lib/firestore/tasks';
import { Book, BookPage, Task } from '@/types';
import { LinkifiedText } from '@/components/LinkifiedText';
import Image from 'next/image';

interface TaskFormData {
  pageNumber: number;
  title: string;
  description: string;
  order: number;
}

const emptyTaskForm: TaskFormData = {
  pageNumber: 1,
  title: '',
  description: '',
  order: 0,
};

export default function BookTasksPage() {
  const { user, isLeader, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const bookId = params.bookId as string;

  const [book, setBook] = useState<Book | null>(null);
  const [pages, setPages] = useState<BookPage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Preview page
  const [previewPage, setPreviewPage] = useState(1);

  // Add/edit form
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskFormData>(emptyTaskForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (!isLeader) {
        router.replace('/');
      }
    }
  }, [loading, user, isLeader, router]);

  const fetchData = useCallback(async () => {
    try {
      setFetching(true);
      const [fetchedBook, fetchedPages, fetchedTasks] = await Promise.all([
        getBook(bookId),
        getPages(bookId),
        getTasksByBook(bookId),
      ]);
      if (!fetchedBook) {
        setError('本が見つかりませんでした。');
        return;
      }
      setBook(fetchedBook);
      setPages(fetchedPages);
      setTasks(fetchedTasks);
    } catch (err) {
      console.error(err);
      setError('データの読み込みに失敗しました。');
    } finally {
      setFetching(false);
    }
  }, [bookId]);

  useEffect(() => {
    if (user && isLeader && bookId) {
      fetchData();
    }
  }, [user, isLeader, bookId, fetchData]);

  // Get current preview image URL
  const currentPageData = pages.find((p) => p.pageNumber === previewPage);
  const totalPages = book?.totalPages ?? pages.length;

  // Tasks for the currently previewed page
  const tasksOnCurrentPage = tasks.filter((t) => t.pageNumber === previewPage);

  const openAddForm = () => {
    setEditingTask(null);
    const nextOrder = tasks.length > 0 ? Math.max(...tasks.map((t) => t.order)) + 1 : 0;
    setForm({ ...emptyTaskForm, pageNumber: previewPage, order: nextOrder });
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (task: Task) => {
    setEditingTask(task);
    setForm({
      pageNumber: task.pageNumber,
      title: task.title,
      description: task.description,
      order: task.order,
    });
    setPreviewPage(task.pageNumber);
    setFormError(null);
    setShowForm(true);
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
      if (editingTask) {
        await updateTask(editingTask.id, { ...form });
      } else {
        await createTask({ ...form, bookId });
      }
      setShowForm(false);
      await fetchData();
    } catch (err) {
      console.error(err);
      setFormError('保存に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('この課題を削除しますか？この操作は取り消せません。')) return;
    try {
      setDeletingId(taskId);
      await deleteTask(taskId);
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('削除に失敗しました。');
    } finally {
      setDeletingId(null);
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            本の管理に戻る
          </button>
          <h1 className="text-2xl font-bold text-gray-900">課題管理</h1>
          {book && (
            <p className="mt-1 text-sm text-gray-500">
              {book.title} の課題一覧
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={openAddForm}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          課題を追加
        </button>
      </div>

      {/* Two-column layout: Preview + Tasks */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Page Preview */}
        <div className="space-y-3">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {/* Page navigation */}
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
              <button
                type="button"
                onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                disabled={previewPage <= 1}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={previewPage}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (v >= 1 && v <= totalPages) setPreviewPage(v);
                  }}
                  className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-center text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
                <span className="text-sm text-gray-500">/ {totalPages}</span>
              </div>

              <button
                type="button"
                onClick={() => setPreviewPage((p) => Math.min(totalPages, p + 1))}
                disabled={previewPage >= totalPages}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Page image */}
            <div className="relative bg-gray-50" style={{ minHeight: 400 }}>
              {currentPageData ? (
                <Image
                  src={currentPageData.imageUrl}
                  alt={`ページ ${previewPage}`}
                  width={800}
                  height={1100}
                  className="w-full h-auto"
                  priority
                />
              ) : (
                <div className="flex items-center justify-center py-32 text-gray-400 text-sm">
                  ページが見つかりません
                </div>
              )}

              {/* Badge: tasks on this page */}
              {tasksOnCurrentPage.length > 0 && (
                <div className="absolute top-2 right-2 rounded-full bg-green-600 px-2.5 py-0.5 text-xs font-medium text-white shadow">
                  課題 {tasksOnCurrentPage.length}件
                </div>
              )}
            </div>
          </div>

          {/* Tasks on current page (quick view) */}
          {tasksOnCurrentPage.length > 0 && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-3">
              <p className="mb-2 text-xs font-semibold text-green-700">
                このページの課題（{tasksOnCurrentPage.length}件）
              </p>
              <ul className="space-y-1">
                {tasksOnCurrentPage.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5 text-sm"
                  >
                    <span className="text-gray-800">{t.title}</span>
                    <button
                      type="button"
                      onClick={() => openEditForm(t)}
                      className="text-xs text-green-600 hover:text-green-800"
                    >
                      編集
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right: Task form + full task list */}
        <div className="space-y-4">
          {/* Inline add/edit form */}
          {showForm && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-5">
              <h2 className="mb-4 text-sm font-semibold text-green-800">
                {editingTask ? '課題を編集' : '新しい課題を追加'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      ページ番号 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      required
                      value={form.pageNumber}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setForm({ ...form, pageNumber: v });
                        if (v >= 1 && v <= totalPages) setPreviewPage(v);
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      表示順
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.order}
                      onChange={(e) =>
                        setForm({ ...form, order: Number(e.target.value) })
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    タイトル <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                    placeholder="課題のタイトルを入力"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    説明
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
                    placeholder="課題の説明を入力（任意）"
                  />
                </div>

                {formError && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                    {formError}
                  </p>
                )}

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
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
          )}

          {/* Full task list */}
          <div>
            <h2 className="mb-2 text-sm font-semibold text-gray-700">
              全課題一覧（{tasks.length}件）
            </h2>
            {tasks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
                <p className="text-gray-500">
                  課題がありません。「課題を追加」から追加してください。
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <ul className="divide-y divide-gray-100">
                  {tasks.map((task) => (
                    <li
                      key={task.id}
                      className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                        task.pageNumber === previewPage
                          ? 'bg-green-50 border-l-4 border-l-green-500'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setPreviewPage(task.pageNumber)}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-[10px] font-semibold text-green-700">
                          {task.pageNumber}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{task.title}</p>
                        {task.description && (
                          <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">
                            <LinkifiedText text={task.description} />
                          </p>
                        )}
                      </div>

                      <div className="flex flex-shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditForm(task);
                          }}
                          className="rounded-lg border border-gray-200 px-2 py-1 text-[10px] text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(task.id);
                          }}
                          disabled={deletingId === task.id}
                          className="rounded-lg border border-red-100 px-2 py-1 text-[10px] text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {deletingId === task.id ? '...' : '削除'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
