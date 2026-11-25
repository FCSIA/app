import { describe, expect, it } from 'vitest';
import { adminAccessFor, adminSectionHref, resolveAdminSection, visibleAdminSections } from './admin-sections';

const staff = { isSuperAdmin: false, canManageWrapped: false, canReviewFeedback: false, hasStaffAccess: true };
const admin = { ...staff, canManageWrapped: true };
const superAdmin = { ...staff, isSuperAdmin: true, canManageWrapped: true, canReviewFeedback: true };
const feedbackReviewer = { ...staff, canReviewFeedback: true, hasStaffAccess: false };
const ids = (access: typeof staff) => visibleAdminSections(access).map((section) => section.id);

describe('admin sections', () => {
  it('shows each role the sections it may use', () => {
    expect(ids(staff)).toEqual(['users', 'moderation', 'audit']);
    expect(ids(admin)).toEqual(['users', 'moderation', 'wrapped', 'audit']);
    expect(ids(superAdmin)).toHaveLength(8);
    expect(ids(feedbackReviewer)).toEqual(['feedback']);
  });

  it('reads access from the account permissions', () => {
    expect(adminAccessFor(null)).toEqual({
      isSuperAdmin: false,
      canManageWrapped: false,
      canReviewFeedback: false,
      hasStaffAccess: false,
    });
    expect(adminAccessFor({ roles: ['SUPER_ADMIN'] })).toEqual({
      isSuperAdmin: true,
      canManageWrapped: true,
      canReviewFeedback: true,
      hasStaffAccess: true,
    });
    expect(adminAccessFor({ roles: ['STUDENT'], canReviewFeedback: true })).toMatchObject({
      canReviewFeedback: true,
      hasStaffAccess: false,
    });
  });

  it('keeps admin navigation and direct pages unavailable to ordinary accounts', () => {
    const student = adminAccessFor({ roles: ['STUDENT'] });
    expect(visibleAdminSections(student)).toEqual([]);
    expect(resolveAdminSection('audit', student)).toBeNull();
  });

  it('falls back to the first page the viewer may open', () => {
    expect(resolveAdminSection('feedback', admin)).toBe('users');
    expect(resolveAdminSection('feedback', superAdmin)).toBe('feedback');
    expect(resolveAdminSection('wrapped', staff)).toBe('users');
    expect(resolveAdminSection('users', feedbackReviewer)).toBe('feedback');
    expect(resolveAdminSection('audit', feedbackReviewer)).toBe('feedback');
  });

  it('maps retired tab names to their pages', () => {
    expect(resolveAdminSection('permissions', staff)).toBe('users');
    expect(resolveAdminSection('student-admins', staff)).toBe('users');
    expect(resolveAdminSection('reports', staff)).toBe('moderation');
    expect(resolveAdminSection(null, superAdmin)).toBe('users');
  });

  it('keeps section filters on canonical URLs', () => {
    const filters = new URLSearchParams('audit_q=school+calendar&audit_scope=events');
    expect(adminSectionHref('audit', filters)).toBe('/admin/audit?audit_q=school+calendar&audit_scope=events');
    expect(adminSectionHref('users')).toBe('/admin/users');
  });
});
