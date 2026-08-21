# Empire Recorder Setup Guide

## Overview

The Empire Recorder module requires the `recordings` table and supporting infrastructure to be created in your Supabase project. This guide walks you through verification and setup.

## Quick Status Check

Visit `/settings/empire-doctor` to run a comprehensive health check of your Empire OS installation. This will verify:

- ✅ All required database tables exist
- ✅ Storage buckets are configured
- ✅ Row-level security policies are installed
- ✅ Environment variables are set correctly
- ✅ AI providers are configured

## Manual Verification

### 1. Check if the Recordings Table Exists

Run this in your Supabase SQL Editor:

```sql
SELECT *
FROM public.recordings
LIMIT 1;
```

If you get `relation "public.recordings" does not exist`, proceed to step 2.

### 2. Apply the Migration

The migration file exists at:
```
supabase/migrations/0022_recorder_module.sql
```

To apply it:

#### Option A: Using Supabase CLI (Recommended)

```bash
cd /path/to/EmpireOS
supabase db push
```

This will apply all pending migrations to your linked Supabase project.

#### Option B: Manual SQL (Supabase Dashboard)

1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Open `supabase/migrations/0022_recorder_module.sql`
4. Copy the entire content
5. Run it in the SQL Editor

### 3. Verify the Setup

After running the migration, verify in SQL Editor:

```sql
-- Check table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'recordings';

-- Check storage bucket exists
SELECT name, public 
FROM storage.buckets 
WHERE name = 'recordings';

-- Check RLS is enabled
SELECT tablename 
FROM pg_tables 
WHERE tablename = 'recordings' 
AND schemaname = 'public';
```

## What the Migration Creates

### Database Table
- `public.recordings` — stores audio metadata (title, status, transcript, etc.)
- Includes RLS policies for owner-only access
- Automatic `updated_at` timestamp trigger

### Storage
- Private bucket named `recordings` for source audio files
- RLS policies limiting access to the recording owner
- Files stored as `{user_id}/{recording_id}.{ext}`

### Module Registration
- Registers the `recorder` module in `public.modules`
- Makes it discoverable by the module system

## Features After Setup

Once the migration is applied, the Recorder provides:

1. **Audio Recording**
   - Browser-based recording with pause/resume
   - Waveform visualization and mic level meter
   - Support for multiple audio formats (WebM, Ogg, MP4)

2. **Audio Management**
   - Private storage with signed URLs (5-min expiry)
   - Owner-only access control via RLS
   - Automatic storage cleanup on recording deletion

3. **Processing Pipeline**
   - Automatic transcription via configured AI provider
   - Language detection
   - Translation (multi-language support)
   - Intelligent analysis (decisions, follow-ups, risks, etc.)

4. **Integration**
   - Converts recordings to action drafts
   - Feeds analysis into decision context
   - Reports metrics to dashboard

## Troubleshooting

### "Could not find the table `public.recordings`"

**Cause**: Migration hasn't been applied to your Supabase project.

**Fix**: 
1. Run `supabase db push` in the repo
2. Or manually run the migration SQL (see steps above)

### "Permission denied for schema public"

**Cause**: Your Supabase user lacks required permissions.

**Fix**:
1. Use a more privileged role (e.g., `postgres` or service role)
2. Re-run the migration

### Records exist but processing fails

**Check**:
1. AI provider is configured (`/settings/ai/providers`)
2. API keys are valid
3. Storage bucket has correct RLS policies

Run Empire Doctor to diagnose: `/settings/empire-doctor`

## Architecture Notes

- All storage access is private (no public URLs)
- Signed URLs are generated server-side with 5-minute expiry
- Owner access is enforced via RLS on both table and storage
- Audio files are cleaned up automatically when recordings are deleted
- Processing pipeline uses background jobs (in `0014_agent_v3_compact_runtime`)

## Related Files

- **UI**: `src/app/recorder/` — main recorder interface
- **API**: `src/app/api/recorder/` — server-side handlers
- **Module**: `src/modules/recorder/` — business logic
- **Migration**: `supabase/migrations/0022_recorder_module.sql` — schema definition
