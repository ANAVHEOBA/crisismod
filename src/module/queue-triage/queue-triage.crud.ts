import { readJson, writeJson } from '../../config/store';
import { reddit } from '@devvit/web/server';
import { isT1, isT3 } from '@devvit/shared-types/tid.js';
import type { AppRequestContext } from '../../config/request-context';
import { getShieldModeConfig } from '../shield-mode/shield-mode.crud';
import type {
  QueueActionLog,
  QueueActionPayload,
  QueueConfidence,
  QueueItem,
  QueueItemStatus,
  QueuePriority,
  QueueRecommendedAction,
  QueueScoreInput,
  QueueSummary,
} from './queue-triage.interface';

const itemsKey = (subredditId: string) => `queue-triage:items:${subredditId}`;
const auditKey = (subredditId: string) => `queue-triage:audit:${subredditId}`;

const now = () => new Date().toISOString();
const localCurlTestMode = process.env.LOCAL_CURL_TEST === '1';

const uniq = <T>(values: T[]) => [...new Set(values)];

const sortItems = (items: QueueItem[]) =>
  [...items].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return right.createdAt.localeCompare(left.createdAt);
  });

const getPriority = (score: number): QueuePriority => {
  if (score >= 80) {
    return 'P0';
  }

  if (score >= 55) {
    return 'P1';
  }

  if (score >= 30) {
    return 'P2';
  }

  if (score >= 12) {
    return 'P3';
  }

  return 'Watch';
};

const getConfidence = (score: number): QueueConfidence => {
  if (score >= 70) {
    return 'high';
  }

  if (score >= 35) {
    return 'medium';
  }

  return 'low';
};

const getRecommendedAction = (
  priority: QueuePriority,
  input: QueueScoreInput
): QueueRecommendedAction => {
  if (priority === 'P0') {
    return input.containsLink || input.repeatedSimilarComments > 2
      ? 'remove'
      : 'escalate';
  }

  if (priority === 'P1') {
    return input.threadLocked ? 'lock' : 'remove';
  }

  if (priority === 'P2') {
    return 'watch';
  }

  if (priority === 'P3') {
    return 'approve';
  }

  return 'watch';
};

const buildRationale = (input: QueueScoreInput) => {
  const reasons: string[] = [];

  if (input.reportCount >= 5) {
    reasons.push(`High report volume (${input.reportCount}).`);
  }

  if (input.accountAgeDays <= 7) {
    reasons.push(`New account (${input.accountAgeDays} day(s) old).`);
  }

  if (input.subredditKarma <= 10) {
    reasons.push(`Low subreddit karma (${input.subredditKarma}).`);
  }

  if (input.containsLink) {
    reasons.push('Contains a link.');
  }

  if (input.commentVelocity >= 15) {
    reasons.push(`High velocity (${input.commentVelocity} comments/hour).`);
  }

  if (input.controversialKeywords.length > 0) {
    reasons.push(
      `Keyword hits: ${input.controversialKeywords.slice(0, 3).join(', ')}.`
    );
  }

  if (input.repeatedSimilarComments > 0) {
    reasons.push(
      `Repeated similar comments detected (${input.repeatedSimilarComments}).`
    );
  }

  if (input.priorIncidentRemovals > 0) {
    reasons.push(
      `Prior incident removals (${input.priorIncidentRemovals}) increased risk.`
    );
  }

  if (reasons.length === 0) {
    reasons.push('No strong risk signals detected.');
  }

  return reasons;
};

const deriveLabels = (
  input: QueueScoreInput,
  priority: QueuePriority
) => {
  const labels = [...(input.labels ?? [])];

  if (input.accountAgeDays <= 7) {
    labels.push('new-account');
  }

  if (input.subredditKarma <= 10) {
    labels.push('low-karma');
  }

  if (input.containsLink) {
    labels.push('has-link');
  }

  if (input.controversialKeywords.length > 0) {
    labels.push('keyword-hit');
  }

  if (input.reportCount >= 5) {
    labels.push('report-surge');
  }

  if (priority === 'P0') {
    labels.push('raid-risk');
  }

  if (input.source && input.source !== 'manual') {
    labels.push(input.source.replace(/_/g, '-'));
  }

  return uniq(labels);
};

