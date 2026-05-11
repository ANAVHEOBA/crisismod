export type QueuePriority = 'P0' | 'P1' | 'P2' | 'P3' | 'Watch';

export type QueueRecommendedAction =
  | 'approve'
  | 'remove'
  | 'lock'
  | 'escalate'
  | 'watch';

export type QueueItemSource =
  | 'manual'
  | 'post_submit'
  | 'comment_submit'
  | 'post_report'
  | 'comment_report'
  | 'automod_post'
  | 'automod_comment';

export type QueueConfidence = 'low' | 'medium' | 'high';

export type QueueItemStatus =
  | 'pending'
  | 'approved'
  | 'removed'
  | 'locked'
  | 'escalated'
  | 'watching';

export type QueueScoreInput = {
  targetId: string;
  targetPermalink?: string | null;
  source?: QueueItemSource;
  kind: 'post' | 'comment';
  author: string;
  contentSummary: string;
  reportCount: number;
  reportReasons: string[];
  accountAgeDays: number;
  subredditKarma: number;
  containsLink: boolean;
  commentVelocity: number;
  controversialKeywords: string[];
  repeatedSimilarComments: number;
  threadLocked: boolean;
  priorIncidentRemovals: number;
  labels?: string[];
};

export type QueueItem = QueueScoreInput & {
  id: string;
  subredditId: string;
  subredditName: string;
  source: QueueItemSource;
  targetPermalink: string | null;
  priority: QueuePriority;
  score: number;
  confidence: QueueConfidence;
  labels: string[];
  suggestedRule: string | null;
  removalReason: string;
  recommendedAction: QueueRecommendedAction;
  rationale: string[];
  status: QueueItemStatus;
  createdAt: string;
  updatedAt: string;
};

export type QueueActionPayload = {
  itemId: string;
  action: QueueRecommendedAction;
  note?: string;
};

export type QueueActionLog = {
  id: string;
  itemId: string;
  action: QueueRecommendedAction;
  moderator: string;
  note: string | null;
  createdAt: string;
};

export type QueueSummary = {
  totalItems: number;
  pendingItems: number;
  highRiskItems: number;
  actionedItems: number;
  itemsByPriority: Record<QueuePriority, number>;
};
