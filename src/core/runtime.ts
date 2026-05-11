import { reddit } from '@devvit/web/server';
import type {
  OnAutomoderatorFilterCommentRequest,
  OnAutomoderatorFilterPostRequest,
  OnCommentReportRequest,
  OnCommentSubmitRequest,
  OnModMailRequest,
  OnPostReportRequest,
  OnPostSubmitRequest,
} from '@devvit/web/shared';
import { isT1, isT2, isT3 } from '@devvit/shared-types/tid.js';
import {
  type AppRequestContext,
  makeRequestContext,
} from '../config/request-context';
import { intakeAppeal } from '../module/appeals/appeals.crud';
import {
  applyQueueAction,
  getQueueItems,
  scoreQueueItem,
} from '../module/queue-triage/queue-triage.crud';
import type {
  QueueItemSource,
  QueueScoreInput,
} from '../module/queue-triage/queue-triage.interface';
import {
  getShieldModeConfig,
  getShieldModeSession,
  recordShieldModeIntervention,
} from '../module/shield-mode/shield-mode.crud';

const linkPattern = /(https?:\/\/|www\.|discord\.gg\/)/i;

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();

const truncate = (value: string, maxLength: number) =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;

const containsLink = (value: string, urls: string[]) =>
  linkPattern.test(value) || urls.length > 0;

const extractTriggerHits = (content: string, triggerPhrases: string[]) =>
  triggerPhrases.filter((phrase) =>
    content.toLowerCase().includes(phrase.toLowerCase())
  );

const getModeratorSystemContext = (
  subredditId: string,
  subredditName: string
) => makeRequestContext(subredditId, subredditName, 'crisismod_system');

const getAuthorSignals = async (
  authorId: string | undefined,
  authorName: string
) => {
  let accountAgeDays = 365;
  let subredditKarma = 0;

  if (authorId && isT2(authorId)) {
    try {
      const user = await reddit.getUserById(authorId);
      if (user) {
        accountAgeDays = Math.max(
          0,
          Math.floor((Date.now() - user.createdAt.getTime()) / (24 * 60 * 60 * 1000))
        );
      }
    } catch (error) {
      console.warn(`Failed to fetch user age for ${authorId}.`, error);
    }
  }

  if (authorName) {
    try {
      const karma = await reddit.getUserKarmaFromCurrentSubreddit(authorName);
      subredditKarma = (karma.fromComments ?? 0) + (karma.fromPosts ?? 0);
    } catch (error) {
      console.warn(`Failed to fetch subreddit karma for ${authorName}.`, error);
    }
  }

  return {
    accountAgeDays,
    subredditKarma,
  };
};

const getAuthorHistorySignals = async (
  requestContext: AppRequestContext,
  author: string,
  contentSummary: string,
  incidentStartedAt: string | null
) => {
  const items = await getQueueItems(requestContext.subredditId);
  const normalizedSummary = normalizeText(contentSummary).toLowerCase();

  let repeatedSimilarComments = 0;
  let priorIncidentRemovals = 0;

  for (const item of items) {
    if (item.author !== author) {
      continue;
    }

    if (
      item.kind === 'comment' &&
      normalizeText(item.contentSummary).toLowerCase() === normalizedSummary
    ) {
      repeatedSimilarComments += 1;
    }

    if (
      ['removed', 'locked', 'escalated'].includes(item.status) &&
      (!incidentStartedAt || item.updatedAt >= incidentStartedAt)
    ) {
      priorIncidentRemovals += 1;
    }
  }

  return {
    repeatedSimilarComments,
    priorIncidentRemovals,
  };
};

