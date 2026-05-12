import { Hono } from 'hono';
import { registerApiModules } from './api-module';
import { apiModules } from './api.registry';

export const api = registerApiModules(new Hono(), apiModules);
