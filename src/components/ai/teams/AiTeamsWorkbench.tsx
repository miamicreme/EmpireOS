'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Card';
import { SkeletonRows } from '@/components/ui/Skeleton';

type TeamTemplate = {
  id: string;
  name: string;
  slug: string;
  type: string;
  group_name: string | null;
  purpose: string;
  default_autonomy_level: string;
  default_member_roles: string[];
  allowed_module_ids: string[];
  spawn_policy: string;
  max_concurrent_missions: number;
  members: Array<{ id: string; name: string; role: string; lens: string; responsibilities: string[] }>;
};

type Team = {
  id: string;
  name: string;
  slug: string;
  type: string;
  purpose: string;
  default_autonomy_level: string;
  status: string;
  members: Array<{ id: string; name: string; role: string; lens: string }>;
};

type Mission = {
  id: string;
  team_id: string | null;
  title: string;
  objective: string;
  status: string;
  priority: string;
  autonomy_level: string;
  review_required: boolean;
  created_at: string;
};

type View = 'org' | 'templates' | 'teams';

type MissionCreateResponse = { mission: Mission; team: Team };

function badgeVariant(value: string): 'green' | 'yellow' | 'red' | 'blue' | 'muted' | 'default' {
  if (['done', 'approved', 'active'].includes(value)) return 'green';
  if (['running', 'review', 'pending_approval'].includes(value)) return 'yellow';
  if (['blocked', 'cancelled', 'urgent'].includes(value)) return 'red';
  if (['high', 'review_required', 'supervised'].includes(value)) return 'blue';
  return 'muted';
}

function fmtDate(value: string) {
  return new Date(value).toLocaleString();
}

