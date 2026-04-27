import { Aspect } from '@prisma/client';
import type { APIRoute } from 'astro';
import { requireAuth } from '../../../../lib/auth';
import { prisma } from '../../../../lib/db';
import { EVENTS, pusher, sessionChannel } from '../../../../lib/pusher';
import { formatSessionForClient, getSessionByCode } from '../../../../lib/sessions';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async (context) => {
  const authResult = await requireAuth(context);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const { code } = context.params;
  const session = await getSessionByCode(code!);
  if (!session) return json({ error: 'Session not found' }, 404);

  // Must be in building or completed phase
  if (session.status !== 'building' && session.status !== 'completed') {
    return json({ error: 'Session not in building phase' }, 400);
  }

  const participant = session.participants.find((p) => p.userId === (user.id as string));
  if (!participant) return json({ error: 'Not a participant' }, 403);

  // Must be locked in with a hero
  if (!participant.isLocked || !participant.heroCardId) {
    return json({ error: 'Must be locked in with a hero' }, 400);
  }

  let body: { name?: string; cards?: { cardId: string; quantity: number }[] };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { name, cards } = body;

  if (!name?.trim()) return json({ error: 'Name is required' }, 400);
  if (!cards?.length) return json({ error: 'Cards are required' }, 400);

  // Create or update deck
  const deckData = { name: name.trim(), cards };
  let deckId: string;
  const isUpdate = !!participant.deckId;

  if (isUpdate) {
    await prisma.deck.update({ where: { id: participant.deckId! }, data: deckData });
    deckId = participant.deckId!;
  } else {
    const deck = await prisma.deck.create({
      data: {
        ...deckData,
        heroCardId: participant.heroCardId,
        aspects: participant.aspects as Aspect[],
        isPublic: false,
        userId: user.id as string,
      },
    });
    deckId = deck.id;
    await prisma.sessionParticipant.update({
      where: { id: participant.id },
      data: { deckId },
    });
  }

  // Notify participants
  const updated = await getSessionByCode(code!);
  if (updated) {
    await pusher.trigger(sessionChannel(code!), EVENTS.PARTICIPANT_UPDATED, formatSessionForClient(updated));
  }

  return json({ deckId, updated: isUpdate });
};
