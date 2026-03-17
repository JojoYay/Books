import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { BookPage } from '@/types';

export async function getPages(bookId: string): Promise<BookPage[]> {
  const pagesRef = collection(db, 'books', bookId, 'pages');
  const q = query(pagesRef, orderBy('pageNumber', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      pageNumber: data.pageNumber as number,
      imageUrl: data.imageUrl as string,
    };
  });
}

export async function savePage(
  bookId: string,
  pageNumber: number,
  imageUrl: string
): Promise<void> {
  const pageRef = doc(db, 'books', bookId, 'pages', String(pageNumber));
  await setDoc(pageRef, { pageNumber, imageUrl });
}

export async function deleteAllPages(bookId: string): Promise<void> {
  const pagesRef = collection(db, 'books', bookId, 'pages');
  const snapshot = await getDocs(pagesRef);
  await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)));
}