export function AiTeamsWorkbench({ view }: { view: View }) {
  const [templates, setTemplates] = useState<TeamTemplate[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [templateRes, teamRes, missionRes] = await Promise.all([
      api.get<TeamTemplate[]>('/api/ai/team-templates'),
      api.get<Team[]>('/api/ai/teams'),
      api.get<Mission[]>('/api/ai/missions'),
    ]);

    if (!templateRes.ok) setError(templateRes.error.message);
    else setTemplates(templateRes.data);

    if (!teamRes.ok) setError(teamRes.error.message);
    else setTeams(teamRes.data);

    if (!missionRes.ok) setError(missionRes.error.message);
    else setMissions(missionRes.data);

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groupedTemplates = useMemo(() => {
    return templates.reduce<Record<string, TeamTemplate[]>>((acc, template) => {
      const group = template.group_name ?? template.type;
      acc[group] = acc[group] ?? [];
      acc[group].push(template);
      return acc;
    }, {});
  }, [templates]);

  async function createMission(template: TeamTemplate) {
    setBusyId(template.id);
    setError(null);
    const response = await api.post<MissionCreateResponse>('/api/ai/missions', {
      teamTemplateId: template.id,
      title: `${template.name} activation mission`,
      objective: `Activate ${template.name} for a controlled EmpireOS mission. Define the first useful task plan, keep all outputs review-gated, and do not execute external actions without owner approval.`,
      priority: template.slug === 'chief-of-staff' ? 'high' : 'medium',
      autonomyLevel: template.default_autonomy_level,
      reviewRequired: true,
      metadata: { createdFrom: view },
    });
    setBusyId(null);
    if (!response.ok) {
      setError(response.error.message);
      return;
    }
    await load();
  }

  if (loading) return <SkeletonRows rows={6} />;

  if (error) {
    return (
      <Card className="border-empire-red/20">
        <div className="p-5">
          <EmptyState icon="!" message={error} />
          <div className="mt-4">
            <Button variant="secondary" onClick={() => void load()}>Retry</Button>
          </div>
        </div>
      </Card>
    );
  }

  if (view === 'org') {
    return (
      <div className="space-y-5">
        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-4">
            <Stat label="Templates" value={templates.length} />
            <Stat label="Active teams" value={teams.length} />
            <Stat label="Missions" value={missions.length} />
            <Stat label="Pending review" value={missions.filter((m) => ['pending_approval', 'review'].includes(m.status)).length} />
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">AI organization</p>
          <div className="mt-5 space-y-4">
            <OrgNode label="Owner" depth={0} />
            <OrgNode label="Spine" depth={1} />
            <OrgNode label="AI Chief of Staff" depth={2} />
            {Object.entries(groupedTemplates).map(([group, groupTemplates]) => (
              <div key={group} className="rounded-2xl border border-border bg-surface-0 p-4 ml-0 md:ml-10">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-100">{group}</p>
                    <p className="text-xs text-empire-muted">{groupTemplates.length} available team templates</p>
                  </div>
                  <Badge variant="blue">group</Badge>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {groupTemplates.map((template) => (
                    <div key={template.id} className="rounded-xl border border-border bg-surface-1 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-100">{template.name}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-empire-muted">{template.purpose}</p>
                        </div>
                        <Badge variant={badgeVariant(template.default_autonomy_level)}>{template.default_autonomy_level}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (view === 'templates') {
    return (
      <div className="space-y-4">
        {templates.length === 0 ? <EmptyState message="No AI team templates found." /> : null}
        {templates.map((template) => (
          <Card key={template.id} className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-100">{template.name}</h3>
                  <Badge variant="blue">{template.type}</Badge>
                  <Badge variant={badgeVariant(template.default_autonomy_level)}>{template.default_autonomy_level}</Badge>
                  <Badge variant="muted">{template.spawn_policy}</Badge>
                </div>
                <p className="mt-2 max-w-3xl text-sm text-empire-muted">{template.purpose}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {template.default_member_roles.map((role) => <Badge key={role} variant="default">{role}</Badge>)}
                </div>
              </div>
              <Button loading={busyId === template.id} onClick={() => void createMission(template)}>
                Create mission
              </Button>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">Active AI teams</p>
            <p className="mt-1 text-sm text-empire-muted">Teams wake up when a mission is created from a template.</p>
          </div>
          <Link className="text-sm font-mono text-empire-blue hover:underline" href="/ai/team-templates">Create from template</Link>
        </div>
      </Card>

      {teams.length === 0 ? <EmptyState message="No active AI teams yet. Create a mission from a template to instantiate one." /> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {teams.map((team) => (
          <Card key={team.id} className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-100">{team.name}</h3>
              <Badge variant="green">{team.status}</Badge>
              <Badge variant={badgeVariant(team.default_autonomy_level)}>{team.default_autonomy_level}</Badge>
            </div>
            <p className="mt-2 text-sm text-empire-muted">{team.purpose}</p>
            <div className="mt-4 space-y-2">
              {team.members.map((member) => (
                <div key={member.id} className="rounded-xl border border-border bg-surface-0 p-3">
                  <p className="text-sm font-medium text-gray-100">{member.name}</p>
                  <p className="text-xs text-empire-muted">{member.role} · {member.lens}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">Missions</p>
              {missions.filter((mission) => mission.team_id === team.id).slice(0, 4).map((mission) => (
                <Link key={mission.id} href={`/ai/missions/${mission.id}`} className="block rounded-xl border border-border bg-surface-0 p-3 hover:border-empire-blue/40">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-gray-100">{mission.title}</p>
                    <Badge variant={badgeVariant(mission.status)}>{mission.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-empire-muted">{fmtDate(mission.created_at)}</p>
                </Link>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-0 p-4">
      <p className="text-xs font-mono uppercase tracking-widest text-empire-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-gray-100">{value}</p>
    </div>
  );
}

function OrgNode({ label, depth }: { label: string; depth: number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-0 p-4" style={{ marginLeft: depth * 20 }}>
      <p className="text-sm font-semibold text-gray-100">{label}</p>
    </div>
  );
}
