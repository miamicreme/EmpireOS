-- =============================================================================
-- Empire OS — AI Teams Core
-- Migration: 0023_ai_teams_core
--
-- Adds the controlled AI Teams layer on top of the existing compact agent runtime.
-- Teams do not replace POST /api/ai/agent/run; they organize approved missions,
-- tasks, review packages, and reusable team templates.
-- =============================================================================

-- Team templates --------------------------------------------------------------
-- user_id null = system template available to every authenticated owner.
-- user_id set  = owner-created/custom template.
create table if not exists public.ai_team_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  parent_template_id uuid references public.ai_team_templates(id) on delete set null,
  name text not null,
  slug text not null,
  type text not null check (type in ('executive', 'domain', 'capability', 'mission', 'subteam')),
  group_name text,
  purpose text not null,
  default_autonomy_level text not null default 'supervised'
    check (default_autonomy_level in ('manual', 'supervised', 'review_required', 'autonomous_limited')),
  allowed_module_ids text[] not null default '{}'::text[],
  allowed_action_types text[] not null default '{}'::text[],
  default_member_roles text[] not null default '{}'::text[],
  spawn_policy text not null default 'suggested'
    check (spawn_policy in ('manual_only', 'suggested', 'auto_after_approval')),
  max_concurrent_missions integer not null default 3 check (max_concurrent_missions > 0),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_team_templates enable row level security;

create policy "ai_team_templates select system or own" on public.ai_team_templates
  for select to authenticated using (user_id is null or user_id = auth.uid());
create policy "ai_team_templates insert own" on public.ai_team_templates
  for insert to authenticated with check (user_id = auth.uid());
create policy "ai_team_templates update own" on public.ai_team_templates
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_team_templates delete own" on public.ai_team_templates
  for delete to authenticated using (user_id = auth.uid());

create trigger set_ai_team_templates_updated_at
  before update on public.ai_team_templates
  for each row execute function public.set_updated_at();

create unique index if not exists ai_team_templates_system_slug_key
  on public.ai_team_templates (slug) where user_id is null;
create unique index if not exists ai_team_templates_user_slug_key
  on public.ai_team_templates (user_id, slug) where user_id is not null;
create index if not exists ai_team_templates_type_idx
  on public.ai_team_templates (type, active);

-- Team member templates -------------------------------------------------------
create table if not exists public.ai_team_member_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  team_template_id uuid not null references public.ai_team_templates(id) on delete cascade,
  name text not null,
  role text not null,
  lens text not null,
  responsibilities text[] not null default '{}'::text[],
  tools_allowed text[] not null default '{}'::text[],
  blocked_actions text[] not null default '{}'::text[],
  model_preference text,
  memory_scope text not null default 'mission'
    check (memory_scope in ('mission', 'team', 'module', 'global_redacted')),
  requires_review boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_team_member_templates enable row level security;

create policy "ai_team_member_templates select system or own" on public.ai_team_member_templates
  for select to authenticated using (user_id is null or user_id = auth.uid());
create policy "ai_team_member_templates insert own" on public.ai_team_member_templates
  for insert to authenticated with check (user_id = auth.uid());
create policy "ai_team_member_templates update own" on public.ai_team_member_templates
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_team_member_templates delete own" on public.ai_team_member_templates
  for delete to authenticated using (user_id = auth.uid());

create trigger set_ai_team_member_templates_updated_at
  before update on public.ai_team_member_templates
  for each row execute function public.set_updated_at();

create index if not exists ai_team_member_templates_team_idx
  on public.ai_team_member_templates (team_template_id);

-- Active teams ----------------------------------------------------------------
create table if not exists public.ai_teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid references public.ai_team_templates(id) on delete set null,
  parent_team_id uuid references public.ai_teams(id) on delete set null,
  name text not null,
  slug text not null,
  type text not null check (type in ('executive', 'domain', 'capability', 'mission', 'subteam')),
  purpose text not null,
  default_autonomy_level text not null default 'supervised'
    check (default_autonomy_level in ('manual', 'supervised', 'review_required', 'autonomous_limited')),
  allowed_module_ids text[] not null default '{}'::text[],
  allowed_action_types text[] not null default '{}'::text[],
  spawn_policy text not null default 'suggested'
    check (spawn_policy in ('manual_only', 'suggested', 'auto_after_approval')),
  max_concurrent_missions integer not null default 3 check (max_concurrent_missions > 0),
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

