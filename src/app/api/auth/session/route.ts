import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idToken } = body as { idToken?: string };

    if (!idToken) {
      return NextResponse.json(
        { error: 'IDトークンが必要です。' },
        { status: 400 }
      );
    }

    // Verify the ID token first
    await adminAuth.verifyIdToken(idToken);

    // Create a session cookie
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });

    const response = NextResponse.json({ status: 'success' });

    response.cookies.set('session', sessionCookie, {
      maxAge: SESSION_DURATION_MS / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('セッション作成エラー:', error);
    return NextResponse.json(
      { error: 'セッションの作成に失敗しました。' },
      { status: 401 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ status: 'success' });

  response.cookies.set('session', '', {
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  return response;
}
