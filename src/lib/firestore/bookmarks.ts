import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Bookmark } from '@/types';

function toBookmark(id: string, data: Record<string, unknown>): Bookmark {
  return {
    id,
    bookId: (data.bookId as string) ?? '',
    pageNumber: (data.pageNumber as number) ?? 1,
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate()
        : new Date(),
  };
}

export async function getBookmarks(
  userId: string,
  bookId?: string
): Promise<Bookmark[]> {
  const bookmarksRef = collection(db, 'bookmarks', userId, 'bookmarks');
  const q = bookId
    ? query(
        bookmarksRef,
        where('bookId', '==', bookId),
        orderBy('createdAt', 'desc')
      )
    : query(bookmarksRef, orderBy('createdAt', 'desc'));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) =>
    toBookmark(d.id, d.data() as Record<string, unknown>)
  );
}

export async function addBookmark(
  userId: string,
  data: Omit<Bookmark, 'id' | 'createdAt'>
): Promise<string> {
  const bookmarksRef = collection(db, 'bookmarks', userId, 'bookmarks');
  const docRef = await addDoc(bookmarksRef, {
    ...data,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function removeBookmark(
  userId: string,
  bookmarkId: string
): Promise<void> {
  const docRef = doc(db, 'bookmarks', userId, 'bookmarks', bookmarkId);
  await deleteDoc(docRef);
}

export async function isBookmarked(
  userId: string,
  bookId: string,
  pageNumber: number
): Promise<boolean> {
  const bookmarksRef = collection(db, 'bookmarks', userId, 'bookmarks');
  const q = query(
    bookmarksRef,
    where('bookId', '==', bookId),
    where('pageNumber', '==', pageNumber)
  );
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

export async function getBookmarkId(
  userId: string,
  bookId: string,
  pageNumber: number
): Promise<string | null> {
  const bookmarksRef = collection(db, 'bookmarks', userId, 'bookmarks');
  const q = query(
    bookmarksRef,
    where('bookId', '==', bookId),
    where('pageNumber', '==', pageNumber)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return snapshot.docs[0].id;
}
