import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateActivateShieldModePayload,
  validateAuditLimit,
  validateDeactivateShieldModePayload,
  validateShieldModeConfigPatch,
} from './shield-mode.schema.ts';

void test('validateShieldModeConfigPatch rejects empty patches', () => {
  const result = validateShieldModeConfigPatch({});

  assert.equal(result.ok, false);
  if (result.ok) {
    assert.fail('Expected validation failure');
  }

  assert.match(result.errors.join(' '), /At least one config field/);
});

void test('validateShieldModeConfigPatch accepts normalized config fields', () => {
  const result = validateShieldModeConfigPatch({
    presetName: ' Crisis Lockdown ',
    defaultDurationHours: 6,
    subredditRules: [' rule 1 ', '', 'rule 2'],
    minAccountAgeDays: 14,
    minSubredditKarma: 25,
    holdLinks: true,
    triggerPhrases: ['urgent', ' raid '],
    strictRules: ['brigading'],
    appealResponseTemplate: ' Use modmail. ',
    alertWebhookUrl: null,
  });

  if (!result.ok) {
    assert.fail(result.errors.join(', '));
  }

  assert.deepEqual(result.data, {
    presetName: 'Crisis Lockdown',
    defaultDurationHours: 6,
    subredditRules: ['rule 1', 'rule 2'],
    minAccountAgeDays: 14,
    minSubredditKarma: 25,
    holdLinks: true,
    triggerPhrases: ['urgent', 'raid'],
    strictRules: ['brigading'],
    appealResponseTemplate: 'Use modmail.',
    alertWebhookUrl: null,
  });
});

void test('validateActivateShieldModePayload validates duration and overrides', () => {
  const result = validateActivateShieldModePayload({
    durationHours: 3,
    reason: ' spike detected ',
    configOverride: {
      minAccountAgeDays: 30,
      triggerPhrases: ['brigade'],
    },
  });

  if (!result.ok) {
    assert.fail(result.errors.join(', '));
  }

  assert.deepEqual(result.data, {
    durationHours: 3,
    reason: 'spike detected',
    configOverride: {
      minAccountAgeDays: 30,
      triggerPhrases: ['brigade'],
    },
  });
});

void test('validateDeactivateShieldModePayload rejects blank reasons', () => {
  const result = validateDeactivateShieldModePayload({
    reason: '   ',
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    assert.fail('Expected validation failure');
  }

  assert.match(result.errors.join(' '), /reason must be a non-empty string/);
});

void test('validateAuditLimit uses defaults and caps large values', () => {
  assert.equal(validateAuditLimit(undefined), 20);
  assert.equal(validateAuditLimit('-4'), 20);
  assert.equal(validateAuditLimit('1000'), 100);
});
