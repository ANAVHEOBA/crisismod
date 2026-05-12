import type { Hono } from 'hono';

export type ApiRouteModule = {
  basePath: `/${string}`;
  route: Hono;
};

export const registerApiModules = (
  api: Hono,
  modules: readonly ApiRouteModule[]
) => {
  for (const module of modules) {
    api.route(module.basePath, module.route);
  }

  return api;
};