const buildQueueInput = async (
  requestContext: AppRequestContext,
  source: QueueItemSource,
  input: {
    targetId: string;
    targetPermalink?: string | null | undefined;
    kind: 'post' | 'comment';
    authorId?: string | undefined;
    authorName: string;
    contentSummary: string;
    reportCount: number;
    reportReasons: string[];
    contentForMatching: string;
    mediaUrls: string[];
    threadLocked: boolean;
    commentVelocity: number;
    extraLabels?: string[] | undefined;
  }
): Promise<QueueScoreInput> => {
  const config = await getShieldModeConfig(requestContext.subredditId);
  const session = await getShieldModeSession(
    requestContext.subredditId,
    requestContext.subredditName
  );
  const triggerHits = extractTriggerHits(
    input.contentForMatching,
    config.triggerPhrases
  );
  const [authorSignals, historySignals] = await Promise.all([
    getAuthorSignals(input.authorId, input.authorName),
    getAuthorHistorySignals(
      requestContext,
      input.authorName,
      input.contentSummary,
      session.activatedAt
    ),
  ]);

  return {
    targetId: input.targetId,
    targetPermalink: input.targetPermalink ?? null,
    source,
    kind: input.kind,
    author: input.authorName,
    contentSummary: truncate(normalizeText(input.contentSummary), 280),
    reportCount: input.reportCount,
    reportReasons: input.reportReasons,
    accountAgeDays: authorSignals.accountAgeDays,
    subredditKarma: authorSignals.subredditKarma,
    containsLink: containsLink(input.contentForMatching, input.mediaUrls),
    commentVelocity: input.commentVelocity,
    controversialKeywords: triggerHits,
    repeatedSimilarComments: historySignals.repeatedSimilarComments,
    threadLocked: input.threadLocked,
    priorIncidentRemovals: historySignals.priorIncidentRemovals,
    labels: input.extraLabels ?? [],
  };
};

const getShieldHoldReasons = (
  config: Awaited<ReturnType<typeof getShieldModeConfig>>,
  queueInput: QueueScoreInput
) => {
  const holdReasons: string[] = [];

  if (queueInput.accountAgeDays < config.minAccountAgeDays) {
    holdReasons.push('new account threshold hit');
  }

  if (queueInput.subredditKarma < config.minSubredditKarma) {
    holdReasons.push('low subreddit karma threshold hit');
  }

  if (config.holdLinks && queueInput.containsLink) {
    holdReasons.push('link policy hold');
  }

  if (queueInput.controversialKeywords.length > 0) {
    holdReasons.push(
      `trigger phrases: ${queueInput.controversialKeywords.join(', ')}`
    );
  }

  if (queueInput.reportCount >= 5) {
    holdReasons.push('high report volume');
  }

  return holdReasons;
};

const ingestQueueInput = async (
  requestContext: AppRequestContext,
  queueInput: QueueScoreInput,
  options?: {
    enforceShieldMode?: boolean;
    flaggedNote?: string;
  }
) => {
  const queuedItem = await scoreQueueItem(requestContext, queueInput);
  const session = await getShieldModeSession(
    requestContext.subredditId,
    requestContext.subredditName
  );

  if (session.status !== 'active') {
    return queuedItem;
  }

  const systemContext = getModeratorSystemContext(
    requestContext.subredditId,
    requestContext.subredditName
  );

  if (options?.flaggedNote) {
    await recordShieldModeIntervention(systemContext, 'flagged', options.flaggedNote);
  }

  if (options?.enforceShieldMode === false) {
    return queuedItem;
  }

  const config = session.configSnapshot ?? (await getShieldModeConfig(requestContext.subredditId));
  const holdReasons = getShieldHoldReasons(config, queueInput);
  if (holdReasons.length === 0) {
    return queuedItem;
  }

  const moderatedItem = await applyQueueAction(systemContext, {
    itemId: queuedItem.id,
    action: 'remove',
    note: `Shield Mode hold: ${holdReasons.join('; ')}`,
  });

  await recordShieldModeIntervention(
    systemContext,
    queueInput.kind === 'post' ? 'held_post' : 'held_comment',
    `Shield Mode held ${queueInput.targetId}: ${holdReasons.join('; ')}`
  );

  return moderatedItem ?? queuedItem;
};

export const triageTargetById = async (
  requestContext: AppRequestContext,
  targetId: string,
  note?: string | null
) => {
  if (isT3(targetId)) {
    const post = await reddit.getPostById(targetId);
    const queueInput = await buildQueueInput(requestContext, 'manual', {
      targetId: post.id,
      targetPermalink: post.permalink,
      kind: 'post',
      ...(post.authorId ? { authorId: post.authorId } : {}),
      authorName: post.authorName,
      contentSummary: `${post.title} ${post.body ?? ''}`.trim(),
      reportCount: 0,
      reportReasons: note ? [note] : [],
      contentForMatching: `${post.title} ${post.body ?? ''} ${post.url}`.trim(),
      mediaUrls: [],
      threadLocked: post.locked,
      commentVelocity: post.numberOfComments,
      extraLabels: note ? ['manual-note'] : ['manual-triage'],
    });

    return ingestQueueInput(requestContext, queueInput);
  }

  if (isT1(targetId)) {
    const comment = await reddit.getCommentById(targetId);
    const parentPost = await reddit.getPostById(comment.postId);
    const queueInput = await buildQueueInput(requestContext, 'manual', {
      targetId: comment.id,
      targetPermalink: comment.permalink,
      kind: 'comment',
      ...(comment.authorId ? { authorId: comment.authorId } : {}),
      authorName: comment.authorName,
      contentSummary: comment.body,
      reportCount: comment.numReports,
      reportReasons: note ? [note] : [],
      contentForMatching: comment.body,
      mediaUrls: [],
      threadLocked: parentPost.locked,
      commentVelocity: parentPost.numberOfComments,
      extraLabels: note ? ['manual-note'] : ['manual-triage'],
    });

    return ingestQueueInput(requestContext, queueInput);
  }

  throw new Error('Unsupported target ID for triage.');
};

