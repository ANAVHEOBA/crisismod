import { Hono } from 'hono';
import {
  generateWeeklyReportHandler,
  getCurrentWeeklyReportHandler,
  getWeeklyReportHistoryHandler,
  publishWeeklyReportHandler,
} from './weekly-report.controller';

export const weeklyReportRoute = new Hono();

weeklyReportRoute.get('/current', getCurrentWeeklyReportHandler);
weeklyReportRoute.post('/generate', generateWeeklyReportHandler);
weeklyReportRoute.get('/history', getWeeklyReportHistoryHandler);
weeklyReportRoute.post('/publish', publishWeeklyReportHandler);
