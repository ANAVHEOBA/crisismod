import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer as createNodeServer } from 'node:http';
import { createServer as createDevvitServer, getServerPort } from '@devvit/web/server';
import { api } from './routes/api';
import { forms } from './routes/forms';
import { menu } from './routes/menu';
import { tasks } from './routes/tasks';
import { triggers } from './routes/triggers';

const app = new Hono();
const internal = new Hono();

internal.route('/menu', menu);
internal.route('/form', forms);
internal.route('/tasks', tasks);
internal.route('/triggers', triggers);

app.route('/api', api);
app.route('/internal', internal);

const createServer =
  process.env.LOCAL_CURL_TEST === '1' ? createNodeServer : createDevvitServer;

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
