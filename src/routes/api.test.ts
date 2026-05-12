import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { Hono } from 'hono';

process.env.LOCAL_CURL_TEST = '1';

const { api } = await import('./api.ts');
const { resetStoreForTests } = await import('../config/store.ts');

const headers = {
  'content-type': 'application/json',
  'x-subreddit-id': 't5_crisismod_demo',
  'x-subreddit-name': 'crisismod_demo',
  'x-moderator-username': 'mod_alice',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const expectRecord = (value: unknown, label: string) => {
  assert.ok(isRecord(value), `${label} should be an object.`);
  return value;
};

const getResponseBody = async (response: Response) =>
  expectRecord(await response.json(), 'response body');

const getSuccessData = async (response: Response) => {
  const body = await getResponseBody(response);
  assert.equal(body.success, true);
  return expectRecord(body.data, 'response data');
};

const getErrorBody = async (response: Response) => {
  const body = await getResponseBody(response);
  assert.equal(body.success, false);
  assert.ok(Array.isArray(body.errors), 'errors should be an array.');
  return body;
};

const createApiApp = () => new Hono().route('/api', api);

beforeEach(() => {
  resetStoreForTests();
});

test('api registry mounts all moderation modules behind /api', async () => {
  const app = createApiApp();

  const statusResponse = await app.request('/api/shield-mode/status', {
    headers,
  });
  assert.equal(statusResponse.status, 200);
  const statusData = await getSuccessData(statusResponse);
  const statusSession = expectRecord(statusData.session, 'shield mode session');
  assert.equal(statusSession.status, 'inactive');

  const appealResponse = await app.request('/api/appeals/intake', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      username: 'appealing_user',
      contentSummary: 'Removed heated comment',
      citedRule: 'Be civil',
      removalMessage: 'Removed for harassment',
      userAppeal: 'I fixed it and meant no harm.',
      priorOffenses: 0,
      sourceRef: 'modmail:123',
    }),
  });
  assert.equal(appealResponse.status, 200);
  const appealData = await getSuccessData(appealResponse);
  const appeal = expectRecord(appealData.appeal, 'appeal');
  assert.equal(appeal.appealType, 'valid_correction');
  assert.equal(appeal.recommendedOutcome, 'reverse');

  const queueScoreResponse = await app.request('/api/queue-triage/score', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      targetId: 'manual-item-1',
      targetPermalink: '/r/test/comments/manual-item-1',
      source: 'manual',
      kind: 'comment',
      author: 'new_user',
      contentSummary: 'Join discord.gg/raid now',
      reportCount: 6,
      reportReasons: ['brigading'],
      accountAgeDays: 1,
      subredditKarma: 0,
      containsLink: true,
      commentVelocity: 18,
      controversialKeywords: ['raid'],
      repeatedSimilarComments: 2,
      threadLocked: false,
      priorIncidentRemovals: 1,
      labels: ['manual-triage'],
    }),
  });
  assert.equal(queueScoreResponse.status, 200);
  const queueScoreData = await getSuccessData(queueScoreResponse);
  const queueItem = expectRecord(queueScoreData.item, 'queue item');
  assert.equal(queueItem.priority, 'P0');
  assert.equal(queueItem.recommendedAction, 'remove');

  const queueSummaryResponse = await app.request('/api/queue-triage/summary', {
    headers,
  });
  assert.equal(queueSummaryResponse.status, 200);
  const queueSummaryData = await getSuccessData(queueSummaryResponse);
  const queueSummary = expectRecord(queueSummaryData.summary, 'queue summary');
  assert.equal(queueSummary.totalItems, 1);
  assert.equal(queueSummary.highRiskItems, 1);

  const weeklyReportResponse = await app.request('/api/weekly-report/generate', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      periodLabel: 'Week of May 12',
    }),
  });
  assert.equal(weeklyReportResponse.status, 200);
  const weeklyReportData = await getSuccessData(weeklyReportResponse);
  const report = expectRecord(weeklyReportData.report, 'weekly report');
  assert.equal(report.periodLabel, 'Week of May 12');
  assert.equal(report.triagedItems, 1);
  assert.equal(report.appealsHandled, 1);
});

test('api responses use a consistent error envelope', async () => {
  const app = createApiApp();

  const invalidShieldResponse = await app.request('/api/shield-mode/activate', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      durationHours: 2,
    }),
  });
  assert.equal(invalidShieldResponse.status, 400);
  const shieldErrorBody = await getErrorBody(invalidShieldResponse);
  assert.match(String(shieldErrorBody.errors[0]), /durationHours/);

  const missingAppealResponse = await app.request('/api/appeals/resolve', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      appealId: 'missing-appeal',
      outcome: 'uphold',
    }),
  });
  assert.equal(missingAppealResponse.status, 404);
  const missingAppealBody = await getErrorBody(missingAppealResponse);
  assert.deepEqual(missingAppealBody.errors, ['Appeal not found.']);
});
