import type { APIRoute } from 'astro';
import { requireAuth } from '../../../../lib/auth';
import { prisma } from '../../../../lib/db';
import { getSessionByCode, formatSessionForClient } from '../../../../lib/sessions';
import { pusher, sessionChannel, EVENTS } from '../../../../lib/pusher';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async (context) => {
  const authResult = await requireAuth(context);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const { code } = context.params;
  const session = await getSessionByCode(code!);
  if (!session) return json({ error: 'Session not found' }, 404);

  if (session.status === 'completed') return json({ error: 'Session is completed' }, 409);

  const existing = session.participants.find((p) => p.userId === (user.id as string));
  if (existing) return json(formatSessionForClient(session));

  if (session.participants.length >= 4) return json({ error: 'Session is full' }, 409);

  await prisma.sessionParticipant.create({
    data: { sessionId: session.id, userId: user.id as string },
  });

  const updated = await getSessionByCode(code!);
  const formatted = formatSessionForClient(updated!);

  await pusher.trigger(sessionChannel(code!), EVENTS.PARTICIPANT_JOINED, formatted);

  return json(formatted);
};
