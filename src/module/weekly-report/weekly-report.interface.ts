export type WeeklyReport = {
  id: string;
  subredditId: string;
  subredditName: string;
  periodLabel: string;
  createdAt: string;
  published: boolean;
  publishedAt: string | null;
  triagedItems: number;
  highRiskItems: number;
  actionedQueueItems: number;
  appealsHandled: number;
  reversals: number;
  shieldModeActivations: number;
  estimatedHoursSaved: number;
  mostAppealedRules: string[];
  topRiskReasons: string[];
  recommendations: string[];
};

export type GenerateWeeklyReportPayload = {
  periodLabel?: string;
};

export type PublishWeeklyReportPayload = {
  reportId: string;
};
