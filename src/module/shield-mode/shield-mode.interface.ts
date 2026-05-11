export type ShieldModeDurationHours = 1 | 3 | 6 | 12 | 24;

export type ShieldModeConfig = {
  presetName: string;
  defaultDurationHours: ShieldModeDurationHours;
  subredditRules: string[];
  minAccountAgeDays: number;
  minSubredditKarma: number;
  holdLinks: boolean;
  triggerPhrases: string[];
  strictRules: string[];
  appealResponseTemplate: string;
  alertWebhookUrl: string | null;
};

export type ShieldModeConfigPatch = {
  presetName?: string;
  defaultDurationHours?: ShieldModeDurationHours;
  subredditRules?: string[];
  minAccountAgeDays?: number;
  minSubredditKarma?: number;
  holdLinks?: boolean;
  triggerPhrases?: string[];
  strictRules?: string[];
  appealResponseTemplate?: string;
  alertWebhookUrl?: string | null;
};

export type ShieldModeStatus = 'active' | 'inactive' | 'expired';

export type ShieldModeCounters = {
  heldPosts: number;
  heldComments: number;
  flaggedItems: number;
};

export type ShieldModeSession = {
  id: string;
  subredditId: string;
  subredditName: string;
  status: ShieldModeStatus;
  activatedBy: string | null;
  activatedAt: string | null;
  deactivatedAt: string | null;
  expiresAt: string | null;
  reason: string | null;
  configSnapshot: ShieldModeConfig | null;
  counters: ShieldModeCounters;
  expiryJobId: string | null;
};

export type ShieldModeAuditAction =
  | 'activated'
  | 'deactivated'
  | 'expired'
  | 'config_updated'
  | 'held_post'
  | 'held_comment'
  | 'flagged';

export type ShieldModeAuditLog = {
  id: string;
  action: ShieldModeAuditAction;
  moderator: string;
  createdAt: string;
  note: string | null;
};

export type ActivateShieldModePayload = {
  durationHours: ShieldModeDurationHours;
  reason?: string;
  configOverride?: ShieldModeConfigPatch;
};

export type DeactivateShieldModePayload = {
  reason?: string;
};
