import { z } from 'zod';

export const MAX_REVIEW_INTERVAL_MINUTES = 3650 * 1440;
export const DEFAULT_REVIEW_SETTINGS = {
  mode: 'automatic',
  againMinutes: 1,
  hardMinutes: 1440,
  goodMinutes: 20160,
  easyMinutes: 86400,
  growIntervals: true,
  updatedAt: '1970-01-01T00:00:00.000Z',
} as const;

const interval = z.number().int().min(1).max(MAX_REVIEW_INTERVAL_MINUTES);
export const reviewSettingsSchema = z.object({
  mode: z.enum(['automatic', 'custom']),
  againMinutes: interval,
  hardMinutes: interval,
  goodMinutes: interval,
  easyMinutes: interval,
  growIntervals: z.boolean(),
  updatedAt: z.iso.datetime({ offset: true }),
}).refine(value => value.againMinutes <= value.hardMinutes && value.hardMinutes <= value.goodMinutes && value.goodMinutes <= value.easyMinutes, {
  message: 'Use increasing times: Again ≤ Hard ≤ Good ≤ Easy.',
});

export type ReviewSettings = z.infer<typeof reviewSettingsSchema>;