const buildSuggestedRule = (
  subredditRules: string[],
  strictRules: string[],
  input: QueueScoreInput
) => {
  const haystack = [
    input.contentSummary,
    input.reportReasons.join(' '),
    input.controversialKeywords.join(' '),
  ]
    .join(' ')
    .toLowerCase();

  const matchedRule = [...strictRules, ...subredditRules].find((rule) =>
    haystack.includes(rule.toLowerCase())
  );

  return matchedRule ?? input.reportReasons[0] ?? strictRules[0] ?? subredditRules[0] ?? null;
};

const buildRemovalReason = (
  suggestedRule: string | null,
  rationale: string[]
) => {
  if (!suggestedRule) {
    return `Removed for moderator review. Signals: ${rationale[0] ?? 'Needs review.'}`;
  }

  return `Likely ${suggestedRule}. Supporting evidence: ${rationale
    .slice(0, 2)
    .join(' ')}`;
};

const calculateScore = (input: QueueScoreInput) => {
  let score = 0;

  score += input.reportCount * 10;
  score += Math.max(0, 14 - input.accountAgeDays) * 2;
  score += input.subredditKarma < 0 ? 10 : input.subredditKarma < 10 ? 6 : 0;
  score += input.containsLink ? 12 : 0;
  score += Math.min(input.commentVelocity, 20) * 2;
  score += input.controversialKeywords.length * 8;
  score += input.repeatedSimilarComments * 9;
  score += input.threadLocked ? 4 : 0;
  score += input.priorIncidentRemovals * 7;

  return score;
};

const mapActionToStatus = (
  action: QueueRecommendedAction
): QueueItemStatus => {
  switch (action) {
    case 'approve':
      return 'approved';
    case 'remove':
      return 'removed';
    case 'lock':
      return 'locked';
    case 'escalate':
      return 'escalated';
    case 'watch':
      return 'watching';
  }
};

const mergeScoreInput = (
  existingItem: QueueItem | undefined,
  input: QueueScoreInput
): QueueScoreInput => ({
  targetId: input.targetId,
  targetPermalink:
    input.targetPermalink ?? existingItem?.targetPermalink ?? null,
  source: input.source ?? existingItem?.source ?? 'manual',
  kind: input.kind,
  author: input.author,
  contentSummary: input.contentSummary,
  reportCount: Math.max(input.reportCount, existingItem?.reportCount ?? 0),
  reportReasons: uniq([
    ...(existingItem?.reportReasons ?? []),
    ...input.reportReasons,
  ]),
  accountAgeDays: input.accountAgeDays,
  subredditKarma: input.subredditKarma,
  containsLink: input.containsLink || existingItem?.containsLink || false,
  commentVelocity: Math.max(
    input.commentVelocity,
    existingItem?.commentVelocity ?? 0
  ),
  controversialKeywords: uniq([
    ...(existingItem?.controversialKeywords ?? []),
    ...input.controversialKeywords,
  ]),
  repeatedSimilarComments: Math.max(
    input.repeatedSimilarComments,
    existingItem?.repeatedSimilarComments ?? 0
  ),
  threadLocked: input.threadLocked || existingItem?.threadLocked || false,
  priorIncidentRemovals: Math.max(
    input.priorIncidentRemovals,
    existingItem?.priorIncidentRemovals ?? 0
  ),
  labels: uniq([...(existingItem?.labels ?? []), ...(input.labels ?? [])]),
});

