import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateGenerateWeeklyReportPayload,
  validateLimit,
  validatePublishWeeklyReportPayload,
} from './weekly-report.schema.ts';

void test('validateGenerateWeeklyReportPayload treats blank labels as omitted', () => {
  const result = validateGenerateWeeklyReportPayload({
    periodLabel: '   ',
  });

  if (!result.ok) {
    assert.fail(result.errors.join(', '));
  }

  assert.deepEqual(result.data, {});
});

void test('validateGenerateWeeklyReportPayload preserves a trimmed label', () => {
  const result = validateGenerateWeeklyReportPayload({
    periodLabel: ' Week of May 12 ',
  });

  if (!result.ok) {
    assert.fail(result.errors.join(', '));
  }

  assert.deepEqual(result.data, {
    periodLabel: 'Week of May 12',
  });
});

void test('validatePublishWeeklyReportPayload requires a report id', () => {
  const result = validatePublishWeeklyReportPayload({
    reportId: ' report-42 ',
  });

  if (!result.ok) {
    assert.fail(result.errors.join(', '));
  }

  assert.deepEqual(result.data, {
    reportId: 'report-42',
  });
});

void test('validateLimit uses defaults and caps large weekly report limits', () => {
  assert.equal(validateLimit(undefined), 10);
  assert.equal(validateLimit('0'), 10);
  assert.equal(validateLimit('200'), 50);
});
