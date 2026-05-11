import { Hono } from 'hono';
import {
  getAppealMetricsHandler,
  intakeAppealHandler,
  listAppealsHandler,
  resolveAppealHandler,
} from './appeals.controller';

export const appealsRoute = new Hono();

appealsRoute.get('/', listAppealsHandler);
appealsRoute.post('/intake', intakeAppealHandler);
appealsRoute.post('/resolve', resolveAppealHandler);
appealsRoute.get('/metrics', getAppealMetricsHandler);
