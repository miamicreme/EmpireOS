/**
 * Review service. Daily and weekly reviews are upserted per (user, date) /
 * (user, week_start) so re-saving a review updates it rather than duplicating.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import { todayISODate, weekStartISODate } from '@/lib/dates';
import {
  createDailyReviewSchema,
  createWeeklyReviewSchema,
  type CreateDailyReviewInput,
  type CreateWeeklyReviewInput,
} from '../schemas';
import type { DailyReview, WeeklyReview } from '../types';

const DAILY = 'daily_reviews';
const WEEKLY = 'weekly_reviews';

export async function upsertDailyReview(
  supabase: SupabaseClient,
  userId: string,
  input: CreateDailyReviewInput,
): Promise<AppResult<DailyReview>> {
  const parsed = createDailyReviewSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid daily review.', parsed.error.format()));
  }
  const row = { ...parsed.data, date: parsed.data.date ?? todayISODate(), user_id: userId };
  const { data, error } = await supabase
    .from(DAILY)
    .upsert(row, { onConflict: 'user_id,date' })
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));
  return ok(data as DailyReview);
}

export async function getDailyReview(
  supabase: SupabaseClient,
  userId: string,
  date: string = todayISODate(),
): Promise<AppResult<DailyReview | null>> {
  const { data, error } = await supabase
    .from(DAILY)
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  if (error) return err(appError('db_error', error.message));
  return ok((data ?? null) as DailyReview | null);
}

export async function upsertWeeklyReview(
  supabase: SupabaseClient,
  userId: string,
  input: CreateWeeklyReviewInput,
): Promise<AppResult<WeeklyReview>> {
  const parsed = createWeeklyReviewSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError('validation', 'Invalid weekly review.', parsed.error.format()));
  }
  const row = { ...parsed.data, user_id: userId };
  const { data, error } = await supabase
    .from(WEEKLY)
    .upsert(row, { onConflict: 'user_id,week_start' })
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));
  return ok(data as WeeklyReview);
}

export async function getCurrentWeeklyReview(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppResult<WeeklyReview | null>> {
  const { data, error } = await supabase
    .from(WEEKLY)
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', weekStartISODate())
    .maybeSingle();

  if (error) return err(appError('db_error', error.message));
  return ok((data ?? null) as WeeklyReview | null);
}
