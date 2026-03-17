import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pin } = body as { pin?: string };

    if (!pin) {
      return NextResponse.json(
        { error: 'pin は必須です。' },
        { status: 400 }
      );
    }

    if (pin.length < 4) {
      return NextResponse.json(
        { error: 'PINは4桁以上でなければなりません。' },
        { status: 400 }
      );
    }

    await adminDb.collection('settings').doc('parentPin').set({ pin });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('update-pin error:', error);
    return NextResponse.json(
      { error: 'PINの更新に失敗しました。' },
      { status: 500 }
    );
  }
}
