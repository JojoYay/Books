import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { submissionId, pin } = body as { submissionId?: string; pin?: string };

    if (!submissionId || !pin) {
      return NextResponse.json(
        { success: false, error: '必須パラメータが不足しています' },
        { status: 400 }
      );
    }

    // Read the parent PIN from settings
    const settingsDoc = await adminDb.doc('settings/parentPin').get();
    if (!settingsDoc.exists) {
      return NextResponse.json(
        { success: false, error: '設定が見つかりません' },
        { status: 500 }
      );
    }

    const settingsData = settingsDoc.data();
    const storedPin = settingsData?.parentPin as string | undefined;

    if (!storedPin || pin !== storedPin) {
      return NextResponse.json({ success: false, error: 'PINが正しくありません' });
    }

    // Update the submission to completed
    const submissionRef = adminDb.doc(`taskSubmissions/${submissionId}`);
    await submissionRef.update({
      status: 'completed',
      completedAt: Timestamp.now(),
      completedBy: 'parent',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('verify-parent-pin error:', error);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
