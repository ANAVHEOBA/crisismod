import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateLimit,
  validateQueueActionPayload,
  validateQueueScorePayload,
} from './queue-triage.schema.ts';

void test('validateQueueScorePayload accepts valid queue items', () => {
  const result = validateQueueScorePayload({
    targetId: 't3_post',
    targetPermalink: ' /r/test/comments/post ',
    source: 'post_report',
    kind: 'post',
    author: ' crisis_mod_user ',
    contentSummary: ' Needs review ',
    reportCount: 6,
    reportReasons: [' spam ', '', 'brigading'],
    accountAgeDays: 12,
    subredditKarma: 5,
    containsLink: true,
    commentVelocity: 3,
    controversialKeywords: [' crisis ', ' ', 'raid'],
    repeatedSimilarComments: 2,
    threadLocked: false,
    priorIncidentRemovals: 1,
    labels: [' urgent ', '', 'watch'],
  });

  if (!result.ok) {
    assert.fail(result.errors.join(', '));
  }

  assert.deepEqual(result.data, {
    targetId: 't3_post',
    targetPermalink: '/r/test/comments/post',
    source: 'post_report',
    kind: 'post',
    author: 'crisis_mod_user',
    contentSummary: 'Needs review',
    reportCount: 6,
    reportReasons: ['spam', 'brigading'],
    accountAgeDays: 12,
    subredditKarma: 5,
    containsLink: true,
    commentVelocity: 3,
    controversialKeywords: ['crisis', 'raid'],
    repeatedSimilarComments: 2,
    threadLocked: false,
    priorIncidentRemovals: 1,
    labels: ['urgent', 'watch'],
  });
});

void test('validateQueueScorePayload rejects malformed queue items', () => {
  const result = validateQueueScorePayload({
    targetId: '',
    kind: 'other',
    author: '',
    contentSummary: '',
    reportCount: 'six',
    reportReasons: 'spam',
    accountAgeDays: 1,
    subredditKarma: 1,
    containsLink: 'yes',
    commentVelocity: 0,
    controversialKeywords: [],
    repeatedSimilarComments: 0,
    threadLocked: false,
    priorIncidentRemovals: 0,
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    assert.fail('Expected validation failure');
  }

  assert.match(result.errors.join(' '), /targetId/);
  assert.match(result.errors.join(' '), /kind/);
  assert.match(result.errors.join(' '), /reportCount/);
  assert.match(result.errors.join(' '), /reportReasons/);
  assert.match(result.errors.join(' '), /containsLink/);
});

void test('validateQueueActionPayload normalizes valid actions', () => {
  const result = validateQueueActionPayload({
    itemId: ' item-123 ',
    action: 'remove',
    note: ' duplicate content ',
  });

  if (!result.ok) {
    assert.fail(result.errors.join(', '));
  }

  assert.deepEqual(result.data, {
    itemId: 'item-123',
    action: 'remove',
    note: 'duplicate content',
  });
});

void test('validateLimit uses defaults and caps large queue limits', () => {
  assert.equal(validateLimit(undefined), 20);
  assert.equal(validateLimit('0'), 20);
  assert.equal(validateLimit('250'), 100);
});
