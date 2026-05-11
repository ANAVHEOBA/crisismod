import { Hono } from 'hono';
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
