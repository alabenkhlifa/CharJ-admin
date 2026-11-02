import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORY_LABELS, designTally, deviceLine, FEEDBACK_CATEGORIES, feedbackErrorMessage, feedbackPath, isInformational,
  parseFeedbackResponse, parseFeedbackStrict, VOTE_LABELS,
} from '../src/data/feedback-report.ts';

// Shaped like the admin-feedback Edge Function's GET response.
const fixture = () => ({
  items: [
    {
      id: 'f1', device_id: 'd1', category: 'compliment', message: 'Super app\nmerci', email: ' a@b.tn ',
      app_version: '1.3.0', platform: 'android', locale: 'fr', resolved: false, resolved_at: null, resolved_by: null,
      created_at: '2026-10-31T19:00:00Z',
    },
    { id: 'f2', category: 'praise', message: 'Old row', resolved: true, resolved_at: '2026-10-31T20:00:00Z', resolved_by: 'admin@charj.tn' },
    { message: 'no id' },
  ],
  page: 1, perPage: 25, total: 2,
  summary: { total: 3, open: 2, open_requests: 2, resolved: 1, last_7_days: 2, by_category: { bug: 1, compliment: 2 } },
});

test('parses rows, trims the email and keeps the message as written', () => {
  const { items } = parseFeedbackResponse(fixture());
  assert.equal(items.length, 2);
  assert.equal(items[0].email, 'a@b.tn');
  assert.equal(items[0].message, 'Super app\nmerci');
  assert.equal(items[0].category, 'compliment');
});

test('an unknown category reads as other; missing fields default', () => {
  const second = parseFeedbackResponse(fixture()).items[1];
  assert.equal(second.category, 'other');
  assert.equal(second.email, '');
  assert.equal(second.resolved, true);
  assert.equal(second.resolvedBy, 'admin@charj.tn');
});

test('fills every category in the summary, missing ones at zero', () => {
  const { summary, total } = parseFeedbackResponse(fixture());
  assert.equal(total, 2);
  assert.deepEqual(summary, {
    total: 3, open: 2, openRequests: 2, resolved: 1, last7Days: 2,
    byCategory: { bug: 1, suggestion: 0, compliment: 2, charger_data: 0, other: 0, design: 0 },
  });
});

test('a malformed body parses to an empty page', () => {
  for (const body of [null, 'oops', [], { items: 'x', summary: 3 }]) {
    const parsed = parseFeedbackResponse(body);
    assert.deepEqual(parsed.items, []);
    assert.equal(parsed.summary.open, 0);
  }
});

test('device line skips blanks', () => {
  const [first, second] = parseFeedbackResponse(fixture()).items;
  assert.equal(deviceLine(first), 'android · 1.3.0 · fr');
  assert.equal(deviceLine(second), '—');
});

test('error messages per status', () => {
  assert.match(feedbackErrorMessage(401, ''), /credentials/);
  assert.match(feedbackErrorMessage(403, ''), /signed-in admin/);
  assert.match(feedbackErrorMessage(404, ''), /no longer exists/);
  assert.equal(feedbackErrorMessage(500, 'boom'), 'HTTP 500: boom');
});

test('design votes: their own category, the vote kept, an empty message is fine, informational', () => {
  const body = {
    items: [
      { id: 'd1', category: 'design', vote: 'up', message: '', created_at: '2026-11-02T08:00:00Z' },
      { id: 'd2', category: 'design', vote: 'down', message: 'Trop sombre', created_at: '2026-11-02T08:01:00Z' },
      { id: 'b1', category: 'bug', vote: 'sideways', message: 'Crash', created_at: '2026-11-02T08:02:00Z' },
    ],
    total: 3,
    summary: { total: 3, open: 3, open_requests: 1, resolved: 0, last_7_days: 3, by_category: { bug: 1, design: 2 } },
  };
  const { items, summary } = parseFeedbackResponse(body);
  assert.deepEqual(items.map((i) => [i.category, i.vote, i.message]), [['design', 'up', ''], ['design', 'down', 'Trop sombre'], ['bug', null, 'Crash']]);
  assert.deepEqual(items.map(isInformational), [true, true, false]);
  assert.ok(FEEDBACK_CATEGORIES.includes('design'));
  assert.equal(CATEGORY_LABELS.design, 'Design (Lune)');
  assert.deepEqual(VOTE_LABELS, { up: 'Likes it', down: "Doesn't like it" });
  assert.equal(summary.byCategory.design, 2);
  assert.equal(summary.openRequests, 1);
});

