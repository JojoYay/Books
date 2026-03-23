/**
 * generate-book-pdf.ts
 *
 * Generates a PDF "思い出帳" (memory booklet) for a member's book,
 * containing all tasks, submitted photos, comments, and leader feedback.
 *
 * Uses jsPDF for PDF generation.
 */
import type { Book, Task, TaskSubmission } from '@/types';

/** Fetch an image URL and return a data URL (base64). */
async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Get image dimensions from a data URL. */
function getImageDimensions(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.width, h: img.height });
    img.onerror = () => resolve({ w: 1, h: 1 });
    img.src = dataUrl;
  });
}

export interface PdfTask {
  task: Task;
  submission: TaskSubmission | null;
}

export async function generateBookPdf(
  book: Book,
  memberName: string,
  pdfTasks: PdfTask[]
): Promise<void> {
  // Dynamic import to avoid SSR issues
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN = 15;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  // ── Custom font workaround: use built-in helvetica but add Japanese-capable chars ──
  // jsPDF doesn't support Japanese out of the box without custom fonts.
  // We'll use Unicode encoding and the standard font for labels, and
  // for Japanese text we'll use the addFont workaround below.
  // Because jsPDF's built-in fonts don't support Japanese glyphs,
  // we split the output into romanised labels and render Japanese text as
  // raw UTF-8 using the "html" method.

  // Actually, jsPDF supports Japanese via html() method which renders HTML to PDF.
  // We'll build an HTML string and use doc.html() for better Japanese support.

  const STATUS_LABEL: Record<string, string> = {
    not_started: '未提出',
    submitted: '提出済み（確認待ち）',
    completed: '完了',
  };

  // ── Build HTML content ────────────────────────────────────────────────────
  // Pre-load all images as data URLs
  const imageCache = new Map<string, string | null>();
  const allPhotoUrls = pdfTasks.flatMap((pt) => pt.submission?.photos ?? []);
  await Promise.all(
    allPhotoUrls.map(async (url) => {
      if (!imageCache.has(url)) {
        const dataUrl = await urlToDataUrl(url);
        imageCache.set(url, dataUrl);
      }
    })
  );

  // Build the HTML
  const completedTasks = pdfTasks.filter((pt) => pt.submission?.status === 'completed');
  const submittedTasks = pdfTasks.filter((pt) => pt.submission?.status === 'submitted');
  const notStartedTasks = pdfTasks.filter((pt) => !pt.submission || pt.submission.status === 'not_started');

  function formatDate(d: Date | null | undefined): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  function taskSection(pt: PdfTask): string {
    const { task, submission } = pt;
    const status = submission?.status ?? 'not_started';
    const statusColor = status === 'completed' ? '#16a34a' : status === 'submitted' ? '#ca8a04' : '#6b7280';

    const photosHtml =
      submission && submission.photos.length > 0
        ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">
            ${submission.photos
              .map((url) => {
                const dataUrl = imageCache.get(url);
                if (!dataUrl) return '';
                return `<img src="${dataUrl}" style="width:120px;height:120px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb;" />`;
              })
              .join('')}
          </div>`
        : '';

    const filesHtml =
      submission && submission.files.length > 0
        ? `<p style="margin:6px 0 2px;font-size:11px;color:#6b7280;">添付ファイル: ${submission.files.length}件</p>`
        : '';

    const commentHtml = submission?.comment
      ? `<div style="margin-top:8px;background:#f9fafb;border-radius:6px;padding:8px;font-size:12px;color:#374151;white-space:pre-wrap;">${escapeHtml(submission.comment)}</div>`
      : '';

    const feedbackHtml = submission?.leaderFeedback
      ? `<div style="margin-top:8px;background:#eff6ff;border-radius:6px;padding:8px;font-size:12px;color:#1e40af;white-space:pre-wrap;"><strong>フィードバック:</strong> ${escapeHtml(submission.leaderFeedback)}</div>`
      : '';

    const completedHtml =
      status === 'completed'
        ? `<p style="margin:4px 0 0;font-size:11px;color:#16a34a;">
            完了日: ${formatDate(submission?.completedAt)}
            ${submission?.completedBy === 'parent' ? '（指導者・保護者確認）' : submission?.completedBy ? `（リーダー確認）` : ''}
          </p>`
        : '';

    return `
      <div style="margin-bottom:20px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <div style="background:#f3f4f6;padding:10px 14px;border-bottom:1px solid #e5e7eb;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <strong style="font-size:13px;color:#111827;">${escapeHtml(task.category)}</strong>
            <span style="font-size:11px;font-weight:600;color:${statusColor};">${STATUS_LABEL[status]}</span>
          </div>
          <p style="margin:4px 0 0;font-size:11px;color:#6b7280;white-space:pre-wrap;">${escapeHtml(task.question)}</p>
        </div>
        <div style="padding:10px 14px;">
          ${submission?.submittedAt ? `<p style="margin:0 0 4px;font-size:11px;color:#6b7280;">提出日: ${formatDate(submission.submittedAt)}</p>` : ''}
          ${photosHtml}
          ${filesHtml}
          ${commentHtml}
          ${feedbackHtml}
          ${completedHtml}
        </div>
      </div>
    `;
  }

  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const generatedAt = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8"/>
  <style>
    * { box-sizing: border-box; }
    body { font-family: "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif; color: #111827; margin: 0; padding: 20px; font-size: 13px; }
    h1 { font-size: 20px; color: #065f46; margin: 0 0 4px; }
    h2 { font-size: 15px; color: #374151; margin: 20px 0 10px; border-bottom: 2px solid #d1fae5; padding-bottom: 4px; }
    .meta { color: #6b7280; font-size: 12px; margin-bottom: 24px; }
    .stats { display: flex; gap: 12px; margin-bottom: 24px; }
    .stat { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 16px; text-align: center; flex: 1; }
    .stat-num { font-size: 20px; font-weight: 700; color: #16a34a; }
    .stat-label { font-size: 11px; color: #6b7280; margin-top: 2px; }
  </style>
</head>
<body>
  <h1>📚 ${escapeHtml(book.title)}</h1>
  <p class="meta">隊員: ${escapeHtml(memberName)} ／ 出力日: ${generatedAt}</p>

  <div class="stats">
    <div class="stat">
      <div class="stat-num">${completedTasks.length}</div>
      <div class="stat-label">完了</div>
    </div>
    <div class="stat">
      <div class="stat-num">${submittedTasks.length}</div>
      <div class="stat-label">確認待ち</div>
    </div>
    <div class="stat">
      <div class="stat-num">${notStartedTasks.length}</div>
      <div class="stat-label">未提出</div>
    </div>
    <div class="stat">
      <div class="stat-num">${pdfTasks.length}</div>
      <div class="stat-label">全課題</div>
    </div>
  </div>

  ${completedTasks.length > 0 ? `<h2>✅ 完了した課題 (${completedTasks.length}件)</h2>
  ${completedTasks.map(taskSection).join('')}` : ''}

  ${submittedTasks.length > 0 ? `<h2>🕐 確認待ちの課題 (${submittedTasks.length}件)</h2>
  ${submittedTasks.map(taskSection).join('')}` : ''}

  ${notStartedTasks.length > 0 ? `<h2>📝 未提出の課題 (${notStartedTasks.length}件)</h2>
  ${notStartedTasks.map(taskSection).join('')}` : ''}
</body>
</html>
  `.trim();

  // Use jsPDF's html() method which renders HTML properly including Japanese text
  await new Promise<void>((resolve, reject) => {
    doc.html(html, {
      callback: (pdfDoc) => {
        const fileName = `${memberName}_${book.title}_課題記録.pdf`
          .replace(/[\\/:*?"<>|]/g, '_')
          .substring(0, 100);
        pdfDoc.save(fileName);
        resolve();
      },
      x: MARGIN,
      y: MARGIN,
      width: CONTENT_W,
      windowWidth: 800,
      autoPaging: 'text',
      margin: [MARGIN, MARGIN, MARGIN, MARGIN],
    });
  });
}
