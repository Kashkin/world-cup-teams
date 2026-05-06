import { z } from 'zod';

export const ConfederationSchema = z.enum(['AFC', 'CAF', 'CONCACAF', 'CONMEBOL', 'OFC', 'UEFA']);

export const BestFinishSchema = z.enum([
  'Champion',
  'Runner-up',
  'Third',
  'Fourth',
  'Quarter-finals',
  'Round of 16',
  'Group stage',
]);

export const TeamSchema = z.object({
  code: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  name: z.string().min(1),
  confederation: ConfederationSchema,
  flag: z.string().startsWith('/flags/'),
  ranking: z.number().int().positive().nullable(),
  appearances: z.number().int().nonnegative(),
  trophies: z.number().int().nonnegative(),
  lastTrophy: z.number().int().min(1930).max(2026).nullable(),
  matchWins: z.number().int().nonnegative(),
  bestFinish: BestFinishSchema,
});

export type Team = z.infer<typeof TeamSchema>;
export type Confederation = z.infer<typeof ConfederationSchema>;
export type BestFinish = z.infer<typeof BestFinishSchema>;
