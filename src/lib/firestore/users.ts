import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { UserProfile, UserRole } from '@/types';

function toUserProfile(
  id: string,
  data: Record<string, unknown>
): UserProfile {
  return {
    id,
    name: (data.name as string) ?? '',
    email: (data.email as string) ?? '',
    role: (data.role as UserRole) ?? 'member',
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate()
        : new Date(),
    photoUrl: (data.photoUrl as string) || undefined,
    tagline: (data.tagline as string) || undefined,
    bio: (data.bio as string) || undefined,
  };
}

export async function getUser(userId: string): Promise<UserProfile | null> {
  const docRef = doc(db, 'users', userId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return toUserProfile(snap.id, snap.data() as Record<string, unknown>);
}

export async function getAllMembers(): Promise<UserProfile[]> {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('role', '==', 'member'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) =>
    toUserProfile(d.id, d.data() as Record<string, unknown>)
  );
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const usersRef = collection(db, 'users');
  const snapshot = await getDocs(usersRef);
  return snapshot.docs.map((d) =>
    toUserProfile(d.id, d.data() as Record<string, unknown>)
  );
}

export async function createUser(
  userId: string,
  data: Omit<UserProfile, 'id'>
): Promise<void> {
  const docRef = doc(db, 'users', userId);
  await setDoc(docRef, {
    ...data,
    createdAt:
      data.createdAt instanceof Date
        ? Timestamp.fromDate(data.createdAt)
        : Timestamp.now(),
  });
}

export async function updateUser(
  userId: string,
  data: Partial<UserProfile>
): Promise<void> {
  const docRef = doc(db, 'users', userId);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, createdAt, ...rest } = data as Partial<UserProfile> & {
    id?: string;
    createdAt?: Date;
  };
  await updateDoc(docRef, rest as Record<string, unknown>);
}
