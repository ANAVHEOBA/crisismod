import { Hono } from 'hono';
import { appealsRoute } from '../module/appeals/appeals.route';
import { queueTriageRoute } from '../module/queue-triage/queue-triage.route';
import { shieldModeRoute } from '../module/shield-mode/shield-mode.route';
import { weeklyReportRoute } from '../module/weekly-report/weekly-report.route';

export const api = new Hono();

api.route('/appeals', appealsRoute);
api.route('/queue-triage', queueTriageRoute);
api.route('/shield-mode', shieldModeRoute);
api.route('/weekly-report', weeklyReportRoute);
