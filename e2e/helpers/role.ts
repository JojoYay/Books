/**
 * role.ts — Test helpers for role-based assertions.
 *
 * Usage:
 *   import { isLeaderProject, isMobileProject } from '../helpers/role';
 *   test.skip(isLeaderProject(testInfo), 'member-only test');
 */
import type { TestInfo } from '@playwright/test';

/** Returns true when the current Playwright project is leader-role. */
export function isLeaderProject(testInfo: TestInfo): boolean {
  return testInfo.project.name.includes('leader');
}

/** Returns true when the current Playwright project is member-role. */
export function isMemberProject(testInfo: TestInfo): boolean {
  return testInfo.project.name.includes('member');
}

/** Returns true when the current Playwright project is mobile. */
export function isMobileProject(testInfo: TestInfo): boolean {
  return testInfo.project.name.includes('mobile');
}
