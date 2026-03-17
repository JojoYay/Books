import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { TaskSubmission, TaskStatus } from '@/types';
import { getTasksByBook } from './tasks';

function toSubmission(
  id: string,
  data: Record<string, unknown>
): TaskSubmission {
  return {
    id,
    taskId: (data.taskId as string) ?? '',
    bookId: (data.bookId as string) ?? '',
    memberId: (data.memberId as string) ?? '',
    photos: (data.photos as string[]) ?? [],
    files: (data.files as string[]) ?? [],
    comment: (data.comment as string) ?? '',
    status: (data.status as TaskStatus) ?? 'not_started',
    submittedAt:
      data.submittedAt instanceof Timestamp
        ? data.submittedAt.toDate()
        : null,
    completedAt:
      data.completedAt instanceof Timestamp
        ? data.completedAt.toDate()
        : null,
    completedBy: (data.completedBy as string | null) ?? null,
    leaderFeedback: (data.leaderFeedback as string | null) ?? null,
  };
}

export async function getSubmission(
  taskId: string,
  memberId: string
): Promise<TaskSubmission | null> {
  const submissionsRef = collection(db, 'taskSubmissions');
  const q = query(
    submissionsRef,
    where('taskId', '==', taskId),
    where('memberId', '==', memberId)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return toSubmission(d.id, d.data() as Record<string, unknown>);
}

export async function getSubmissionsByBook(
  bookId: string,
  memberId: string
): Promise<TaskSubmission[]> {
  const submissionsRef = collection(db, 'taskSubmissions');
  const q = query(
    submissionsRef,
    where('bookId', '==', bookId),
    where('memberId', '==', memberId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) =>
    toSubmission(d.id, d.data() as Record<string, unknown>)
  );
}

export async function createOrUpdateSubmission(
  data: Omit<TaskSubmission, 'id'>
): Promise<string> {
  const submissionsRef = collection(db, 'taskSubmissions');

  // Check if a submission already exists for this task + member
  const q = query(
    submissionsRef,
    where('taskId', '==', data.taskId),
    where('memberId', '==', data.memberId)
  );
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const existing = snapshot.docs[0];
    await updateDoc(doc(db, 'taskSubmissions', existing.id), {
      ...data,
      submittedAt: data.submittedAt ? Timestamp.fromDate(data.submittedAt) : null,
      completedAt: data.completedAt ? Timestamp.fromDate(data.completedAt) : null,
    });
    return existing.id;
  }

  const newDoc = await addDoc(submissionsRef, {
    ...data,
    submittedAt: data.submittedAt ? Timestamp.fromDate(data.submittedAt) : null,
    completedAt: data.completedAt ? Timestamp.fromDate(data.completedAt) : null,
  });
  return newDoc.id;
}

export async function completeSubmission(
  submissionId: string,
  completedBy: string,
  leaderFeedback?: string
): Promise<void> {
  const docRef = doc(db, 'taskSubmissions', submissionId);
  await updateDoc(docRef, {
    status: 'completed' as TaskStatus,
    completedBy,
    completedAt: Timestamp.now(),
    ...(leaderFeedback !== undefined ? { leaderFeedback } : {}),
  });
}

export async function getAchievementRate(
  bookId: string,
  memberId: string
): Promise<number> {
  const tasks = await getTasksByBook(bookId);
  if (tasks.length === 0) return 0;

  const submissionsRef = collection(db, 'taskSubmissions');
  const q = query(
    submissionsRef,
    where('memberId', '==', memberId),
    where('status', '==', 'completed')
  );
  const snapshot = await getDocs(q);

  const taskIds = new Set(tasks.map((t) => t.id));
  let completedCount = 0;
  snapshot.docs.forEach((d) => {
    const taskId = d.data().taskId as string;
    if (taskIds.has(taskId)) completedCount++;
  });

  return Math.round((completedCount / tasks.length) * 100);
}