alter table public.ai_teams enable row level security;
create policy "ai_teams select own" on public.ai_teams
  for select to authenticated using (user_id = auth.uid());
create policy "ai_teams insert own" on public.ai_teams
  for insert to authenticated with check (user_id = auth.uid());
create policy "ai_teams update own" on public.ai_teams
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_teams delete own" on public.ai_teams
  for delete to authenticated using (user_id = auth.uid());

create trigger set_ai_teams_updated_at
  before update on public.ai_teams
  for each row execute function public.set_updated_at();

create index if not exists ai_teams_user_status_idx
  on public.ai_teams (user_id, status, created_at desc);
create index if not exists ai_teams_parent_idx
  on public.ai_teams (parent_team_id);

-- Active team members ---------------------------------------------------------
create table if not exists public.ai_team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references public.ai_teams(id) on delete cascade,
  template_member_id uuid references public.ai_team_member_templates(id) on delete set null,
  name text not null,
  role text not null,
  lens text not null,
  responsibilities text[] not null default '{}'::text[],
  tools_allowed text[] not null default '{}'::text[],
  blocked_actions text[] not null default '{}'::text[],
  model_preference text,
  memory_scope text not null default 'mission'
    check (memory_scope in ('mission', 'team', 'module', 'global_redacted')),
  requires_review boolean not null default true,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_team_members enable row level security;
create policy "ai_team_members select own" on public.ai_team_members
  for select to authenticated using (user_id = auth.uid());
create policy "ai_team_members insert own" on public.ai_team_members
  for insert to authenticated with check (user_id = auth.uid());
create policy "ai_team_members update own" on public.ai_team_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_team_members delete own" on public.ai_team_members
  for delete to authenticated using (user_id = auth.uid());

create trigger set_ai_team_members_updated_at
  before update on public.ai_team_members
  for each row execute function public.set_updated_at();

create index if not exists ai_team_members_team_idx
  on public.ai_team_members (team_id);

