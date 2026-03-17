import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { adminDb } from '@/lib/firebase/admin';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? 'ScoutBooks <noreply@scoutbooks.app>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://scoutbooks.app';

interface NotifySubmissionBody {
  taskId: string;
  memberId: string;
  memberName: string;
  bookTitle: string;
  taskTitle: string;
  submittedAt: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<NotifySubmissionBody>;

    const { taskId, memberId, memberName, bookTitle, taskTitle, submittedAt } =
      body;

    if (
      !taskId ||
      !memberId ||
      !memberName ||
      !bookTitle ||
      !taskTitle ||
      !submittedAt
    ) {
      return NextResponse.json(
        { success: false, error: '必須パラメータが不足しています' },
        { status: 400 }
      );
    }

    // Fetch all leaders from Firestore
    const usersSnap = await adminDb
      .collection('users')
      .where('role', '==', 'leader')
      .get();

    if (usersSnap.empty) {
      return NextResponse.json({ success: true, sentTo: 0 });
    }

    const leaderEmails: string[] = usersSnap.docs
      .map((d) => (d.data().email as string | undefined) ?? '')
      .filter((email) => email.length > 0);

    if (leaderEmails.length === 0) {
      return NextResponse.json({ success: true, sentTo: 0 });
    }

    const submittedDate = new Date(submittedAt).toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const subject = `[ScoutBooks] ${memberName}さんが課題を提出しました`;

    const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color:#059669;padding:24px 32px;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">ScoutBooks</p>
              <p style="margin:4px 0 0;font-size:13px;color:#a7f3d0;">課題提出のお知らせ</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 20px;font-size:15px;color:#111827;">
                <strong>${memberName}</strong>さんが課題を提出しました。
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;padding:16px;border:1px solid #e5e7eb;">
                <tr>
                  <td style="padding:6px 0;">
                    <span style="font-size:12px;color:#6b7280;display:block;">隊員名</span>
                    <span style="font-size:14px;color:#111827;font-weight:600;">${memberName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;border-top:1px solid #e5e7eb;">
                    <span style="font-size:12px;color:#6b7280;display:block;">本のタイトル</span>
                    <span style="font-size:14px;color:#111827;font-weight:600;">${bookTitle}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;border-top:1px solid #e5e7eb;">
                    <span style="font-size:12px;color:#6b7280;display:block;">課題</span>
                    <span style="font-size:14px;color:#111827;font-weight:600;">${taskTitle}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;border-top:1px solid #e5e7eb;">
                    <span style="font-size:12px;color:#6b7280;display:block;">提出日時</span>
                    <span style="font-size:14px;color:#111827;font-weight:600;">${submittedDate}</span>
                  </td>
                </tr>
              </table>

              <div style="margin-top:28px;text-align:center;">
                <a
                  href="${APP_URL}"
                  style="display:inline-block;background-color:#059669;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;"
                >
                  アプリを開く
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                このメールは ScoutBooks から自動送信されています。
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

    // Send to all leaders
    await Promise.all(
      leaderEmails.map((to) =>
        resend.emails.send({
          from: FROM_EMAIL,
          to,
          subject,
          html,
        })
      )
    );

    return NextResponse.json({ success: true, sentTo: leaderEmails.length });
  } catch (error) {
    console.error('notify-submission error:', error);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
