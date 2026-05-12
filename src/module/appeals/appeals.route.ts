import { Hono } from 'hono';
import type { ApiRouteModule } from '../../routes/api-module';
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

export const appealsApiModule: ApiRouteModule = {
  basePath: '/appeals',
  route: appealsRoute,
};
