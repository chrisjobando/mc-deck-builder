import type { APIRoute } from 'astro';
import { requireAuth } from '../../../../lib/auth';
import type { SessionStatus } from '../../../../lib/db';
import { prisma } from '../../../../lib/db';
import { EVENTS, pusher, sessionChannel } from '../../../../lib/pusher';
import { formatSessionForClient, getSessionByCode } from '../../../../lib/sessions';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['drafting'],
  drafting: ['draft', 'building'],
  building: ['drafting', 'completed'],
  completed: ['building'],
};

export const PATCH: APIRoute = async (context) => {
  const authResult = await requireAuth(context);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const { code } = context.params;
  const session = await getSessionByCode(code!);
  if (!session) return json({ error: 'Session not found' }, 404);

  if (session.hostId !== (user.id as string)) return json({ error: 'Forbidden' }, 403);

  let body: { status?: string };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { status } = body;

  if (!VALID_TRANSITIONS[session.status]?.includes(status as string))
    return json({ error: `Invalid transition: ${session.status} → ${status}` }, 400);

  // Can only move to building when all participants are locked in
  if (status === 'building') {
    const allLocked = session.participants.every((p) => p.isLocked);
    if (!allLocked) return json({ error: 'All players must lock in before starting the build phase' }, 400);
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { status: status as SessionStatus },
  });

  const updated = await getSessionByCode(code!);
  const formatted = formatSessionForClient(updated!);

  await pusher.trigger(sessionChannel(code!), EVENTS.STATUS_CHANGED, formatted);

  return json({ ok: true });
};
