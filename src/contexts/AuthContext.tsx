'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { UserProfile } from '@/types';

// localStorage へのアカウント保存（AuthContext内で直接操作）
const STORAGE_KEY = 'scoutbooks_accounts';
function saveAccountToStorage(email: string, name: string, role: string) {
  if (typeof window === 'undefined') return;
  try {
    const accounts: Array<{ email: string; name: string; role: string }> =
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    const idx = accounts.findIndex((a) => a.email === email);
    const entry = { email, name, role };
    if (idx >= 0) {
      accounts[idx] = entry;
    } else {
      accounts.push(entry);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // localStorage 利用不可の環境は無視
  }
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isLeader: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  isLeader: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          const docRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            const profile: UserProfile = {
              id: firebaseUser.uid,
              name: data.name ?? '',
              email: data.email ?? firebaseUser.email ?? '',
              role: data.role ?? 'member',
              createdAt: data.createdAt?.toDate() ?? new Date(),
            };
            setUserProfile(profile);
            // ログインするたびにアカウント一覧を更新
            saveAccountToStorage(profile.email, profile.name, profile.role);
          } else {
            setUserProfile(null);
          }
        } catch (error) {
          console.error('ユーザープロフィールの取得に失敗しました:', error);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const isLeader = userProfile?.role === 'leader';

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, isLeader }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}
