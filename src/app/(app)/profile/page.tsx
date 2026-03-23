'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { storage } from '@/lib/firebase/client';
import { updateUser } from '@/lib/firestore/users';
import { useAuth } from '@/contexts/AuthContext';

const ROLE_LABEL: Record<string, string> = {
  leader: '隊長',
  member: '隊員',
};

export default function ProfilePage() {
  const { user, userProfile } = useAuth();

  // Profile fields
  const [name, setName] = useState('');
  const [nameKana, setNameKana] = useState('');
  const [birthday, setBirthday] = useState('');
  const [tagline, setTagline] = useState('');
  const [bio, setBio] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password change fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);

  // フォームを現在のプロフィールで初期化
  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name ?? '');
      setNameKana(userProfile.nameKana ?? '');
      setBirthday(userProfile.birthday ?? '');
      setTagline(userProfile.tagline ?? '');
      setBio(userProfile.bio ?? '');
      setPreviewUrl(userProfile.photoUrl ?? null);
    }
  }, [userProfile]);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    setProfileError(null);

    try {
      let photoUrl = userProfile?.photoUrl;

      // 写真が選択されていればアップロード
      if (photoFile) {
        const storageRef = ref(storage, `profiles/${user.uid}/avatar.jpg`);
        await uploadBytes(storageRef, photoFile, {
          contentType: photoFile.type,
        });
        photoUrl = await getDownloadURL(storageRef);
      }

      await updateUser(user.uid, {
        name: name.trim() || (userProfile?.name ?? ''),
        nameKana: nameKana.trim() || undefined,
        photoUrl: photoUrl ?? '',
        tagline: tagline.trim(),
        bio: bio.trim(),
        birthday: birthday || undefined,
      });

      setSaved(true);
      setPhotoFile(null);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('プロフィール保存エラー:', err);
      setProfileError('保存に失敗しました。もう一度お試しください。');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!user || !user.email) return;
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError('現在のパスワードを入力してください。');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('新しいパスワードは6文字以上にしてください。');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('新しいパスワードが一致しません。');
      return;
    }

    setChangingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setPasswordChanged(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordChanged(false), 3000);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      if (
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential'
      ) {
        setPasswordError('現在のパスワードが正しくありません。');
      } else if (code === 'auth/weak-password') {
        setPasswordError('パスワードが弱すぎます。もっと強いパスワードにしてください。');
      } else {
        setPasswordError('パスワードの変更に失敗しました。もう一度お試しください。');
      }
    } finally {
      setChangingPassword(false);
    }
  }

  if (!userProfile) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    );
  }

  const avatarSrc = previewUrl;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">プロフィール</h1>
        <p className="mt-1 text-sm text-gray-500">
          自分の情報を編集できます
        </p>
      </div>

      {/* ── プロフィールカード ── */}
      <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
        {/* アバター */}
        <div className="flex flex-col items-center gap-3 bg-gradient-to-br from-green-50 to-emerald-100 px-6 py-8">
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="group relative"
            aria-label="写真を変更"
          >
            <div className="h-24 w-24 rounded-full overflow-hidden bg-gray-200 ring-4 ring-white shadow-md">
              {avatarSrc ? (
                <Image
                  src={avatarSrc}
                  alt="プロフィール写真"
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                  unoptimized={avatarSrc.startsWith('blob:')}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-green-200 text-green-700 text-3xl font-bold">
                  {userProfile.name.charAt(0)}
                </div>
              )}
            </div>
            {/* オーバーレイ */}
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
              <svg
                className="h-7 w-7 text-white"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
                />
              </svg>
            </div>
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />
          <p className="text-xs text-gray-500">タップして写真を変更</p>
        </div>

        {/* フォーム */}
        <div className="px-6 py-6 space-y-5">
          {/* 名前 */}
          <div>
            <label
              htmlFor="profile-name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              名前
            </label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="名前を入力"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          {/* ふりがな */}
          <div>
            <label
              htmlFor="profile-name-kana"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              ふりがな
            </label>
            <input
              id="profile-name-kana"
              type="text"
              value={nameKana}
              onChange={(e) => setNameKana(e.target.value)}
              placeholder="やまだ たろう"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          {/* 誕生日 */}
          <div>
            <label
              htmlFor="profile-birthday"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              誕生日
            </label>
            <input
              id="profile-birthday"
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          {/* ロール */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              役割
            </label>
            <p className="rounded-xl bg-gray-50 px-4 py-2.5 text-sm text-gray-900 border border-gray-200">
              {ROLE_LABEL[userProfile.role] ?? userProfile.role}
            </p>
          </div>

          {/* 組（リーダーが設定・読み取り専用） */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              組
              <span className="ml-1 text-xs text-gray-400">（リーダーが設定します）</span>
            </label>
            <p className="rounded-xl bg-gray-50 px-4 py-2.5 text-sm border border-gray-200 text-gray-900">
              {userProfile.group ?? <span className="text-gray-400">未設定</span>}
            </p>
          </div>

          {/* ひとこと */}
          <div>
            <label
              htmlFor="tagline"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              ひとこと
              <span className="ml-1 text-xs text-gray-400">（50文字以内）</span>
            </label>
            <input
              id="tagline"
              type="text"
              value={tagline}
              maxLength={50}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="例：縄結びが得意です！"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
            <p className="mt-1 text-right text-xs text-gray-400">
              {tagline.length}/50
            </p>
          </div>

          {/* 自己紹介 */}
          <div>
            <label
              htmlFor="bio"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              自己紹介
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={5}
              placeholder="スカウト活動で好きなことや、得意なことを書いてみましょう！"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
            />
          </div>

          {/* エラー */}
          {profileError && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {profileError}
            </div>
          )}

          {/* 保存ボタン */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                保存中...
              </span>
            ) : saved ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                保存しました
              </span>
            ) : (
              '保存する'
            )}
          </button>
        </div>
      </div>

      {/* ── パスワード変更カード ── */}
      <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">パスワードを変更</h2>
          <p className="mt-0.5 text-xs text-gray-500">現在のパスワードで本人確認を行います</p>
        </div>
        <div className="px-6 py-6 space-y-4">
          {/* 現在のパスワード */}
          <div>
            <label
              htmlFor="current-password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              現在のパスワード
            </label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="現在のパスワード"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          {/* 新しいパスワード */}
          <div>
            <label
              htmlFor="new-password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              新しいパスワード
              <span className="ml-1 text-xs text-gray-400">（6文字以上）</span>
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="新しいパスワード"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          {/* 確認 */}
          <div>
            <label
              htmlFor="confirm-password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              新しいパスワード（確認）
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="もう一度入力"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          {/* エラー */}
          {passwordError && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {passwordError}
            </div>
          )}

          {/* 変更ボタン */}
          <button
            type="button"
            onClick={handleChangePassword}
            disabled={changingPassword}
            className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
          >
            {changingPassword ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                変更中...
              </span>
            ) : passwordChanged ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                変更しました
              </span>
            ) : (
              'パスワードを変更する'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
