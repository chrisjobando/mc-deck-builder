import type { APIRoute } from 'astro';
import { requireAuth } from '../../../lib/auth';
import { prisma } from '../../../lib/db';
import { ALL_PACKS, ALWAYS_OWNED_CODES } from '../../../lib/packs';

const VALID_CODES = new Set(ALL_PACKS.map(p => p.code));

export const PUT: APIRoute = async context => {
  const authResult = await requireAuth(context);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (!Array.isArray(body) || !body.every(x => typeof x === 'string')) {
    return new Response('Expected array of pack codes', { status: 400 });
  }

  const codes = (body as string[]).filter(
    code => VALID_CODES.has(code) && !ALWAYS_OWNED_CODES.has(code)
  );

  await prisma.user.update({
    where: { id: user.id },
    data: { ownedPacks: codes },
  });

  return new Response(JSON.stringify({ ownedPacks: codes }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
