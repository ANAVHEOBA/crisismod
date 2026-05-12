import type { ApiRouteModule } from './api-module';
import { appealsApiModule } from '../module/appeals/appeals.route';
import { queueTriageApiModule } from '../module/queue-triage/queue-triage.route';
import { shieldModeApiModule } from '../module/shield-mode/shield-mode.route';
import { weeklyReportApiModule } from '../module/weekly-report/weekly-report.route';

export const apiModules: readonly ApiRouteModule[] = [
  appealsApiModule,
  queueTriageApiModule,
  shieldModeApiModule,
  weeklyReportApiModule,
];