test('without open_requests (an older admin-feedback), open requests are unknown, never the open count with votes in it', () => {
  const { summary } = parseFeedbackResponse({ items: [], total: 0, summary: { total: 4, open: 3, resolved: 1 } });
  assert.equal(summary.openRequests, null);
  assert.equal(summary.open, 3);
});

test('parseFeedbackStrict refuses a body without items or summary instead of showing zeros', () => {
  for (const body of [null, 'oops', [], { items: [] }, { items: 'x', summary: {} }, { summary: {} }]) {
    assert.throws(() => parseFeedbackStrict(body), /Unexpected response/);
  }
  assert.equal(parseFeedbackStrict(fixture()).items.length, 2);
});

test('feedbackPath asks for one page of one status and category', () => {
  assert.equal(feedbackPath('open', 'requests', 1), 'admin-feedback?status=open&category=requests&page=1&perPage=25');
  assert.equal(feedbackPath('all', 'design', 2, 100), 'admin-feedback?status=all&category=design&page=2&perPage=100');
});

const vote = (id: string, v: 'up' | 'down', at: string, extra: Record<string, unknown> = {}) =>
  ({ id, category: 'design', vote: v, message: '', platform: '', locale: 'fr', created_at: at, ...extra });

test('designTally counts thumbs, keeps the newest comments and splits by platform when known', () => {
  const { items } = parseFeedbackResponse({
    items: [
      vote('v1', 'up', '2026-11-02T08:00:00Z', { message: 'Magnifique', platform: 'ios' }),
      vote('v2', 'down', '2026-11-02T09:00:00Z', { message: '  ', platform: 'android' }),
      vote('v3', 'up', '2026-11-01T09:00:00Z', { platform: 'android' }),
      vote('v4', 'down', '2026-11-02T10:00:00Z', { message: 'Trop sombre', platform: 'android', locale: 'ar' }),
      { id: 'x', category: 'design', vote: null, message: 'no thumb', created_at: '2026-11-02T11:00:00Z' },
    ],
    total: 5,
    summary: { total: 5, open: 5, open_requests: 0, resolved: 0, last_7_days: 5, by_category: { design: 5 } },
  });
  const t = designTally(items, 5);
  assert.deepEqual([t.up, t.down, t.votes, t.total], [2, 2, 4, 5]);
  assert.deepEqual(t.comments.map((c) => c.id), ['v4', 'v1'], 'newest first, blank comments left out');
  assert.deepEqual(t.platforms, [
    { platform: 'android', up: 1, down: 2 },
    { platform: 'ios', up: 1, down: 0 },
  ]);
});

test('designTally without platforms gives no split, and caps the comments at five', () => {
  const items = parseFeedbackResponse({
    items: Array.from({ length: 7 }, (_, i) => vote(`v${i}`, 'up', `2026-11-0${i + 1}T08:00:00Z`, { message: `n${i}` })),
    total: 7,
    summary: { total: 7, open: 7, open_requests: 0, resolved: 0, last_7_days: 7, by_category: { design: 7 } },
  }).items;
  const t = designTally(items, 7);
  assert.equal(t.platforms, null);
  assert.deepEqual(t.comments.map((c) => c.id), ['v6', 'v5', 'v4', 'v3', 'v2']);
  assert.deepEqual(designTally([], 0), { up: 0, down: 0, votes: 0, total: 0, comments: [], platforms: null });
});
