// Prod-shaped audit history, all invented: names, clubs and messages are made up.
// It keeps prod's mix of actions and record shapes (chat messages with a club /
// #channel line, people, generic and deleted records), bursts by one person, and
// message lengths from a few words up to the server's 240-character preview.
import { auditCategory, auditPersonName, auditActionLabel, auditRecordTitle, auditRecordLabel } from '~/apps/shared/audit';
let seed = 20261125;
const rand = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
const NAMES = ['Mira Castellanos','Theo Okonkwo','Priyanka Raghunathan','Jonah Whitfield','Leilani Kahale','Arjun Venkataraman','Sofia Lindqvist','Malik Haddad','Hana Watanabe','Diego Albarrán','Nadia Petrova','Kofi Mensah','Isla McAllister','Ravi Subramaniam Iyer','Chloe Dubois','Ezra Goldfarb','Amara Nwosu','Lucas Ferreira','Yuna Park','Owen Brightwater','Zara Qureshi','Felix Hartmann','Anika Bhattacharya Rao','Mateo Rinaldi','Ingrid Solberg'];
const people = NAMES.map((n, i) => { const [firstName, ...rest] = n.split(' '); return { id: 'user' + i, firstName, lastName: rest.join(' '), uniqueId: String(203000100 + i * 37) }; });
const CLUBS = [['club1', 'Student Leadership Council', ['General', 'Officers']], ['club2', 'Robotics Collective', ['General', 'Build Team']], ['club3', 'Model United Nations', ['General']], ['club4', 'Green Campus Club', ['General', 'Events']]] as const;
const SHORT = ['what’s the join code?', 'which room again?', 'link is in the channel description', 'on my way', 'can someone send the slides', 'yes!', 'running 5 min late', 'thanks everyone'];
const MEDIUM = ['Is anyone in the library yet? I’m at the front desk and don’t see the group anywhere', 'I can only make one of the two sessions this week, sorry.', 'Hello all! Meetings move to Wednesdays after school in the art room starting next week.', 'Does anyone still have the sign-up sheet for the bake sale shifts?'];
const LONG = ['Reminder: we meet TONIGHT from 6 to 6:30pm online. This is the planning meeting for the spring showcase, so please skim the shared outline beforehand and bring one idea for the officers to discuss.', 'Heads up that I’ll miss today because of a family trip. I tried to dial in from the train but the signal kept cutting out, so I’ll read the notes tonight and send my section by Sunday evening.', 'Apologies for the late reply, I only saw the announcement this morning. Could someone recap what we decided about the fundraiser date and who is designing the posters for the hallway?'];
const message = () => { const r = rand(); return r < 0.5 ? pick(SHORT) : r < 0.9 ? pick(MEDIUM) : pick(LONG); };
const ANNOUNCEMENTS = ['Spring Flex Friday sign-ups are open', 'Picture day moved to Thursday', 'Senior parking passes: pick up in the main office by Friday', 'Club fair volunteers needed'];
const WORKSHOPS = ['Intro to 3D Printing', 'College Essay Workshop', 'Chess Strategy for Beginners', 'Mindful Mornings'];
let n = 0;
type Ev = any;
const base = (action: string, entityType: string, actor: typeof people[number] | null, title: string, links: any[] = [], extra: Partial<Ev> = {}): Ev => {
  if (title === 'Flex registration') title = auditRecordLabel(entityType);
  const entityId = `${entityType}:${n}`;
  return { id: 'ev' + n++, action, entityType, entityId, actorId: actor?.id ?? null, actor: actor ?? null, meta: {}, ...extra,
    context: { title, subtitle: null, references: [], links: [{ id: entityId, label: 'Record', name: title, href: '#' }, ...links], deleted: extra.context?.deleted ?? false } };
};
const place = (club: typeof CLUBS[number], channel?: string) => [{ id: club[0], label: 'Club', name: club[1], href: '#' }, ...(channel ? [{ id: club[0] + channel, label: 'Channel', name: channel, href: '#' }] : [])];
const asPerson = (o: typeof people[number]) => ({ id: o.id, firstName: o.firstName, lastName: o.lastName, uniqueId: o.uniqueId });
const personEv = (action: string, actor: typeof people[number] | null, o: typeof people[number], meta = {}) => {
  const e = base(action, 'user', actor, `${o.firstName} ${o.lastName}`, [], { meta }); e.entityId = o.id; e.context.links[0].id = o.id; e.context.person = asPerson(o); return e; };
