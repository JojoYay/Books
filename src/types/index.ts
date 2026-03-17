// ユーザー
export type UserRole = "leader" | "member";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}

// 本
export interface Book {
  id: string;
  title: string;
  description: string;
  coverImageUrl: string;
  totalPages: number;
  assignedMembers: string[]; // userId[]
  createdAt: Date;
}

// ページ
export interface BookPage {
  pageNumber: number;
  imageUrl: string;
}

// 課題
export interface Task {
  id: string;
  bookId: string;
  pageNumber: number;
  title: string;
  description: string;
  order: number;
}

// 課題提出
export type TaskStatus = "not_started" | "submitted" | "completed";

export interface TaskSubmission {
  id: string;
  taskId: string;
  bookId: string;     // 達成率クエリに必要
  memberId: string;
  photos: string[];   // Storage URLs
  files: string[];    // Storage URLs
  comment: string;
  status: TaskStatus;
  submittedAt: Date | null;
  completedAt: Date | null;
  completedBy: string | null; // userId or "parent"
  leaderFeedback: string | null;
}

// しおり
export interface Bookmark {
  id: string;
  bookId: string;
  pageNumber: number;
  createdAt: Date;
}

// メモ
export interface Memo {
  id: string;
  bookId: string;
  pageNumber: number;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

// 設定
export interface AppSettings {
  parentPin: string;
}
