export type AppealType =
  | 'confused'
  | 'valid_correction'
  | 'hostile'
  | 'spam'
  | 'repeat_offender';

export type AppealOutcome = 'uphold' | 'reverse' | 'warn' | 'ban' | 'escalate';

export type AppealStatus = 'open' | 'resolved';

export type AppealIntakePayload = {
  username: string;
  contentSummary: string;
  citedRule: string;
  removalMessage: string;
  userAppeal: string;
  priorOffenses: number;
  sourceRef?: string;
};

export type AppealResolvePayload = {
  appealId: string;
  outcome: AppealOutcome;
  moderatorNote?: string;
  responseOverride?: string;
};

export type AppealItem = Omit<AppealIntakePayload, 'sourceRef'> & {
  id: string;
  subredditId: string;
  subredditName: string;
  sourceRef: string | null;
  appealSummary: string;
  appealType: AppealType;
  suggestedResponse: string;
  recommendedOutcome: AppealOutcome;
  status: AppealStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
  finalOutcome: AppealOutcome | null;
  moderatorNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AppealMetrics = {
  totalAppeals: number;
  openAppeals: number;
  resolvedAppeals: number;
  reversalCount: number;
  mostAppealedRules: Array<{ rule: string; count: number }>;
};
