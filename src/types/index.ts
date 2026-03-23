// ユーザー
export type UserRole = "leader" | "member";

export interface UserProfile {
  id: string;
  name: string;
  nameKana?: string;   // ふりがな
  email: string;
  role: UserRole;
  createdAt: Date;
  photoUrl?: string;    // プロフィール写真
  tagline?: string;     // ひとこと（短文）
  bio?: string;         // 自己紹介（長文）
  birthday?: string;    // 誕生日 (YYYY-MM-DD)
  group?: string;       // 組（例: ビーバー組、カブ組など）
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
  order?: number;            // 表示順（小さい順に表示、未設定は末尾）
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
  category: string;    // 大項目（例: 運動、自然観察）
  question: string;    // 設問内容
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
  label?: string;                    // しおりの名前（任意）
  visibility: 'private' | 'shared'; // 自分だけ / みんなと共有
  userId?: string;                   // 共有しおりに使用
  userName?: string;                 // 共有しおりに使用
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
