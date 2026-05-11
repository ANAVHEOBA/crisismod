import { readJson, writeJson } from '../../config/store';
import type { AppRequestContext } from '../../config/request-context';
import { getAppealMetrics } from '../appeals/appeals.crud';
import { getQueueItems, getQueueSummary } from '../queue-triage/queue-triage.crud';
import { getShieldModeAuditLogs } from '../shield-mode/shield-mode.crud';
import type {
  GenerateWeeklyReportPayload,
  PublishWeeklyReportPayload,
  WeeklyReport,
} from './weekly-report.interface';

const reportsKey = (subredditId: string) => `weekly-report:history:${subredditId}`;

const now = () => new Date().toISOString();

const buildRecommendations = (
  highRiskItems: number,
  reversals: number,
  shieldModeActivations: number
) => {
  const recommendations: string[] = [];

  if (highRiskItems >= 3) {
    recommendations.push('Tighten default triage thresholds for links and repeat comments.');
  }

  if (reversals >= 1) {
    recommendations.push('Clarify removal templates for the most appealed rules.');
  }

  if (shieldModeActivations >= 1) {
    recommendations.push('Keep a prewritten incident preset ready for the next traffic spike.');
  }

  if (recommendations.length === 0) {
    recommendations.push('No urgent workflow changes recommended this week.');
  }

  return recommendations;
};

const buildTopRiskReasons = (rationales: string[]) => {
  const counts = new Map<string, number>();
  for (const rationale of rationales) {
    counts.set(rationale, (counts.get(rationale) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([reason]) => reason);
};

export const getWeeklyReports = async (subredditId: string) => {
  const reports = await readJson<WeeklyReport[]>(reportsKey(subredditId), []);
  return [...reports].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
};

export const getCurrentWeeklyReport = async (subredditId: string) => {
  const reports = await getWeeklyReports(subredditId);
  return reports[0] ?? null;
};

export const generateWeeklyReport = async (
  requestContext: AppRequestContext,
  payload: GenerateWeeklyReportPayload
) => {
  const [summary, items, appealMetrics, shieldAuditLogs, reports] = await Promise.all([
    getQueueSummary(requestContext.subredditId),
    getQueueItems(requestContext.subredditId),
    getAppealMetrics(requestContext.subredditId),
    getShieldModeAuditLogs(requestContext.subredditId, 100),
    getWeeklyReports(requestContext.subredditId),
  ]);

  const shieldModeActivations = shieldAuditLogs.filter(
    (log) => log.action === 'activated'
  ).length;
  const topRiskReasons = buildTopRiskReasons(
    items.flatMap((item) => item.rationale)
  );

  const report: WeeklyReport = {
    id: `weekly-report-${Date.now()}`,
    subredditId: requestContext.subredditId,
    subredditName: requestContext.subredditName,
    periodLabel: payload.periodLabel ?? 'Current week',
    createdAt: now(),
    published: false,
    publishedAt: null,
    triagedItems: summary.totalItems,
    highRiskItems: summary.highRiskItems,
    actionedQueueItems: summary.actionedItems,
    appealsHandled: appealMetrics.totalAppeals,
    reversals: appealMetrics.reversalCount,
    shieldModeActivations,
    estimatedHoursSaved:
      Math.round(
        ((summary.totalItems * 2 +
          appealMetrics.totalAppeals * 4 +
          shieldModeActivations * 20) /
          60) *
          10
      ) / 10,
    mostAppealedRules: appealMetrics.mostAppealedRules.map((entry) => entry.rule),
    topRiskReasons,
    recommendations: buildRecommendations(
      summary.highRiskItems,
      appealMetrics.reversalCount,
      shieldModeActivations
    ),
  };

  await writeJson(reportsKey(requestContext.subredditId), [report, ...reports]);
  return report;
};

export const publishWeeklyReport = async (
  requestContext: AppRequestContext,
  payload: PublishWeeklyReportPayload
) => {
  const reports = await getWeeklyReports(requestContext.subredditId);
  let publishedReport: WeeklyReport | null = null;

  const nextReports = reports.map((report) => {
    if (report.id !== payload.reportId) {
      return report;
    }

    publishedReport = {
      ...report,
      published: true,
      publishedAt: now(),
    };

    return publishedReport;
  });

  if (!publishedReport) {
    return null;
  }

  await writeJson(reportsKey(requestContext.subredditId), nextReports);
  return publishedReport;
};
