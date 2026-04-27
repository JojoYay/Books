import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { UserRole, GroupRole } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, nameKana, email, password, role, birthday, group, groupRole } =
      body as {
        name?: string;
        nameKana?: string;
        email?: string;
        password?: string;
        role?: string;
        birthday?: string;
        group?: string;
        groupRole?: string;
      };

    // Validation
    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: 'name, email, password, role はすべて必須です。' },
        { status: 400 }
      );
    }

    if (!['leader', 'member'].includes(role)) {
      return NextResponse.json(
        { error: 'role は "leader" または "member" でなければなりません。' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'パスワードは6文字以上でなければなりません。' },
        { status: 400 }
      );
    }

    // Create Firebase Auth user
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
    });

    const validGroupRole =
      groupRole === 'kumicho' || groupRole === 'jicho'
        ? (groupRole as GroupRole)
        : undefined;

    // Create Firestore user document
    await adminDb.collection('users').doc(userRecord.uid).set({
      name,
      email,
      role: role as UserRole,
      createdAt: Timestamp.now(),
      ...(nameKana ? { nameKana } : {}),
      ...(birthday ? { birthday } : {}),
      ...(group ? { group } : {}),
      ...(validGroupRole ? { groupRole: validGroupRole } : {}),
    });

    return NextResponse.json({ success: true, userId: userRecord.uid });
  } catch (error: unknown) {
    console.error('create-user error:', error);

    // Firebase Auth errors
    const firebaseError = error as { code?: string; message?: string };
    if (firebaseError.code === 'auth/email-already-exists') {
      return NextResponse.json(
        { error: 'このメールアドレスはすでに使用されています。' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'ユーザーの作成に失敗しました。' },
      { status: 500 }
    );
  }
}
