import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deviceLine, feedbackErrorMessage, parseFeedbackResponse } from '../src/data/feedback-report.ts';

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
  summary: { total: 3, open: 2, resolved: 1, last_7_days: 2, by_category: { bug: 1, compliment: 2 } },
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
    total: 3, open: 2, resolved: 1, last7Days: 2,
    byCategory: { bug: 1, suggestion: 0, compliment: 2, charger_data: 0, other: 0 },
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
