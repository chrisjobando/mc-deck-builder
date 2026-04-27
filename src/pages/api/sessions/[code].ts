import type { APIRoute } from 'astro';
import { requireAuth } from '../../../lib/auth';
import { prisma } from '../../../lib/db';
import { formatSessionForClient, getSessionByCode } from '../../../lib/sessions';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async (context) => {
  const authResult = await requireAuth(context);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const { code } = context.params;
  const session = await getSessionByCode(code!);
  if (!session) return json({ error: 'Session not found' }, 404);

  const isParticipant = session.participants.some((p) => p.userId === (user.id as string));
  const isHost = session.hostId === (user.id as string);
  if (!isParticipant && !isHost) return json({ error: 'Forbidden' }, 403);

  return json(formatSessionForClient(session));
};

export const DELETE: APIRoute = async (context) => {
  const authResult = await requireAuth(context);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const { code } = context.params;
  const session = await getSessionByCode(code!);
  if (!session) return json({ error: 'Session not found' }, 404);

  // Only the host can delete the session
  if (session.hostId !== (user.id as string)) {
    return json({ error: 'Only the host can delete a session' }, 403);
  }

  // Delete participants first (foreign key constraint)
  await prisma.sessionParticipant.deleteMany({
    where: { sessionId: session.id },
  });

  // Delete the session
  await prisma.session.delete({
    where: { id: session.id },
  });

  return json({ success: true });
};