-- Missions -------------------------------------------------------------------
create table if not exists public.ai_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid references public.ai_teams(id) on delete set null,
  source text not null default 'manual'
    check (source in ('manual', 'spine_action', 'artifact', 'recorder', 'module', 'daily_brief')),
  source_id text,
  title text not null,
  objective text not null,
  status text not null default 'pending_approval'
    check (status in ('draft', 'pending_approval', 'approved', 'running', 'review', 'done', 'blocked', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  module_ids text[] not null default '{}'::text[],
  input_artifact_ids uuid[] not null default '{}'::uuid[],
  linked_action_draft_ids uuid[] not null default '{}'::uuid[],
  autonomy_level text not null default 'supervised'
    check (autonomy_level in ('manual', 'supervised', 'review_required', 'autonomous_limited')),
  review_required boolean not null default true,
  approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_missions enable row level security;
create policy "ai_missions select own" on public.ai_missions
  for select to authenticated using (user_id = auth.uid());
create policy "ai_missions insert own" on public.ai_missions
  for insert to authenticated with check (user_id = auth.uid());
create policy "ai_missions update own" on public.ai_missions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_missions delete own" on public.ai_missions
  for delete to authenticated using (user_id = auth.uid());

create trigger set_ai_missions_updated_at
  before update on public.ai_missions
  for each row execute function public.set_updated_at();

create index if not exists ai_missions_user_status_idx
  on public.ai_missions (user_id, status, created_at desc);
create index if not exists ai_missions_team_idx
  on public.ai_missions (team_id, created_at desc);

-- Mission tasks ---------------------------------------------------------------
create table if not exists public.ai_mission_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id uuid not null references public.ai_missions(id) on delete cascade,
  assigned_member_id uuid references public.ai_team_members(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'backlog'
    check (status in ('backlog', 'ready', 'running', 'review', 'done', 'blocked')),
  depends_on_task_ids uuid[] not null default '{}'::uuid[],
  output_artifact_ids uuid[] not null default '{}'::uuid[],
  review_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_mission_tasks enable row level security;
create policy "ai_mission_tasks select own" on public.ai_mission_tasks
  for select to authenticated using (user_id = auth.uid());
create policy "ai_mission_tasks insert own" on public.ai_mission_tasks
  for insert to authenticated with check (user_id = auth.uid());
create policy "ai_mission_tasks update own" on public.ai_mission_tasks
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_mission_tasks delete own" on public.ai_mission_tasks
  for delete to authenticated using (user_id = auth.uid());

create trigger set_ai_mission_tasks_updated_at
  before update on public.ai_mission_tasks
  for each row execute function public.set_updated_at();

create index if not exists ai_mission_tasks_mission_idx
  on public.ai_mission_tasks (mission_id, created_at asc);

-- Messages, reviews, events ---------------------------------------------------
create table if not exists public.ai_team_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id uuid references public.ai_missions(id) on delete cascade,
  team_id uuid references public.ai_teams(id) on delete cascade,
  sender_type text not null default 'agent' check (sender_type in ('owner', 'agent', 'system')),
  sender_name text,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_team_messages enable row level security;
create policy "ai_team_messages select own" on public.ai_team_messages
  for select to authenticated using (user_id = auth.uid());
create policy "ai_team_messages insert own" on public.ai_team_messages
  for insert to authenticated with check (user_id = auth.uid());
create policy "ai_team_messages delete own" on public.ai_team_messages
  for delete to authenticated using (user_id = auth.uid());

create index if not exists ai_team_messages_mission_idx
  on public.ai_team_messages (mission_id, created_at asc);

create table if not exists public.ai_mission_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id uuid not null references public.ai_missions(id) on delete cascade,
  summary text not null,
  output_artifact_ids uuid[] not null default '{}'::uuid[],
  action_draft_ids uuid[] not null default '{}'::uuid[],
  risks text[] not null default '{}'::text[],
  assumptions text[] not null default '{}'::text[],
  recommended_approval text not null default 'revise' check (recommended_approval in ('approve', 'revise', 'reject')),
  next_steps text[] not null default '{}'::text[],
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'revision_requested')),
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_mission_reviews enable row level security;
create policy "ai_mission_reviews select own" on public.ai_mission_reviews
  for select to authenticated using (user_id = auth.uid());
create policy "ai_mission_reviews insert own" on public.ai_mission_reviews
  for insert to authenticated with check (user_id = auth.uid());
create policy "ai_mission_reviews update own" on public.ai_mission_reviews
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_mission_reviews delete own" on public.ai_mission_reviews
  for delete to authenticated using (user_id = auth.uid());

create trigger set_ai_mission_reviews_updated_at
  before update on public.ai_mission_reviews
  for each row execute function public.set_updated_at();

create index if not exists ai_mission_reviews_mission_idx
  on public.ai_mission_reviews (mission_id, created_at desc);

create table if not exists public.ai_mission_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id uuid not null references public.ai_missions(id) on delete cascade,
  event_type text not null,
  summary text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_mission_events enable row level security;
create policy "ai_mission_events select own" on public.ai_mission_events
  for select to authenticated using (user_id = auth.uid());
create policy "ai_mission_events insert own" on public.ai_mission_events
  for insert to authenticated with check (user_id = auth.uid());
create policy "ai_mission_events delete own" on public.ai_mission_events
  for delete to authenticated using (user_id = auth.uid());

create index if not exists ai_mission_events_mission_idx
  on public.ai_mission_events (mission_id, created_at asc);

-- Default system team templates ----------------------------------------------
insert into public.ai_team_templates
  (name, slug, type, group_name, purpose, default_autonomy_level, allowed_module_ids, allowed_action_types, default_member_roles, spawn_policy, max_concurrent_missions, metadata)
values
  ('Chief of Staff Team', 'chief-of-staff', 'executive', 'Executive Command', 'Daily planning, priority triage, follow-ups, risks, opportunities, and owner focus.', 'supervised', array['cash-engine','job-hunt','follow-up-crm','credit-funding','projects','acquisitions'], array['draft_action','prepare_brief','request_review'], array['Lead Chief of Staff','Follow-Up Agent','Risk/Opportunity Agent','Drafting Agent'], 'suggested', 5, '{"seed":"ai_teams_core"}'::jsonb),
  ('Research Intelligence Team', 'research-intelligence', 'capability', 'Research Intelligence', 'Turns documents, uploads, camera/video frames, transcripts, and outside signals into grounded briefs.', 'review_required', array['projects','acquisitions'], array['create_artifact','prepare_brief','request_review'], array['Signal Analyst','Document Analyst','Vision/Frame Analyst','Synthesis Agent'], 'suggested', 4, '{"seed":"ai_teams_core"}'::jsonb),
  ('Product Builder Team', 'product-builder', 'capability', 'Product and Engineering', 'Turns ideas and repositories into specs, branch plans, implementation tasks, tests, and launch checklists.', 'review_required', array['projects'], array['create_task_plan','draft_spec','request_review'], array['Product Architect','Frontend Agent','Backend Agent','QA/Review Agent','Release Agent'], 'suggested', 4, '{"seed":"ai_teams_core"}'::jsonb),
  ('DealFlow Team', 'dealflow', 'domain', 'DealFlow and Wealth', 'Analyzes deals, buyer fit, diligence gaps, seller-finance angles, and outreach strategy.', 'supervised', array['acquisitions','projects'], array['analyze_deal','draft_outreach','prepare_diligence'], array['Deal Analyst','Buyer Match Agent','Diligence Agent','Outreach Agent'], 'suggested', 5, '{"seed":"ai_teams_core"}'::jsonb),
  ('Money Team', 'money', 'domain', 'Money and Survival', 'Cash flow triage, bills, credit/funding, income opportunities, and financial risk.', 'manual', array['cash-engine','credit-funding'], array['prepare_brief','draft_action','request_review'], array['CFO Agent','Cash Flow Agent','Credit/Funding Agent','Opportunity Agent'], 'manual_only', 3, '{"seed":"ai_teams_core"}'::jsonb),
  ('Operations/Admin Team', 'operations-admin', 'domain', 'Operations and Admin', 'Runs inbox, calendar, forms, SOPs, vendors, documents, and operational cleanup.', 'supervised', array['follow-up-crm','projects'], array['draft_message','prepare_sop','draft_action'], array['Operations Manager','Inbox Agent','Calendar Agent','SOP Writer','Admin Agent'], 'suggested', 4, '{"seed":"ai_teams_core"}'::jsonb),
  ('Career/Consulting Team', 'career-consulting', 'domain', 'Career and Consulting', 'Helps win roles, consulting contracts, discovery calls, proposals, and client delivery.', 'supervised', array['job-hunt','projects','follow-up-crm'], array['draft_proposal','prepare_discovery','draft_follow_up'], array['Career Strategist','Proposal Writer','Discovery Agent','Case Study Agent','Pricing Agent'], 'suggested', 4, '{"seed":"ai_teams_core"}'::jsonb),
  ('Security/Privacy Team', 'security-privacy', 'capability', 'Security, Privacy, and Compliance', 'Protects sensitive data, credentials, consent, audit trails, and system boundaries.', 'manual', array['projects'], array['review_risk','block_secret','request_review'], array['Security Reviewer','Privacy Agent','Redaction Agent','Audit Agent'], 'manual_only', 3, '{"seed":"ai_teams_core"}'::jsonb),
  ('PromptOps/Agent Quality Team', 'promptops-agent-quality', 'capability', 'PromptOps and Agent Quality', 'Improves prompts, agent instructions, evaluations, memory quality, tool use, and guardrails.', 'review_required', array['projects'], array['improve_prompt','run_eval','request_review'], array['Prompt Engineer','Context Engineer','Eval Designer','Memory Curator','Quality Judge'], 'suggested', 3, '{"seed":"ai_teams_core"}'::jsonb),
  ('Brand/Content Team', 'brand-content', 'domain', 'Brand, Content, and Outreach', 'Turns expertise and products into content, distribution, website copy, and outreach.', 'supervised', array['projects','follow-up-crm'], array['draft_content','draft_outreach','prepare_brief'], array['Brand Strategist','Content Planner','Hook Writer','Editor Agent','Outreach Writer'], 'suggested', 4, '{"seed":"ai_teams_core"}'::jsonb);

-- Default member templates. Keep this intentionally compact; detailed subteam
-- templates can be added without schema changes.
insert into public.ai_team_member_templates
  (team_template_id, name, role, lens, responsibilities, tools_allowed, blocked_actions, memory_scope, requires_review, metadata)
select t.id, m.name, m.role, m.lens, m.responsibilities, m.tools_allowed, m.blocked_actions, m.memory_scope, m.requires_review, '{"seed":"ai_teams_core"}'::jsonb
from public.ai_team_templates t
join (values
  ('chief-of-staff','Lead Chief of Staff','lead','priority and accountability',array['rank priorities','prepare mission briefs','assign workstreams'],array['read_context','draft_actions'],array['mutate_records','send_messages'],'team',true),
  ('chief-of-staff','Follow-Up Agent','specialist','commitments and stale loops',array['find pending follow-ups','draft reminders','flag missed commitments'],array['read_context','draft_messages'],array['send_messages'],'module',true),
  ('research-intelligence','Synthesis Agent','lead','grounded research synthesis',array['summarize evidence','separate facts from assumptions','create briefs'],array['read_artifacts','draft_briefs'],array['claim_without_source'],'team',true),
  ('research-intelligence','Vision/Frame Analyst','specialist','visual and frame evidence',array['analyze screenshots','summarize frame samples','flag uncertainty'],array['read_artifacts','vision_analysis'],array['silent_camera_activation'],'mission',true),
  ('product-builder','Product Architect','lead','system design and build order',array['write specs','define data models','sequence implementation'],array['read_repo','draft_specs'],array['merge_code'],'team',true),
  ('product-builder','QA/Review Agent','reviewer','quality and regressions',array['review scope','find missing tests','block unsafe work'],array['read_repo','draft_tests'],array['merge_code'],'mission',true),
  ('dealflow','Deal Analyst','lead','risk, upside, and fit',array['analyze deal terms','identify missing diligence','score fit'],array['read_artifacts','draft_briefs'],array['send_offers'],'team',true),
  ('dealflow','Outreach Agent','specialist','buyer and broker communication',array['draft outreach','prepare follow-ups','tailor messaging'],array['draft_messages'],array['send_messages'],'module',true),
  ('money','CFO Agent','lead','cash flow and financial risk',array['summarize cash position','rank urgent obligations','draft money actions'],array['read_context','draft_actions'],array['move_money','submit_payments'],'team',true),
  ('money','Credit/Funding Agent','specialist','credit and funding options',array['track credit risks','prepare funding questions','draft next steps'],array['read_context','draft_actions'],array['apply_for_credit'],'module',true),
  ('operations-admin','Operations Manager','lead','operational cleanup',array['organize admin work','create SOP drafts','route tasks'],array['read_context','draft_actions'],array['change_accounts'],'team',true),
  ('career-consulting','Proposal Writer','specialist','scope and client-ready proposals',array['draft proposals','shape deliverables','prepare pricing options'],array['read_context','draft_docs'],array['send_messages'],'module',true),
  ('security-privacy','Security Reviewer','reviewer','security and privacy gates',array['review risk','flag secret exposure','check approval boundaries'],array['read_metadata','draft_reviews'],array['expose_secrets'],'global_redacted',true),
  ('promptops-agent-quality','Prompt Engineer','specialist','agent instruction quality',array['improve prompts','version instructions','prepare evals'],array['read_prompts','draft_prompts'],array['activate_prompt_without_review'],'team',true),
  ('brand-content','Content Planner','lead','content strategy and distribution',array['plan content','draft hooks','turn briefs into posts'],array['draft_content','read_artifacts'],array['publish_content'],'team',true)
) as m(template_slug, name, role, lens, responsibilities, tools_allowed, blocked_actions, memory_scope, requires_review)
  on t.slug = m.template_slug and t.user_id is null;
