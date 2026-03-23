import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Task } from '@/types';

function toTask(id: string, data: Record<string, unknown>): Task {
  return {
    id,
    bookId: (data.bookId as string) ?? '',
    pageNumber: (data.pageNumber as number) ?? 0,
    // 後方互換: 旧フィールド title/description からのフォールバック
    category: (data.category as string) ?? (data.title as string) ?? '',
    question: (data.question as string) ?? (data.description as string) ?? '',
    order: (data.order as number) ?? 0,
  };
}

export async function getTasksByBook(bookId: string): Promise<Task[]> {
  const tasksRef = collection(db, 'tasks');
  const q = query(
    tasksRef,
    where('bookId', '==', bookId),
    orderBy('pageNumber', 'asc'),
    orderBy('order', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => toTask(d.id, d.data() as Record<string, unknown>));
}

export async function getTask(taskId: string): Promise<Task | null> {
  const docRef = doc(db, 'tasks', taskId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return toTask(snap.id, snap.data() as Record<string, unknown>);
}

export async function createTask(data: Omit<Task, 'id'>): Promise<string> {
  const tasksRef = collection(db, 'tasks');
  const docRef = await addDoc(tasksRef, data);
  return docRef.id;
}

export async function updateTask(
  taskId: string,
  data: Partial<Task>
): Promise<void> {
  const docRef = doc(db, 'tasks', taskId);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...rest } = data as Partial<Task> & { id?: string };
  await updateDoc(docRef, rest as Record<string, unknown>);
}

export async function deleteTask(taskId: string): Promise<void> {
  const docRef = doc(db, 'tasks', taskId);
  await deleteDoc(docRef);
}

export async function getTasksByPage(
  bookId: string,
  pageNumber: number
): Promise<Task[]> {
  const tasksRef = collection(db, 'tasks');
  const q = query(
    tasksRef,
    where('bookId', '==', bookId),
    where('pageNumber', '==', pageNumber),
    orderBy('order', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => toTask(d.id, d.data() as Record<string, unknown>));
}