export const handlePostSubmitEvent = async (input: OnPostSubmitRequest) => {
  const post = input.post;
  const subreddit = input.subreddit;
  if (!post || !subreddit) {
    return null;
  }

  const requestContext = makeRequestContext(
    subreddit.id,
    subreddit.name,
    'crisismod_system'
  );
  const queueInput = await buildQueueInput(requestContext, 'post_submit', {
    targetId: post.id,
    targetPermalink: post.permalink,
    kind: 'post',
    ...(input.author?.id ? { authorId: input.author.id } : {}),
    authorName: input.author?.name ?? 'unknown',
    contentSummary: `${post.title} ${post.selftext}`.trim(),
    reportCount: post.numReports,
    reportReasons: [],
    contentForMatching: `${post.title} ${post.selftext} ${post.url}`.trim(),
    mediaUrls: post.mediaUrls,
    threadLocked: post.isLocked,
    commentVelocity: post.numComments,
  });

  return ingestQueueInput(requestContext, queueInput);
};

export const handleCommentSubmitEvent = async (
  input: OnCommentSubmitRequest
) => {
  const comment = input.comment;
  const subreddit = input.subreddit;
  if (!comment || !subreddit) {
    return null;
  }

  const requestContext = makeRequestContext(
    subreddit.id,
    subreddit.name,
    'crisismod_system'
  );
  const queueInput = await buildQueueInput(requestContext, 'comment_submit', {
    targetId: comment.id,
    targetPermalink: comment.permalink,
    kind: 'comment',
    ...(input.author?.id ? { authorId: input.author.id } : {}),
    authorName: comment.author,
    contentSummary: comment.body,
    reportCount: comment.numReports,
    reportReasons: [],
    contentForMatching: comment.body,
    mediaUrls: comment.mediaUrls,
    threadLocked: input.post?.isLocked ?? false,
    commentVelocity: input.post?.numComments ?? 0,
  });

  return ingestQueueInput(requestContext, queueInput);
};

export const handlePostReportEvent = async (input: OnPostReportRequest) => {
  const post = input.post;
  const subreddit = input.subreddit;
  if (!post || !subreddit) {
    return null;
  }

  const requestContext = makeRequestContext(
    subreddit.id,
    subreddit.name,
    'crisismod_system'
  );
  const queueInput = await buildQueueInput(requestContext, 'post_report', {
    targetId: post.id,
    targetPermalink: post.permalink,
    kind: 'post',
    ...(post.authorId ? { authorId: post.authorId } : {}),
    authorName: 'unknown',
    contentSummary: `${post.title} ${post.selftext}`.trim(),
    reportCount: post.numReports,
    reportReasons: input.reason ? [input.reason] : [],
    contentForMatching: `${post.title} ${post.selftext} ${post.url}`.trim(),
    mediaUrls: post.mediaUrls,
    threadLocked: post.isLocked,
    commentVelocity: post.numComments,
    extraLabels: ['reported'],
  });

  return ingestQueueInput(requestContext, queueInput, {
    flaggedNote: `Post report received for ${post.id}: ${input.reason}`,
  });
};

