import type { APIRoute } from 'astro';
import { requireAuth } from '../../../lib/auth';
import { prisma } from '../../../lib/db';

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