const buildQueueItem = (
  subredditRules: string[],
  strictRules: string[],
  requestContext: AppRequestContext,
  input: QueueScoreInput,
  existingItem?: QueueItem
): QueueItem => {
  const normalizedInput = mergeScoreInput(existingItem, input);
  const score = calculateScore(normalizedInput);
  const priority = getPriority(score);
  const rationale = buildRationale(normalizedInput);
  const suggestedRule = buildSuggestedRule(
    subredditRules,
    strictRules,
    normalizedInput
  );
  const createdAt = existingItem?.createdAt ?? now();

  return {
    id:
      existingItem?.id ??
      `queue-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    subredditId: requestContext.subredditId,
    subredditName: requestContext.subredditName,
    source: normalizedInput.source ?? 'manual',
    targetPermalink: normalizedInput.targetPermalink ?? null,
    priority,
    score,
    confidence: getConfidence(score),
    labels: deriveLabels(normalizedInput, priority),
    suggestedRule,
    removalReason: buildRemovalReason(suggestedRule, rationale),
    recommendedAction: getRecommendedAction(priority, normalizedInput),
    rationale,
    status: existingItem?.status ?? 'pending',
    createdAt,
    updatedAt: now(),
    ...normalizedInput,
  };
};

const appendAuditLog = async (
  subredditId: string,
  log: QueueActionLog
) => {
  const logs = await readJson<QueueActionLog[]>(auditKey(subredditId), []);
  await writeJson(auditKey(subredditId), [log, ...logs].slice(0, 100));
};

export const getQueueItems = async (subredditId: string) => {
  const items = await readJson<QueueItem[]>(itemsKey(subredditId), []);
  return sortItems(items);
};

export const getQueueAuditLogs = async (subredditId: string, limit: number) => {
  const logs = await readJson<QueueActionLog[]>(auditKey(subredditId), []);
  return logs.slice(0, limit);
};

export const getQueueSummary = async (
  subredditId: string
): Promise<QueueSummary> => {
  const items = await getQueueItems(subredditId);
  const itemsByPriority: Record<QueuePriority, number> = {
    P0: 0,
    P1: 0,
    P2: 0,
    P3: 0,
    Watch: 0,
  };

  let pendingItems = 0;
  let actionedItems = 0;
  let highRiskItems = 0;

  for (const item of items) {
    itemsByPriority[item.priority] += 1;
    if (item.status === 'pending') {
      pendingItems += 1;
    } else {
      actionedItems += 1;
    }

    if (item.priority === 'P0' || item.priority === 'P1') {
      highRiskItems += 1;
    }
  }

  return {
    totalItems: items.length,
    pendingItems,
    highRiskItems,
    actionedItems,
    itemsByPriority,
  };
};

export const scoreQueueItem = async (
  requestContext: AppRequestContext,
  input: QueueScoreInput
) => {
  const items = await getQueueItems(requestContext.subredditId);
  const existingItem = items.find((item) => item.targetId === input.targetId);
  const config = await getShieldModeConfig(requestContext.subredditId);
  const nextItem = buildQueueItem(
    config.subredditRules,
    config.strictRules,
    requestContext,
    input,
    existingItem
  );
  const nextItems = existingItem
    ? items.map((item) => (item.id === nextItem.id ? nextItem : item))
    : [nextItem, ...items];
  await writeJson(itemsKey(requestContext.subredditId), sortItems(nextItems));
  return nextItem;
};

const performRedditAction = async (
  item: QueueItem,
  action: QueueRecommendedAction
) => {
  if (localCurlTestMode || (!isT1(item.targetId) && !isT3(item.targetId))) {
    return 'simulated';
  }

  switch (action) {
    case 'approve':
      await reddit.approve(item.targetId);
      return 'approved-live';
    case 'remove':
      await reddit.remove(item.targetId, false);
      return 'removed-live';
    case 'lock':
      if (isT3(item.targetId)) {
        const post = await reddit.getPostById(item.targetId);
        if (!post.locked) {
          await post.lock();
        }
      } else {
        const comment = await reddit.getCommentById(item.targetId);
        if (!comment.locked) {
          await comment.lock();
        }
      }
      return 'locked-live';
    default:
      return 'recorded-only';
  }
};

export const applyQueueAction = async (
  requestContext: AppRequestContext,
  payload: QueueActionPayload
) => {
  const items = await getQueueItems(requestContext.subredditId);
  const nextItems = items.map((item) =>
    item.id === payload.itemId
      ? {
          ...item,
          status: mapActionToStatus(payload.action),
          recommendedAction: payload.action,
          updatedAt: now(),
        }
      : item
  );

  const targetItem = nextItems.find((item) => item.id === payload.itemId);
  if (!targetItem) {
    return null;
  }

  const moderationResult = await performRedditAction(targetItem, payload.action);

  await writeJson(itemsKey(requestContext.subredditId), nextItems);
  await appendAuditLog(requestContext.subredditId, {
    id: `queue-action-${Date.now()}`,
    itemId: payload.itemId,
    action: payload.action,
    moderator: requestContext.moderatorUsername,
    note:
      [payload.note, `Moderation result: ${moderationResult}`]
        .filter(Boolean)
        .join(' | ') || null,
    createdAt: now(),
  });

  return targetItem;
};