export const handleCommentReportEvent = async (
  input: OnCommentReportRequest
) => {
  const comment = input.comment;
  const subreddit = input.subreddit;
  if (!comment || !subreddit) {
    return null;
  }

  const requestContext = makeRequestContext(
    subreddit.id,
    subreddit.name,
    'crisismod_system'
  );
  const queueInput = await buildQueueInput(requestContext, 'comment_report', {
    targetId: comment.id,
    targetPermalink: comment.permalink,
    kind: 'comment',
    authorName: comment.author,
    contentSummary: comment.body,
    reportCount: comment.numReports,
    reportReasons: input.reason ? [input.reason] : [],
    contentForMatching: comment.body,
    mediaUrls: comment.mediaUrls,
    threadLocked: false,
    commentVelocity: 0,
    extraLabels: ['reported'],
  });

  return ingestQueueInput(requestContext, queueInput, {
    flaggedNote: `Comment report received for ${comment.id}: ${input.reason}`,
  });
};

export const handleAutomodPostEvent = async (
  input: OnAutomoderatorFilterPostRequest
) => {
  const post = input.post;
  const subreddit = input.subreddit;
  if (!post || !subreddit) {
    return null;
  }

  const requestContext = makeRequestContext(
    subreddit.id,
    subreddit.name,
    'crisismod_system'
  );
  const queueInput = await buildQueueInput(requestContext, 'automod_post', {
    targetId: post.id,
    targetPermalink: post.permalink,
    kind: 'post',
    authorName: input.author,
    contentSummary: `${post.title} ${post.selftext}`.trim(),
    reportCount: Math.max(post.numReports, 1),
    reportReasons: input.reason ? [input.reason] : ['AutoModerator filter'],
    contentForMatching: `${post.title} ${post.selftext} ${post.url}`.trim(),
    mediaUrls: post.mediaUrls,
    threadLocked: post.isLocked,
    commentVelocity: post.numComments,
    extraLabels: ['automod-filtered'],
  });

  return ingestQueueInput(requestContext, queueInput, {
    enforceShieldMode: false,
    flaggedNote: `AutoModerator filtered post ${post.id}: ${input.reason}`,
  });
};

export const handleAutomodCommentEvent = async (
  input: OnAutomoderatorFilterCommentRequest
) => {
  const comment = input.comment;
  const subreddit = input.subreddit;
  if (!comment || !subreddit) {
    return null;
  }

  const requestContext = makeRequestContext(
    subreddit.id,
    subreddit.name,
    'crisismod_system'
  );
  const queueInput = await buildQueueInput(requestContext, 'automod_comment', {
    targetId: comment.id,
    targetPermalink: comment.permalink,
    kind: 'comment',
    authorName: input.author,
    contentSummary: comment.body,
    reportCount: Math.max(comment.numReports, 1),
    reportReasons: input.reason ? [input.reason] : ['AutoModerator filter'],
    contentForMatching: comment.body,
    mediaUrls: comment.mediaUrls,
    threadLocked: false,
    commentVelocity: 0,
    extraLabels: ['automod-filtered'],
  });

  return ingestQueueInput(requestContext, queueInput, {
    enforceShieldMode: false,
    flaggedNote: `AutoModerator filtered comment ${comment.id}: ${input.reason}`,
  });
};

export const handleModMailEvent = async (input: OnModMailRequest) => {
  const subreddit = input.conversationSubreddit ?? input.destinationSubreddit;
  if (!subreddit) {
    return null;
  }

  const requestContext = makeRequestContext(
    subreddit.id,
    subreddit.name,
    'crisismod_system'
  );

  let subject = `Modmail conversation ${input.conversationId}`;
  let userAppeal =
    'Appeal received through modmail. Open the conversation for full context.';

  try {
    const conversationResponse = await reddit.modMail.getConversation({
      conversationId: input.conversationId,
      markRead: false,
    });

    subject = conversationResponse.conversation?.subject ?? subject;
    const latestMessage = Object.values(
      conversationResponse.conversation?.messages ?? {}
    )
      .sort((left, right) =>
        Date.parse(right.date ?? '') - Date.parse(left.date ?? '')
      )
      .find((message) => Boolean(message.bodyMarkdown || message.body));

    if (latestMessage) {
      userAppeal = normalizeText(
        latestMessage.bodyMarkdown ?? latestMessage.body ?? userAppeal
      );
    }
  } catch (error) {
    console.warn(
      `Failed to fetch modmail conversation ${input.conversationId}.`,
      error
    );
  }

  return intakeAppeal(requestContext, {
    username: input.messageAuthor?.name ?? 'unknown-user',
    contentSummary: subject,
    citedRule: 'Needs moderator review',
    removalMessage: 'Appeal received through modmail.',
    userAppeal,
    priorOffenses: 0,
    sourceRef: `modmail:${input.conversationId}`,
  });
};
