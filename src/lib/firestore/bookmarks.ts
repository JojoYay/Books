import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
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
    label: (data.label as string) || undefined,
    visibility: (data.visibility as 'private' | 'shared') ?? 'private',
    userId: (data.userId as string) || undefined,
    userName: (data.userName as string) || undefined,
  };
}

// ── 自分のしおり（private/shared 両方）────────────────────────────

export async function getBookmarks(
  userId: string,
  bookId?: string
): Promise<Bookmark[]> {
  const bookmarksRef = collection(db, 'bookmarks', userId, 'bookmarks');
  const q = bookId
    ? query(bookmarksRef, where('bookId', '==', bookId), orderBy('createdAt', 'desc'))
    : query(bookmarksRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => toBookmark(d.id, d.data() as Record<string, unknown>));
}

export async function addBookmark(
  userId: string,
  userName: string,
  data: Omit<Bookmark, 'id' | 'createdAt' | 'userId' | 'userName'>
): Promise<string> {
  const bookmarksRef = collection(db, 'bookmarks', userId, 'bookmarks');
  const docRef = await addDoc(bookmarksRef, {
    ...data,
    userId,
    userName,
    createdAt: Timestamp.now(),
  });

  // 共有の場合は sharedBookmarks にも保存
  if (data.visibility === 'shared') {
    const sharedRef = collection(db, 'sharedBookmarks');
    await addDoc(sharedRef, {
      ...data,
      userId,
      userName,
      privateDocId: docRef.id,
      createdAt: Timestamp.now(),
    });
  }

  return docRef.id;
}

export async function removeBookmark(
  userId: string,
  bookmarkId: string
): Promise<void> {
  const docRef = doc(db, 'bookmarks', userId, 'bookmarks', bookmarkId);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const data = snap.data() as Record<string, unknown>;
    // 共有しおりなら sharedBookmarks からも削除
    if (data.visibility === 'shared') {
      const sharedRef = collection(db, 'sharedBookmarks');
      const q = query(sharedRef, where('privateDocId', '==', bookmarkId));
      const sharedSnap = await getDocs(q);
      await Promise.all(sharedSnap.docs.map((d) => deleteDoc(d.ref)));
    }
  }
  await deleteDoc(docRef);
}

export async function updateBookmarkLabel(
  userId: string,
  bookmarkId: string,
  label: string
): Promise<void> {
  const docRef = doc(db, 'bookmarks', userId, 'bookmarks', bookmarkId);
  await updateDoc(docRef, { label });
  // sharedBookmarks にも反映
  const sharedRef = collection(db, 'sharedBookmarks');
  const q = query(sharedRef, where('privateDocId', '==', bookmarkId));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { label })));
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

// ── 共有しおり（全ユーザーで共有）────────────────────────────────

export async function getSharedBookmarks(bookId?: string): Promise<Bookmark[]> {
  const sharedRef = collection(db, 'sharedBookmarks');
  const q = bookId
    ? query(sharedRef, where('bookId', '==', bookId), orderBy('createdAt', 'desc'))
    : query(sharedRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => toBookmark(d.id, d.data() as Record<string, unknown>));
}
