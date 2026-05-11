import { Hono } from 'hono';
import type {
  OnAppInstallRequest,
  OnAutomoderatorFilterCommentRequest,
  OnAutomoderatorFilterPostRequest,
  OnCommentReportRequest,
  OnCommentSubmitRequest,
  OnModMailRequest,
  OnPostReportRequest,
  OnPostSubmitRequest,
  TriggerResponse,
} from '@devvit/web/shared';
import { ensureWeeklyReportSchedule } from '../core/scheduler';
import {
  handleAutomodCommentEvent,
  handleAutomodPostEvent,
  handleCommentReportEvent,
  handleCommentSubmitEvent,
  handleModMailEvent,
  handlePostReportEvent,
  handlePostSubmitEvent,
} from '../core/runtime';

export const triggers = new Hono();

const success = { status: 'success' as const };

triggers.post('/on-app-install', async (c) => {
  const input = await c.req.json<OnAppInstallRequest>();
  if (input.subreddit?.id && input.subreddit.name) {
    await ensureWeeklyReportSchedule(input.subreddit.id, input.subreddit.name);
    console.log('CrisisMod installed to subreddit: r/' + input.subreddit.name);
  }

  return c.json<TriggerResponse>(success, 200);
});

triggers.post('/on-post-submit', async (c) => {
  const input = await c.req.json<OnPostSubmitRequest>();
  await handlePostSubmitEvent(input);
  return c.json<TriggerResponse>(success, 200);
});

triggers.post('/on-comment-submit', async (c) => {
  const input = await c.req.json<OnCommentSubmitRequest>();
  await handleCommentSubmitEvent(input);
  return c.json<TriggerResponse>(success, 200);
});

triggers.post('/on-post-report', async (c) => {
  const input = await c.req.json<OnPostReportRequest>();
  await handlePostReportEvent(input);
  return c.json<TriggerResponse>(success, 200);
});

triggers.post('/on-comment-report', async (c) => {
  const input = await c.req.json<OnCommentReportRequest>();
  await handleCommentReportEvent(input);
  return c.json<TriggerResponse>(success, 200);
});

triggers.post('/on-automoderator-filter-post', async (c) => {
  const input = await c.req.json<OnAutomoderatorFilterPostRequest>();
  await handleAutomodPostEvent(input);
  return c.json<TriggerResponse>(success, 200);
});

triggers.post('/on-automoderator-filter-comment', async (c) => {
  const input = await c.req.json<OnAutomoderatorFilterCommentRequest>();
  await handleAutomodCommentEvent(input);
  return c.json<TriggerResponse>(success, 200);
});

triggers.post('/on-mod-mail', async (c) => {
  const input = await c.req.json<OnModMailRequest>();
  await handleModMailEvent(input);
  return c.json<TriggerResponse>(success, 200);
});
