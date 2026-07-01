-- =============================================================================
-- Empire OS — Seed the module registry
-- Migration: 0017_seed_modules
--
-- The `modules` table (module_id FK target for documents, global_actions,
-- module_metrics, and action drafts) was never seeded, so tagging anything with
-- a module id failed the FK. Seed the six modules from their manifests. Data
-- only, idempotent.
-- =============================================================================
insert into public.modules (id, name, slug, description, route, icon, priority) values
  ('cash-engine',    'Cash Engine',          'cash-engine',    'Track and grow short-term cash flow.',                    '/modules/cash-engine',    'banknote',    10),
  ('job-hunt',       'High-Income Job Hunt', 'job-hunt',       'Manage high-income job applications and pipeline.',       '/modules/job-hunt',       'briefcase',   20),
  ('followup-crm',   'Follow-Up CRM',        'followup-crm',   'Track contacts and follow-ups so nothing slips.',         '/modules/followup-crm',   'users',       30),
  ('credit-funding', 'Credit & Funding',     'credit-funding', 'Track credit scores, disputes, and funding readiness.',   '/modules/credit-funding', 'credit-card', 40),
  ('projects',       'Projects',             'projects',       'Manage active projects and prevent distraction.',         '/modules/projects',       'folder',      50),
  ('acquisitions',   'Acquisitions',         'acquisitions',   'Research, track, and close business acquisition targets.', '/modules/acquisitions',   'building',    60)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  description = excluded.description,
  route = excluded.route,
  icon = excluded.icon;
