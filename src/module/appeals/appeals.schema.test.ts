import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateAppealIntakePayload,
  validateAppealResolvePayload,
} from './appeals.schema.ts';

test('validateAppealIntakePayload normalizes a valid appeal payload', () => {
  const result = validateAppealIntakePayload({
    username: ' crisis_user ',
    contentSummary: ' Removed post summary ',
    citedRule: ' Rule 2 ',
    removalMessage: ' Removed for spam ',
    userAppeal: ' I fixed it. ',
    priorOffenses: 0,
    sourceRef: ' modmail:42 ',
  });

  if (!result.ok) {
    assert.fail(result.errors.join(', '));
  }

  assert.deepEqual(result.data, {
    username: 'crisis_user',
    contentSummary: 'Removed post summary',
    citedRule: 'Rule 2',
    removalMessage: 'Removed for spam',
    userAppeal: 'I fixed it.',
    priorOffenses: 0,
    sourceRef: 'modmail:42',
  });
});

test('validateAppealIntakePayload rejects malformed appeals', () => {
  const result = validateAppealIntakePayload({
    username: '',
    contentSummary: '',
    citedRule: '',
    removalMessage: '',
    userAppeal: '',
    priorOffenses: -1,
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    assert.fail('Expected validation failure');
  }

  assert.match(result.errors.join(' '), /username/);
  assert.match(result.errors.join(' '), /contentSummary/);
  assert.match(result.errors.join(' '), /citedRule/);
  assert.match(result.errors.join(' '), /removalMessage/);
  assert.match(result.errors.join(' '), /userAppeal/);
  assert.match(result.errors.join(' '), /priorOffenses/);
});

test('validateAppealResolvePayload trims valid resolutions', () => {
  const result = validateAppealResolvePayload({
    appealId: ' appeal-1 ',
    outcome: 'reverse',
    moderatorNote: ' user fixed the post ',
    responseOverride: ' Restored. ',
  });

  if (!result.ok) {
    assert.fail(result.errors.join(', '));
  }

  assert.deepEqual(result.data, {
    appealId: 'appeal-1',
    outcome: 'reverse',
    moderatorNote: 'user fixed the post',
    responseOverride: 'Restored.',
  });
});

test('validateAppealResolvePayload rejects blank optional fields', () => {
  const result = validateAppealResolvePayload({
    appealId: 'appeal-2',
    outcome: 'uphold',
    moderatorNote: '   ',
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    assert.fail('Expected validation failure');
  }

  assert.match(result.errors.join(' '), /moderatorNote/);
});
