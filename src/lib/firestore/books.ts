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
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Book } from '@/types';

function toBook(id: string, data: Record<string, unknown>): Book {
  return {
    id,
    title: (data.title as string) ?? '',
    description: (data.description as string) ?? '',
    coverImageUrl: (data.coverImageUrl as string) ?? '',
    totalPages: (data.totalPages as number) ?? 0,
    assignedMembers: (data.assignedMembers as string[]) ?? [],
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate()
        : new Date(),
    order: (data.order as number | undefined) ?? undefined,
  };
}

export async function getBooks(
  userId: string,
  isLeader: boolean
): Promise<Book[]> {
  const booksRef = collection(db, 'books');
  const q = isLeader
    ? query(booksRef)
    : query(
        booksRef,
        where('assignedMembers', 'array-contains', userId)
      );

  const snapshot = await getDocs(q);
  const books = snapshot.docs.map((d) => toBook(d.id, d.data() as Record<string, unknown>));
  // order 昇順（未設定は末尾）、同順は作成日降順
  books.sort((a, b) => {
    const oa = a.order ?? Number.MAX_SAFE_INTEGER;
    const ob = b.order ?? Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  return books;
}

export async function getBook(bookId: string): Promise<Book | null> {
  const docRef = doc(db, 'books', bookId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return toBook(snap.id, snap.data() as Record<string, unknown>);
}

export async function createBook(
  data: Omit<Book, 'id' | 'createdAt'>
): Promise<string> {
  const booksRef = collection(db, 'books');
  const docRef = await addDoc(booksRef, {
    ...data,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updateBook(
  bookId: string,
  data: Partial<Book>
): Promise<void> {
  const docRef = doc(db, 'books', bookId);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, createdAt, ...rest } = data as Partial<Book> & { id?: string; createdAt?: Date };
  await updateDoc(docRef, rest as Record<string, unknown>);
}

export async function deleteBook(bookId: string): Promise<void> {
  const docRef = doc(db, 'books', bookId);
  await deleteDoc(docRef);
}
