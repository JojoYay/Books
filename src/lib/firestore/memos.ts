import {
  collection,
  doc,
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
import { Memo } from '@/types';

function toMemo(id: string, data: Record<string, unknown>): Memo {
  return {
    id,
    bookId: (data.bookId as string) ?? '',
    pageNumber: (data.pageNumber as number) ?? 1,
    text: (data.text as string) ?? '',
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate()
        : new Date(),
    updatedAt:
      data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate()
        : new Date(),
  };
}

export async function getMemos(
  userId: string,
  bookId?: string
): Promise<Memo[]> {
  const memosRef = collection(db, 'memos', userId, 'memos');
  const q = bookId
    ? query(
        memosRef,
        where('bookId', '==', bookId),
        orderBy('updatedAt', 'desc')
      )
    : query(memosRef, orderBy('updatedAt', 'desc'));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) =>
    toMemo(d.id, d.data() as Record<string, unknown>)
  );
}

export async function getMemo(
  userId: string,
  bookId: string,
  pageNumber: number
): Promise<Memo | null> {
  const memosRef = collection(db, 'memos', userId, 'memos');
  const q = query(
    memosRef,
    where('bookId', '==', bookId),
    where('pageNumber', '==', pageNumber)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return toMemo(d.id, d.data() as Record<string, unknown>);
}

export async function saveMemo(
  userId: string,
  data: Omit<Memo, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const memosRef = collection(db, 'memos', userId, 'memos');

  // Check if a memo already exists for this book + page
  const q = query(
    memosRef,
    where('bookId', '==', data.bookId),
    where('pageNumber', '==', data.pageNumber)
  );
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const existing = snapshot.docs[0];
    await updateDoc(doc(db, 'memos', userId, 'memos', existing.id), {
      text: data.text,
      updatedAt: Timestamp.now(),
    });
    return existing.id;
  }

  const newDoc = await addDoc(memosRef, {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return newDoc.id;
}

export async function deleteMemo(
  userId: string,
  memoId: string
): Promise<void> {
  const docRef = doc(db, 'memos', userId, 'memos', memoId);
  await deleteDoc(docRef);
}
