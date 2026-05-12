import { Hono } from 'hono';
import type { ApiRouteModule } from '../../routes/api-module';
import {
  activateShieldModeHandler,
  deactivateShieldModeHandler,
  getShieldModeAuditHandler,
  getShieldModeStatus,
  updateShieldModeConfigHandler,
} from './shield-mode.controller';

export const shieldModeRoute = new Hono();

shieldModeRoute.get('/status', getShieldModeStatus);
shieldModeRoute.post('/activate', activateShieldModeHandler);
shieldModeRoute.post('/deactivate', deactivateShieldModeHandler);
shieldModeRoute.patch('/config', updateShieldModeConfigHandler);
shieldModeRoute.get('/audit', getShieldModeAuditHandler);

export const shieldModeApiModule: ApiRouteModule = {
  basePath: '/shield-mode',
  route: shieldModeRoute,
};