const ROLES = ['Treasurer', 'President', 'Social Media Lead', 'Member'];
const STATUSES = ['RESOLVED', 'RESOLVED', 'RESOLVED', 'DISMISSED', 'IN_REVIEW'];
const EMOJI = ['LIKE', 'LIKE', 'LIKE', 'HEART', 'FIRE', 'EYES', 'DONE', 'SKULL'];
const msgMeta = () => ({ ...(rand() < 0.14 ? { replyToMessageId: 'm' } : {}), ...(rand() < 0.05 ? { attachmentCount: 1 + Math.floor(rand() * 2) } : {}) });
// Weights follow prod's mix of (record type, action), Nov 2026.
const kinds: [number, (p: typeof people[number]) => Ev[]][] = [
  [284, (p) => { const c = pick(CLUBS); return [base('CLUB_CHANNEL_MESSAGE_POSTED', 'ClubChannelMessage', p, message(), place(c, pick(c[2])), { meta: msgMeta() })]; }],
  [124, (p) => { const c = pick(CLUBS); return [base(rand() < 0.87 ? 'CLUB_CHANNEL_MESSAGE_REACTION_ADDED' : 'CLUB_CHANNEL_MESSAGE_REACTION_REMOVED', 'ClubChannelMessage', p, message(), place(c, pick(c[2])), { meta: { emoji: pick(EMOJI) } })]; }],
  [30, (p) => { const c = pick(CLUBS); return [base('CLUB_CHANNEL_MESSAGE_UPDATED', 'ClubChannelMessage', p, message(), place(c, pick(c[2])))]; }],
  [217 / 3, (p) => Array.from({ length: 1 + Math.floor(rand() * 5) }, () => personEv('schedule.friend_requested', p, pick(people)))],
  [163, (p) => [personEv('schedule.friend_accepted', p, pick(people))]],
  [11, (p) => [personEv('schedule.friend_removed', p, pick(people))]],
  [186, (p) => [personEv('user.password_changed', p, p)]],
  [58, () => [personEv('user.password_reset', people[1], pick(people))]],
  [30, () => [personEv('impersonation.requested', people[1], pick(people), { reason: 'Support request' })]],
  [139, () => { const known = rand() < 0.96; const o = pick(people); const e = base('auth.login_locked', 'authAccount', null, known ? `${o.firstName} ${o.lastName}` : 'Sign-in account', [], { meta: { failureCount: 5 + Math.floor(rand() * rand() * 10) } }); if (known) e.context.person = asPerson(o); return [e]; }],
  [136, (p) => { const k = 200 + Math.floor(rand() * 50); return [base('REPORT_SUBMITTED', 'Report', p, `Feedback #${k}`, [], { meta: { contentType: 'GENERAL' } }), ...(rand() < 0.07 ? [base('FEEDBACK_GITHUB_ISSUE_CREATED', 'Report', null, `Feedback #${k}`, [], { meta: { issueNumber: k } })] : [])]; }],
  [118, () => [base('REPORT_UPDATED', 'Report', people[1], rand() < 0.1 ? 'Report' : `Feedback #${200 + Math.floor(rand() * 50)}`, [], { meta: { status: pick(STATUSES) } })]],
  [63, () => [base('FEEDBACK_RESPONSE_ADDED', 'Report', people[1], `Feedback #${200 + Math.floor(rand() * 50)}`)]],
  [98, (p) => { const e = base('schedule.updated', 'StudentSchedule', p, 'Student schedule', [], { meta: { entryCount: 35, userId: p.id } }); e.context.person = asPerson(p); return [e]; }],
  [98, (p) => { const c = pick(CLUBS); return [base('CLUB_JOINED', 'Club', p, c[1], [], { meta: { userId: p.id } })]; }],
  [76, (p) => { const c = pick(CLUBS); const r = pick(ROLES); return [base('CLUB_ROLE_PERMISSIONS_UPDATED', 'Club', p, c[1], [{ id: 'role' + r, label: 'Role', name: r, href: null }], { meta: { roleId: 'role' + r, roleName: r, permissions: ['createPolls', 'pinMessages', 'createEvents'].slice(0, 1 + Math.floor(rand() * 3)), enabled: rand() < 0.7 } })]; }],
  [57, (p) => [base('ANNOUNCEMENT_READ', 'Announcement', p, pick(ANNOUNCEMENTS))]],
  [47, (p) => { const c = pick(CLUBS); const r = pick(ROLES); const o = pick(people); const e = base('CLUB_MEMBER_ROLE_SET', 'Club', p, c[1], [{ id: 'role' + r, label: 'Role', name: r, href: null }], { meta: { memberId: o.id, roleId: 'role' + r, roleName: r } }); e.context.person = asPerson(o); return [e]; }],
  [43, (p) => { const c = pick(CLUBS); const o = pick(people); const e = base('CLUB_UNIT_MEMBER_SET', 'ClubUnit', p, pick(['Officers', 'Build Team', 'Seniors']), place(c), { meta: { clubId: c[0], memberId: o.id } }); e.context.person = asPerson(o); return [e]; }],
  [28, (p) => [base('schedule.group_created', 'studentScheduleGroup', p, 'Schedule group', [], { context: { deleted: rand() < 0.4 } })]],
  [23, (p) => { const c = pick(CLUBS); return [base('CLUB_UNIT_CREATED', 'ClubUnit', p, pick(['Officers', 'Build Team', 'Seniors']), place(c))]; }],
  [11, (p) => [base('schedule.friend_link_created', 'studentFriendShareLink', p, 'Schedule sharing link')]],
  [15, (p) => { const c = pick(CLUBS); return [base('CLUB_CHANNEL_CREATED', 'ClubChannel', p, pick(['general', 'events', 'build-log']), place(c))]; }],
  [14, (p) => { const w = pick(WORKSHOPS); return [base('FLEX_WORKSHOP_REGISTERED', 'FLEX_REGISTRATION', p, 'Flex registration', [{ id: 'w' + w, label: 'Workshop', name: w, href: '#' }])]; }],
];
const weight = kinds.reduce((s, [w]) => s + w, 0);
const events: Ev[] = [];
let t = Date.parse('2026-11-21T22:40:00Z');
while (events.length < 2253) {
  let r = rand() * weight; const make = kinds.find(([w]) => (r -= w) < 0)![1];
  const actor = rand() < 0.3 ? people[Math.floor(rand() * 5)] : pick(people);
  for (const e of make(actor)) { e.createdAt = new Date(t).toISOString(); events.push(e); t -= 30_000 + rand() * 90_000; }
  t -= rand() < 0.08 ? rand() * 20 * 3600_000 : rand() * 50 * 60_000;
}
const filter = (a: any) => events.filter((e) =>
  (!a?.actorId || e.actorId === a.actorId) && (!a?.actions || a.actions.includes(e.action)) &&
  (!a?.categories || a.categories.includes(auditCategory(e.entityType, e.action))) &&
  (!a?.entityType || e.entityType === a.entityType) &&
  (!a?.search || [auditPersonName(e), auditActionLabel(e.action), auditRecordTitle(e)].join(' ').toLowerCase().includes(String(a.search).toLowerCase())));
