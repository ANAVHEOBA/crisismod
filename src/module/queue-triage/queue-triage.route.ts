import { Hono } from 'hono';
import {
  applyQueueActionHandler,
  getQueueAuditHandler,
  getQueueItemsHandler,
  getQueueSummaryHandler,
  scoreQueueItemHandler,
} from './queue-triage.controller';

export const queueTriageRoute = new Hono();

queueTriageRoute.get('/items', getQueueItemsHandler);
queueTriageRoute.post('/score', scoreQueueItemHandler);
queueTriageRoute.post('/action', applyQueueActionHandler);
queueTriageRoute.get('/audit', getQueueAuditHandler);
queueTriageRoute.get('/summary', getQueueSummaryHandler);
