import type { APIRoute } from 'astro';
import { requireAuth } from '../../../lib/auth';
import { prisma } from '../../../lib/db';
import { Aspect, type Prisma } from '@prisma/client';

export const PUT: APIRoute = async context => {
  const authResult = await requireAuth(context);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const { id } = context.params;
  if (!id) return new Response(null, { status: 400 });

  const deck = await prisma.deck.findUnique({ where: { id } });
  if (!deck) return new Response(null, { status: 404 });
  if (deck.userId !== user.id) return new Response(null, { status: 403 });

  let body: { name?: string; aspects?: string[]; cards?: unknown };
  try { body = await context.request.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { name, aspects, cards } = body;
  await prisma.deck.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(aspects && { aspects: aspects.map(a => a as Aspect) }),
      ...(cards !== undefined && { cards: cards as Prisma.InputJsonValue }),
    },
  });

  return new Response(null, { status: 204 });
};

export const DELETE: APIRoute = async context => {
  const authResult = await requireAuth(context);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const { id } = context.params;
  if (!id) return new Response(null, { status: 400 });

  const deck = await prisma.deck.findUnique({ where: { id } });
  if (!deck) return new Response(null, { status: 404 });
  if (deck.userId !== user.id) return new Response(null, { status: 403 });

  await prisma.deck.delete({ where: { id } });
  return new Response(null, { status: 204 });
};