(window as any).__fixture = { events, filter, filterOptions: { actions: [...new Set(events.map((e) => e.action))], entityTypes: [...new Set(events.map((e) => e.entityType))] }, defaults: {} };

// Users roster: about 600 invented people in prod's shapes (students by grade
// and pathway, staff, a few inactive accounts, long names and emails).
const FIRST = ['Mira', 'Theo', 'Priyanka', 'Jonah', 'Leilani', 'Arjun', 'Sofia', 'Malik', 'Hana', 'Diego', 'Nadia', 'Kofi', 'Isla', 'Ravi', 'Chloe', 'Ezra', 'Amara', 'Lucas', 'Yuna', 'Owen', 'Zara', 'Felix', 'Anika', 'Mateo', 'Ingrid', 'Bartholomew', 'Xiomara'];
const LAST = ['Castellanos', 'Okonkwo', 'Raghunathan', 'Whitfield', 'Kahale', 'Venkataraman', 'Lindqvist', 'Haddad', 'Watanabe', 'Albarrán', 'Petrova', 'Mensah', 'McAllister', 'Subramaniam Iyer', 'Dubois', 'Goldfarb', 'Nwosu', 'Ferreira', 'Park', 'Brightwater', 'Qureshi', 'Hartmann', 'Bhattacharya Rao', 'Rinaldi', 'Solberg', 'Lakkisetty Naga'];
const PATHS = ['INFORMATION_TECHNOLOGY', 'HEALTH_SCIENCE', 'ENGINEERING'];
const users = Array.from({ length: 612 }, (_, i) => {
  const r = rand();
  const roles = r < 0.86 ? (rand() < 0.08 ? ['STUDENT', 'STUDENT_LEADER'] : ['STUDENT']) : r < 0.95 ? ['TEACHER'] : r < 0.98 ? ['SUPPORT_STAFF'] : ['ADMIN'];
  const student = roles[0] === 'STUDENT';
  const firstName = pick(FIRST), lastName = pick(LAST);
  return {
    _id: 'u' + i, uniqueId: String(203000000 + i * 7), firstName, lastName,
    ...(rand() < 0.1 ? { preferredName: pick(FIRST) } : {}),
    roles, isActive: rand() > 0.03, isDeveloper: rand() < 0.01,
    email: `${firstName}.${lastName.replace(/\s/g, '')}${i}@students.example-district.org`.toLowerCase(),
    ...(student ? { gradeLevel: 9 + Math.floor(rand() * 4), major: pick(PATHS), ...(rand() < 0.3 ? { minor: pick(PATHS) } : {}) } : {}),
    roster: { createdAt: 0, updatedAt: 0, mustResetPassword: rand() < 0.05, canReviewFeedback: false,
      flex: student ? { remaining: Math.floor(rand() * 8), fall: Math.floor(rand() * 9), spring: Math.floor(rand() * 9), absences: Math.floor(rand() * rand() * 6), excused: Math.floor(rand() * 2), tardies: Math.floor(rand() * 3), lastCreditAt: null } : null },
  };
});
Object.assign((window as any).__fixture, {
  usersList: (a: any) => {
    const q = String(a?.search ?? a?.roster?.search ?? '').toLowerCase();
    const all = users.filter((u) => !q || `${u.firstName} ${u.lastName} ${u.uniqueId}`.toLowerCase().includes(q));
    const start = Number(a?.paginationOpts?.cursor ?? 0) || 0, n = a?.paginationOpts?.numItems ?? 50;
    return { page: all.slice(start, start + n), isDone: start + n >= all.length, continueCursor: String(start + n) };
  },
  usersCount: users.length,
});
