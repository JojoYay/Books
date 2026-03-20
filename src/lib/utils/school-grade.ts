/**
 * school-grade.ts
 *
 * Calculates the Japanese school grade from a birthday.
 *
 * Japanese school year rules:
 *   - School year starts April 1
 *   - Children born April 2 – December 31 of year Y enter 小1 in April of Y+7
 *   - Children born January 1 – April 1 of year Y enter 小1 in April of Y+6
 *   (This matches the "満6歳に達する日が4月1日以前" rule in Japanese law)
 */

export type SchoolGrade =
  | { label: string; level: 'pre' | 'elementary' | 'middle' | 'high' | 'graduated' }
  | null;

/**
 * Returns the Japanese school grade label for a person with the given birthday.
 * Returns null only if the birthday is invalid.
 */
export function calcSchoolGrade(birthday: Date | string, today?: Date): SchoolGrade {
  const birth = birthday instanceof Date ? birthday : new Date(birthday);
  const now = today ?? new Date();

  if (isNaN(birth.getTime())) return null;

  // Current school year — April of the year this school year started
  const nowMonth = now.getMonth() + 1; // 1-12
  const nowYear = now.getFullYear();
  const schoolYear = nowMonth >= 4 ? nowYear : nowYear - 1;

  const birthYear = birth.getFullYear();
  const birthMonth = birth.getMonth() + 1;
  const birthDay = birth.getDate();

  // April 2 or later → starts school 7 years after birth year
  // April 1 or earlier (incl. Jan–Mar) → starts school 6 years after birth year
  const isAfterApril1 = birthMonth > 4 || (birthMonth === 4 && birthDay >= 2);
  const nyuugakuYear = birthYear + (isAfterApril1 ? 7 : 6);

  const gradeInYear = schoolYear - nyuugakuYear + 1; // 1 = 小1

  if (gradeInYear <= 0) {
    return { label: '未就学', level: 'pre' };
  }
  if (gradeInYear >= 1 && gradeInYear <= 6) {
    return { label: `小${gradeInYear}`, level: 'elementary' };
  }
  if (gradeInYear >= 7 && gradeInYear <= 9) {
    return { label: `中${gradeInYear - 6}`, level: 'middle' };
  }
  if (gradeInYear >= 10 && gradeInYear <= 12) {
    return { label: `高${gradeInYear - 9}`, level: 'high' };
  }

  return { label: '大人', level: 'graduated' };
}

export type SchoolLevel = 'pre' | 'elementary' | 'middle' | 'high' | 'graduated';

/** Tailwind badge colour per school level */
export function gradeBadgeClass(level: SchoolLevel | undefined): string {
  switch (level) {
    case 'pre':
      return 'bg-pink-100 text-pink-700';
    case 'elementary':
      return 'bg-yellow-100 text-yellow-700';
    case 'middle':
      return 'bg-blue-100 text-blue-700';
    case 'high':
      return 'bg-purple-100 text-purple-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}
