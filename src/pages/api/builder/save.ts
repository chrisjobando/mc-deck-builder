import type { APIRoute } from 'astro';
import { requireAuth } from '../../../lib/auth';
import { prisma } from '../../../lib/db';
import { Aspect } from '@prisma/client';

export const POST: APIRoute = async context => {
  const authResult = await requireAuth(context);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  let body: { name?: string; heroCardId?: string; aspects?: string[]; cards?: unknown; isPublic?: boolean };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { name, heroCardId, aspects, cards, isPublic } = body;

  if (!name || !heroCardId || !aspects?.length) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const hero = await prisma.heroCard.findUnique({ where: { id: heroCardId } });
  if (!hero) {
    return new Response(JSON.stringify({ error: 'Hero not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const deck = await prisma.deck.create({
    data: {
      name,
      heroCardId,
      aspects: aspects.map(a => a as Aspect),
      cards: cards ?? [],
      isPublic: isPublic ?? false,
      userId: user.id as string,
    },
  });

  return new Response(JSON.stringify({ deckId: deck.id }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
