import type { SupabaseClient } from '@supabase/supabase-js';
import { appError } from '@/lib/errors';
import { err, ok, type AppResult } from '@/lib/result';
import type {
  AiMission,
  AiTeam,
  AiTeamMember,
  AiTeamMemberTemplate,
  AiTeamTemplate,
  CreateMissionDTO,
  ListMissionsQuery,
  MissionTransitionDTO,
} from './team.schemas';

export type TeamTemplateWithMembers = AiTeamTemplate & {
  members: AiTeamMemberTemplate[];
};

export type TeamWithMembers = AiTeam & {
  members: AiTeamMember[];
};

export type MissionTaskRow = {
  id: string;
  user_id: string;
  mission_id: string;
  assigned_member_id: string | null;
  title: string;
  description: string | null;
  status: 'backlog' | 'ready' | 'running' | 'review' | 'done' | 'blocked';
  depends_on_task_ids: string[];
  output_artifact_ids: string[];
  review_notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type MissionMessageRow = {
  id: string;
  user_id: string;
  mission_id: string | null;
  team_id: string | null;
  sender_type: 'owner' | 'agent' | 'system';
  sender_name: string | null;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type MissionReviewRow = {
  id: string;
  user_id: string;
  mission_id: string;
  summary: string;
  output_artifact_ids: string[];
  action_draft_ids: string[];
  risks: string[];
  assumptions: string[];
  recommended_approval: 'approve' | 'revise' | 'reject';
  next_steps: string[];
  status: 'pending' | 'approved' | 'rejected' | 'revision_requested';
  reviewed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type MissionEventRow = {
  id: string;
  user_id: string;
  mission_id: string;
  event_type: string;
  summary: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type MissionDetail = {
  mission: AiMission;
  team: AiTeam | null;
  tasks: MissionTaskRow[];
  messages: MissionMessageRow[];
  reviews: MissionReviewRow[];
  events: MissionEventRow[];
};

function slugForInstance(slug: string): string {
  return `${slug}-${Date.now().toString(36)}`;
}

function titleFromObjective(objective: string): string {
  const clean = objective.trim().replace(/\s+/g, ' ');
  return clean.length > 80 ? `${clean.slice(0, 77)}...` : clean;
}

function reviewSummary(mission: AiMission): string {
  return `Review package for ${mission.title}. Confirm outputs, risks, assumptions, and next approved actions before the Spine is updated.`;
}

export async function listTeamTemplates(
  supabase: SupabaseClient,
  _userId: string,
): Promise<AppResult<TeamTemplateWithMembers[]>> {
  const { data: templates, error } = await supabase
    .from('ai_team_templates')
    .select('*')
    .eq('active', true)
    .order('type', { ascending: true })
    .order('name', { ascending: true });

  if (error) return err(appError('db_error', error.message));

  const rows = (templates ?? []) as AiTeamTemplate[];
  if (rows.length === 0) return ok([]);

  const { data: members, error: memberError } = await supabase
    .from('ai_team_member_templates')
    .select('*')
    .in('team_template_id', rows.map((row) => row.id))
    .order('created_at', { ascending: true });

  if (memberError) return err(appError('db_error', memberError.message));

  const memberRows = (members ?? []) as AiTeamMemberTemplate[];
  const byTemplate = new Map<string, AiTeamMemberTemplate[]>();
  for (const member of memberRows) {
    const list = byTemplate.get(member.team_template_id) ?? [];
    list.push(member);
    byTemplate.set(member.team_template_id, list);
  }

  return ok(
    rows.map((template) => ({
      ...template,
      members: byTemplate.get(template.id) ?? [],
    })),
  );
}

export async function listTeams(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppResult<TeamWithMembers[]>> {
  const { data: teams, error } = await supabase
    .from('ai_teams')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false });

  if (error) return err(appError('db_error', error.message));

  const rows = (teams ?? []) as AiTeam[];
  if (rows.length === 0) return ok([]);

  const { data: members, error: memberError } = await supabase
    .from('ai_team_members')
    .select('*')
    .eq('user_id', userId)
    .in('team_id', rows.map((row) => row.id))
    .order('created_at', { ascending: true });

  if (memberError) return err(appError('db_error', memberError.message));

  const memberRows = (members ?? []) as AiTeamMember[];
  const byTeam = new Map<string, AiTeamMember[]>();
  for (const member of memberRows) {
    const list = byTeam.get(member.team_id) ?? [];
    list.push(member);
    byTeam.set(member.team_id, list);
  }

  return ok(rows.map((team) => ({ ...team, members: byTeam.get(team.id) ?? [] })));
}

async function getTeamById(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
): Promise<AppResult<AiTeam>> {
  const { data, error } = await supabase
    .from('ai_teams')
    .select('*')
    .eq('id', teamId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return err(appError('db_error', error.message));
  if (!data) return err(appError('not_found', 'AI team not found.'));
  return ok(data as AiTeam);
}

async function instantiateTeamFromTemplate(
  supabase: SupabaseClient,
  userId: string,
  templateId: string,
): Promise<AppResult<AiTeam>> {
  const { data: template, error } = await supabase
    .from('ai_team_templates')
    .select('*')
    .eq('id', templateId)
    .eq('active', true)
    .maybeSingle();

  if (error) return err(appError('db_error', error.message));
  if (!template) return err(appError('not_found', 'AI team template not found.'));

  const t = template as AiTeamTemplate;

  const { data: existing, error: existingError } = await supabase
    .from('ai_teams')
    .select('*')
    .eq('user_id', userId)
    .eq('template_id', t.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) return err(appError('db_error', existingError.message));
  if (existing) return ok(existing as AiTeam);

  const { data: team, error: teamError } = await supabase
    .from('ai_teams')
    .insert({
      user_id: userId,
      template_id: t.id,
      name: t.name,
      slug: slugForInstance(t.slug),
      type: t.type,
      purpose: t.purpose,
      default_autonomy_level: t.default_autonomy_level,
      allowed_module_ids: t.allowed_module_ids,
      allowed_action_types: t.allowed_action_types,
      spawn_policy: t.spawn_policy,
      max_concurrent_missions: t.max_concurrent_missions,
      status: 'active',
      metadata: { sourceTemplateSlug: t.slug },
    })
    .select('*')
    .single();

  if (teamError) return err(appError('db_error', teamError.message));

  const createdTeam = team as AiTeam;

  const { data: memberTemplates, error: memberTemplateError } = await supabase
    .from('ai_team_member_templates')
    .select('*')
    .eq('team_template_id', t.id)
    .order('created_at', { ascending: true });

  if (memberTemplateError) return err(appError('db_error', memberTemplateError.message));

  const members = ((memberTemplates ?? []) as AiTeamMemberTemplate[]).map((member) => ({
    user_id: userId,
    team_id: createdTeam.id,
    template_member_id: member.id,
    name: member.name,
    role: member.role,
    lens: member.lens,
    responsibilities: member.responsibilities,
    tools_allowed: member.tools_allowed,
    blocked_actions: member.blocked_actions,
    model_preference: member.model_preference ?? null,
    memory_scope: member.memory_scope,
    requires_review: member.requires_review,
    status: 'active',
    metadata: { sourceTemplateMemberId: member.id },
  }));

  if (members.length > 0) {
    const { error: memberError } = await supabase.from('ai_team_members').insert(members);
    if (memberError) return err(appError('db_error', memberError.message));
  }

  return ok(createdTeam);
}

export async function createMissionDraft(
  supabase: SupabaseClient,
  userId: string,
  input: CreateMissionDTO,
): Promise<AppResult<{ mission: AiMission; team: AiTeam }>> {
  const teamResult = input.teamId
    ? await getTeamById(supabase, userId, input.teamId)
    : await instantiateTeamFromTemplate(supabase, userId, input.teamTemplateId as string);

  if (!teamResult.ok) return teamResult;
  const team = teamResult.data;

  const { data, error } = await supabase
    .from('ai_missions')
    .insert({
      user_id: userId,
      team_id: team.id,
      source: input.source,
      source_id: input.sourceId ?? null,
      title: input.title ?? titleFromObjective(input.objective),
      objective: input.objective,
      status: 'pending_approval',
      priority: input.priority,
      module_ids: input.moduleIds,
      input_artifact_ids: input.inputArtifactIds,
      linked_action_draft_ids: input.linkedActionDraftIds,
      autonomy_level: input.autonomyLevel ?? team.default_autonomy_level,
      review_required: input.reviewRequired,
      metadata: {
        ...input.metadata,
        createdBy: 'ai_teams_core',
        sourceTeamTemplateId: input.teamTemplateId ?? null,
      },
    })
    .select('*')
    .single();

  if (error) return err(appError('db_error', error.message));

  const mission = data as AiMission;
  await appendMissionEvent(supabase, userId, mission.id, 'mission_created', 'Mission draft created and pending owner approval.', {
    teamId: team.id,
    teamName: team.name,
  });

  return ok({ mission, team });
}

export async function listMissions(
  supabase: SupabaseClient,
  userId: string,
  query: ListMissionsQuery = {},
): Promise<AppResult<AiMission[]>> {
  let builder = supabase
    .from('ai_missions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (query.status) builder = builder.eq('status', query.status);
  if (query.teamId) builder = builder.eq('team_id', query.teamId);

  const { data, error } = await builder;
  if (error) return err(appError('db_error', error.message));
  return ok((data ?? []) as AiMission[]);
}

export async function getMissionDetail(
  supabase: SupabaseClient,
  userId: string,
  missionId: string,
): Promise<AppResult<MissionDetail>> {
  const { data: mission, error } = await supabase
    .from('ai_missions')
    .select('*')
    .eq('id', missionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return err(appError('db_error', error.message));
  if (!mission) return err(appError('not_found', 'AI mission not found.'));

  const row = mission as AiMission;
  const [team, tasks, messages, reviews, events] = await Promise.all([
    row.team_id
      ? supabase.from('ai_teams').select('*').eq('id', row.team_id).eq('user_id', userId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from('ai_mission_tasks').select('*').eq('mission_id', row.id).eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('ai_team_messages').select('*').eq('mission_id', row.id).eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('ai_mission_reviews').select('*').eq('mission_id', row.id).eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('ai_mission_events').select('*').eq('mission_id', row.id).eq('user_id', userId).order('created_at', { ascending: true }),
  ]);

  for (const result of [team, tasks, messages, reviews, events]) {
    if (result.error) return err(appError('db_error', result.error.message));
  }

  return ok({
    mission: row,
    team: (team.data as AiTeam | null) ?? null,
    tasks: (tasks.data ?? []) as MissionTaskRow[],
    messages: (messages.data ?? []) as MissionMessageRow[],
    reviews: (reviews.data ?? []) as MissionReviewRow[],
    events: (events.data ?? []) as MissionEventRow[],
  });
}

export async function transitionMission(
  supabase: SupabaseClient,
  userId: string,
  missionId: string,
  input: MissionTransitionDTO,
): Promise<AppResult<MissionDetail>> {
  const detail = await getMissionDetail(supabase, userId, missionId);
  if (!detail.ok) return detail;

  const { mission, team, tasks } = detail.data;
  const now = new Date().toISOString();

  if (input.action === 'approve') {
    if (!['draft', 'pending_approval'].includes(mission.status)) {
      return err(appError('invalid_state', 'Only draft or pending missions can be approved.'));
    }

    const { data: members, error: membersError } = await supabase
      .from('ai_team_members')
      .select('*')
      .eq('user_id', userId)
      .eq('team_id', mission.team_id)
      .eq('status', 'active')
      .order('created_at', { ascending: true });

    if (membersError) return err(appError('db_error', membersError.message));

    const memberRows = (members ?? []) as AiTeamMember[];
    if (tasks.length === 0) {
      const rows = [
        ...memberRows.slice(0, 6).map((member) => ({
          user_id: userId,
          mission_id: mission.id,
          assigned_member_id: member.id,
          title: `${member.role}: ${mission.title}`.slice(0, 240),
          description: `Work through the ${member.lens} lens. Responsibilities: ${member.responsibilities.join(', ') || 'prepare a focused contribution'}. Output must become a reviewable artifact or notes for owner review.`,
          status: 'ready',
          metadata: { generatedBy: 'mission_approval', memberName: member.name },
        })),
        {
          user_id: userId,
          mission_id: mission.id,
          assigned_member_id: null,
          title: 'Prepare owner review package',
          description: 'Summarize outputs, risks, assumptions, action drafts, and recommended next steps before anything updates the Spine.',
          status: 'ready',
          metadata: { generatedBy: 'mission_approval', reviewTask: true },
        },
      ];

      const { error: taskError } = await supabase.from('ai_mission_tasks').insert(rows);
      if (taskError) return err(appError('db_error', taskError.message));
    }

    const { error: updateError } = await supabase
      .from('ai_missions')
      .update({ status: 'approved', approved_at: now })
      .eq('id', mission.id)
      .eq('user_id', userId);
    if (updateError) return err(appError('db_error', updateError.message));

    await appendMissionEvent(supabase, userId, mission.id, 'mission_approved', input.note ?? 'Mission approved by owner.', { teamName: team?.name });
    await appendMissionMessage(supabase, userId, mission.id, mission.team_id, 'system', 'EmpireOS', `Mission approved. ${team?.name ?? 'AI team'} can prepare controlled work for review.`);
  }

  if (input.action === 'start') {
    if (!['approved', 'blocked'].includes(mission.status)) {
      return err(appError('invalid_state', 'Only approved or blocked missions can be started.'));
    }
    const { error: updateError } = await supabase
      .from('ai_missions')
      .update({ status: 'running', started_at: mission.started_at ?? now })
      .eq('id', mission.id)
      .eq('user_id', userId);
    if (updateError) return err(appError('db_error', updateError.message));
    await appendMissionEvent(supabase, userId, mission.id, 'mission_started', input.note ?? 'Mission moved to running.', {});
  }

  if (input.action === 'send_to_review') {
    if (!['approved', 'running', 'blocked'].includes(mission.status)) {
      return err(appError('invalid_state', 'Only approved, running, or blocked missions can be sent to review.'));
    }
    const { error: reviewError } = await supabase.from('ai_mission_reviews').insert({
      user_id: userId,
      mission_id: mission.id,
      summary: input.note ?? reviewSummary(mission),
      risks: ['Execution has not been fully automated yet; verify outputs before approval.'],
      assumptions: ['Tasks were generated from the team template and mission objective.'],
      recommended_approval: 'revise',
      next_steps: ['Review generated tasks', 'Route approved task work through POST /api/ai/agent/run', 'Approve only safe action drafts'],
      status: 'pending',
      metadata: { generatedBy: 'mission_transition' },
    });
    if (reviewError) return err(appError('db_error', reviewError.message));

    const { error: updateError } = await supabase
      .from('ai_missions')
      .update({ status: 'review' })
      .eq('id', mission.id)
      .eq('user_id', userId);
    if (updateError) return err(appError('db_error', updateError.message));
    await appendMissionEvent(supabase, userId, mission.id, 'mission_sent_to_review', input.note ?? 'Mission review package created.', {});
  }

  if (input.action === 'complete') {
    if (mission.status !== 'review') {
      return err(appError('invalid_state', 'Only missions in review can be completed.'));
    }
    const { error: updateError } = await supabase
      .from('ai_missions')
      .update({ status: 'done', completed_at: now })
      .eq('id', mission.id)
      .eq('user_id', userId);
    if (updateError) return err(appError('db_error', updateError.message));
    await appendMissionEvent(supabase, userId, mission.id, 'mission_completed', input.note ?? 'Mission completed after review.', {});
  }

  if (input.action === 'block') {
    const { error: updateError } = await supabase
      .from('ai_missions')
      .update({ status: 'blocked' })
      .eq('id', mission.id)
      .eq('user_id', userId);
    if (updateError) return err(appError('db_error', updateError.message));
    await appendMissionEvent(supabase, userId, mission.id, 'mission_blocked', input.note ?? 'Mission blocked.', {});
  }

  if (input.action === 'cancel') {
    const { error: updateError } = await supabase
      .from('ai_missions')
      .update({ status: 'cancelled', cancelled_at: now })
      .eq('id', mission.id)
      .eq('user_id', userId);
    if (updateError) return err(appError('db_error', updateError.message));
    await appendMissionEvent(supabase, userId, mission.id, 'mission_cancelled', input.note ?? 'Mission cancelled.', {});
  }

  return getMissionDetail(supabase, userId, missionId);
}

export async function appendMissionEvent(
  supabase: SupabaseClient,
  userId: string,
  missionId: string,
  eventType: string,
  summary: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await supabase.from('ai_mission_events').insert({
    user_id: userId,
    mission_id: missionId,
    event_type: eventType,
    summary,
    payload,
  });
}

async function appendMissionMessage(
  supabase: SupabaseClient,
  userId: string,
  missionId: string,
  teamId: string | null,
  senderType: 'owner' | 'agent' | 'system',
  senderName: string,
  content: string,
): Promise<void> {
  await supabase.from('ai_team_messages').insert({
    user_id: userId,
    mission_id: missionId,
    team_id: teamId,
    sender_type: senderType,
    sender_name: senderName,
    content,
  });
}
