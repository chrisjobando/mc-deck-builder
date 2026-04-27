import type { APIRoute } from 'astro';
import { requireAuth } from '../../../lib/auth';
import { prisma } from '../../../lib/db';
import type { CollectionMode } from '../../../lib/db';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async (context) => {
  const authResult = await requireAuth(context);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  let body: { name?: string; collectionMode?: string; collectionOwnerId?: string };
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { name, collectionMode, collectionOwnerId } = body;

  if (!name?.trim()) return json({ error: 'Name is required' }, 400);
  if (!['single', 'combined', 'duplicates'].includes(collectionMode ?? ''))
    return json({ error: 'Invalid collectionMode' }, 400);

  const generateCode = () => crypto.randomUUID().slice(0, 6).toUpperCase();

  let session;
  for (let attempt = 0; attempt < 5; attempt++) {
    const inviteCode = generateCode();
    try {
      session = await prisma.session.create({
        data: {
          name: name.trim(),
          inviteCode,
          collectionMode: collectionMode as CollectionMode,
          hostId: user.id as string,
          collectionOwnerId:
            collectionMode === 'single'
              ? (collectionOwnerId ?? (user.id as string))
              : null,
          participants: {
            create: { userId: user.id as string },
          },
        },
      });
      break;
    } catch (err: unknown) {
      const isPkConflict =
        err instanceof Error && 'code' in err && (err as { code: string }).code === 'P2002';
      if (!isPkConflict || attempt === 4) throw err;
    }
  }

  if (!session) return json({ error: 'Failed to generate unique invite code' }, 500);

  return json({ sessionId: session.id, inviteCode: session.inviteCode }, 201);
};
