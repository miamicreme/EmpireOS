-- =============================================================================
-- Empire OS — Seed Data
--
-- Seeds reference data (empire phases, modules) and a small amount of
-- non-private example data. Personal/private records are NEVER seeded here.
--
-- User-owned example rows (metrics, actions) are intentionally omitted from
-- automatic seeding because they require a real auth.users id. They are shown
-- as commented templates at the bottom for manual local testing only.
-- =============================================================================

-- Empire phases ---------------------------------------------------------------
insert into public.empire_phases (id, name, description, goal, status, priority_order, progress)
values
  ('phase_0', 'Stabilize Cash',   'Create reliable short-term cash flow.',        'Hit daily/weekly cash targets consistently.', 'active',  0, 0),
  ('phase_1', 'High-Income Role', 'Land a high-income job or contract.',          'Secure a high-income role.',                  'pending', 1, 0),
  ('phase_2', 'Capital Stack',    'Build credit and access to capital.',          'Assemble a usable capital stack.',            'pending', 2, 0),
  ('phase_3', 'Acquire Cash Flow','Acquire cash-flowing assets/businesses.',      'Close first acquisition.',                    'pending', 3, 0),
  ('phase_4', 'Roll-Up',          'Roll up acquisitions into the empire.',        'Scale via roll-up strategy.',                 'pending', 4, 0)
on conflict (id) do nothing;

-- Modules ---------------------------------------------------------------------
insert into public.modules (id, name, slug, description, phase_id, status, priority, health, route, icon, capabilities)
values
  ('cash-engine',    'Cash Engine',          'cash-engine',    'Track and grow short-term cash flow.',   'phase_0', 'active', 10,  'yellow', '/modules/cash-engine',    'banknote',  '["metrics","actions","decisions"]'::jsonb),
  ('job-hunt',       'High-Income Job Hunt', 'job-hunt',       'Manage high-income job applications.',    'phase_1', 'active', 20,  'yellow', '/modules/job-hunt',       'briefcase', '["metrics","actions","decisions"]'::jsonb),
  ('followup-crm',   'Follow-Up CRM',        'followup-crm',   'Track contacts and follow-ups.',         'phase_1', 'active', 30,  'yellow', '/modules/followup-crm',   'users',     '["metrics","actions","decisions"]'::jsonb),
  ('credit-funding', 'Credit / Funding',     'credit-funding', 'Manage credit items and funding.',       'phase_2', 'active', 40,  'yellow', '/modules/credit-funding', 'credit-card','["metrics","actions"]'::jsonb),
  ('projects',       'Projects',             'projects',       'Track strategic projects.',              'phase_2', 'active', 50,  'yellow', '/modules/projects',       'folder',    '["metrics","actions"]'::jsonb),
  ('acquisitions',   'Acquisitions',         'acquisitions',   'Track acquisition targets.',             'phase_3', 'active', 60,  'yellow', '/modules/acquisitions',   'building',  '["metrics","actions","decisions"]'::jsonb)
on conflict (id) do nothing;

-- =============================================================================
-- Advisor roles (reference constants — for documentation, not a table)
--
--   cash_advisor      — focuses on near-term cash generation
--   career_advisor    — focuses on high-income role progression
--   risk_advisor      — surfaces downside, exposure, and failure modes
--   deal_advisor      — evaluates acquisitions and deal structure
--   execution_advisor — focuses on what to do next and sequencing
--   final_judge       — synthesizes advisor votes into a recommendation
--
-- These are mirrored in src/spine/constants.ts as ADVISOR_ROLES.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Example user-owned rows (templates only — DO NOT seed real private data).
-- Replace <USER_ID> with a real auth.users id when testing locally.
-- -----------------------------------------------------------------------------
-- insert into public.module_metrics (user_id, module_id, metric_key, metric_label, metric_value, target_value, unit)
-- values ('<USER_ID>', 'cash-engine', 'cash_today', 'Cash Today', 0, 250, 'USD');
--
-- insert into public.global_actions (user_id, module_id, phase_id, title, category, priority, impact_score, urgency_score, effort_score)
-- values ('<USER_ID>', 'cash-engine', 'phase_0', 'Log today''s cash', 'cash', 'high', 8, 7, 2);
