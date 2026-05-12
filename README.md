# CrisisMod

CrisisMod is a Reddit moderation operations app built with Devvit. It is designed for incident response and high-volume moderation workflows: queue triage, Shield Mode activation, appeal handling, and scheduled weekly reporting.

## What It Does

- **Queue triage**: Score posts and comments, assign priorities, and recommend moderator actions.
- **Shield Mode**: Temporarily tighten moderation thresholds during raids, brigading, spam waves, or other incidents.
- **Appeals workflow**: Intake and resolve user appeals with moderator notes and reusable response templates.
- **Weekly reports**: Generate moderation-health summaries from queue, appeal, and Shield Mode activity.
- **Automation hooks**: Ingest post submits, comment submits, reports, AutoModerator filters, and modmail events.

## Current UI Status

This repo currently ships the **backend Devvit app**: moderator menus, native Devvit forms, triggers, scheduler tasks, and HTTP routes. It does **not** currently publish a custom post-based web UI through `devvit.json`.

If you are building the separate `crisismod-ui` frontend, that UI will matter only after it is wired into the app as Devvit post entrypoints or otherwise integrated with this backend. Right now, the user-facing experience for this repo is primarily menu actions and forms inside Reddit.

## Moderator Workflows

- **Configure CrisisMod**: Save subreddit-specific moderation thresholds, trigger phrases, strict rules, appeal templates, and alert settings.
- **Activate Shield Mode**: Start an incident-response window for `1`, `3`, `6`, `12`, or `24` hours.
- **Deactivate Shield Mode**: End the active Shield Mode session and close out the audit trail.
- **Manual triage**: Send a post or comment directly into the CrisisMod queue for scoring.
- **Generate weekly report**: Create a moderation summary and optionally mark it as published.

## Runtime Events

CrisisMod listens to these Devvit triggers:

- `onPostSubmit`
- `onCommentSubmit`
- `onPostReport`
- `onCommentReport`
- `onAutomoderatorFilterPost`
- `onAutomoderatorFilterComment`
- `onModMail`
- `onAppInstall`

On install, the app also schedules weekly reporting for the target subreddit.

## API Surface

The app exposes backend routes under `/api` for:

- `/api/appeals`
- `/api/queue-triage`
- `/api/shield-mode`
- `/api/weekly-report`

These routes are intended for app-integrated flows and future UI consumption.

## Project Structure

```text
src/
├── config/
│   ├── request-context.ts   # Subreddit/moderator context resolution
│   └── store.ts             # Devvit Redis storage with optional external Redis
├── core/
│   ├── runtime.ts           # Trigger ingestion and triage orchestration
│   └── scheduler.ts         # Weekly report and Shield Mode expiry jobs
├── module/
│   ├── appeals/             # Appeal API, validation, storage, controller logic
│   ├── queue-triage/        # Queue scoring, action handling, validation
│   ├── shield-mode/         # Incident-response config and session lifecycle
│   └── weekly-report/       # Report generation and publishing
├── routes/
│   ├── api.ts              # Public API route mount
│   ├── forms.ts            # Devvit native form submissions
│   ├── menu.ts             # Moderator menu entry handlers
│   ├── tasks.ts            # Scheduled task handlers
│   └── triggers.ts         # App lifecycle and moderation event triggers
└── index.ts                # Hono + Devvit server bootstrap
```

## Storage And Environment

- `REDIS_URL`
  Optional. When provided, the app attempts to use external Redis first.
- Without `REDIS_URL`, the app falls back to Devvit Redis.
- In local failure cases, the store also falls back to in-memory storage.
- `LOCAL_CURL_TEST=1`
  Optional local-development flag used by the repo's local test/server path.

For deployed Reddit-hosted runtime, do not assume your laptop `.env` file exists there. If external Redis is required in production, a proper runtime secret/config path still needs to be wired.

## Commands

- `npm run dev` builds in watch mode for Devvit playtesting.
- `npm run build` builds the production bundle.
- `npm run type-check` runs TypeScript project checks.
- `npm run lint` runs ESLint across `src`.
- `npm run test` runs schema and validation tests with Node's built-in test runner.
- `npm run deploy` runs type-check, lint, test, and then uploads the app.
- `npm run launch` deploys and then publishes for review.

## Permissions

The app currently requests:

- `reddit: true`
- `redis: true`

Moderator menu items are restricted to `moderator` user type.

## Development Notes

- The scheduler creates a weekly report job for each installed subreddit.
- Shield Mode expiry is scheduled as a task and can be cancelled/replaced on reactivation.
- The current repo is operationally useful without a custom UI, but a dedicated web UI can still add value for dashboards, queue review, analytics, and appeal management once integrated.

## Deployment

1. Authenticate with Devvit CLI.
2. Run `npm run deploy`.
3. Verify the uploaded version in the Reddit developer dashboard.
4. Install the app into the intended playtest subreddit if Devvit does not do that automatically.

CrisisMod is not a starter template anymore. The repo now represents a moderation operations backend focused on crisis-response workflows for Reddit communities.
