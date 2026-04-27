import type { APIRoute } from 'astro';
import { requireAuth } from '../../../../lib/auth';
import { prisma } from '../../../../lib/db';
import { getSessionByCode, formatSessionForClient } from '../../../../lib/sessions';
import { pusher, sessionChannel, EVENTS } from '../../../../lib/pusher';
import type { Aspect } from '../../../../lib/db';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export const PATCH: APIRoute = async (context) => {
  const authResult = await requireAuth(context);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const { code } = context.params;
  const session = await getSessionByCode(code!);
  if (!session) return json({ error: 'Session not found' }, 404);

  const participant = session.participants.find((p) => p.userId === (user.id as string));
  if (!participant) return json({ error: 'Not a participant' }, 403);

  let body: { heroCardId?: string | null; aspects?: string[]; deckId?: string | null; isLocked?: boolean };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { heroCardId, aspects, deckId, isLocked } = body;

  // Once locked, hero/aspects cannot be changed
  if (participant.isLocked && (heroCardId !== undefined || aspects !== undefined))
    return json({ error: 'Cannot change hero or aspects after locking in' }, 400);

  // In build phase, hero/aspects are frozen
  if (session.status === 'building' && (heroCardId !== undefined || aspects !== undefined))
    return json({ error: 'Cannot change selections during build phase' }, 400);

  // isLocked is one-way: false → true only
  if (isLocked === false)
    return json({ error: 'Cannot unlock after locking in' }, 400);

  if (heroCardId !== undefined && heroCardId !== null) {
    const hero = await prisma.heroCard.findUnique({ where: { id: heroCardId } });
    if (!hero) return json({ error: 'Hero not found' }, 404);
  }

  if (deckId !== undefined && deckId !== null) {
    const deck = await prisma.deck.findUnique({ where: { id: deckId } });
    if (!deck) return json({ error: 'Deck not found' }, 404);
    if (deck.userId !== (user.id as string)) return json({ error: 'Forbidden' }, 403);
    const targetHeroId = heroCardId ?? participant.heroCardId;
    if (deck.heroCardId !== targetHeroId)
      return json({ error: 'Deck does not match selected hero' }, 400);
  }

  const updateData: {
    heroCardId?: string | null;
    aspects?: Aspect[];
    deckId?: string | null;
    isLocked?: boolean;
  } = {};
  if (heroCardId !== undefined) updateData.heroCardId = heroCardId;
  if (aspects !== undefined) updateData.aspects = aspects as Aspect[];
  if (deckId !== undefined) updateData.deckId = deckId;
  if (isLocked !== undefined) updateData.isLocked = isLocked;

  await prisma.sessionParticipant.update({
    where: { id: participant.id },
    data: updateData,
  });

  const updated = await getSessionByCode(code!);
  const formatted = formatSessionForClient(updated!);

  const event = isLocked ? EVENTS.PARTICIPANT_LOCKED : EVENTS.PARTICIPANT_UPDATED;
  await pusher.trigger(sessionChannel(code!), event, formatted);

  return json({ ok: true });
};
