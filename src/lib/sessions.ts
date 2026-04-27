import { getUserOwnedPacks } from './auth';
import { prisma } from './db';
import { ALWAYS_OWNED_CODES } from './packs';

export const STATUS_LABEL: Record<string, string> = {
  draft: 'Lobby',
  drafting: 'Drafting',
  building: 'Building',
  completed: 'Completed',
};

export const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-white/10 text-gray-400',
  drafting: 'bg-yellow-500/20 text-yellow-300',
  building: 'bg-blue-500/20 text-blue-300',
  completed: 'bg-white/10 text-gray-400',
};

export async function getSessionByCode(code: string) {
  return prisma.session.findUnique({
    where: { inviteCode: code },
    include: {
      participants: {
        include: {
          user: { select: { id: true, name: true, image: true } },
          heroCard: { include: { identities: true } },
          deck: { select: { id: true, name: true, cards: true } },
        },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });
}

export type SessionWithParticipants = NonNullable<Awaited<ReturnType<typeof getSessionByCode>>>;

interface CardPoolItem {
  id: string;
  isUnique: boolean;
  quantity: number;
  packCodes: string[];
}

/**
 * Compute collection codes and card quantities based on session's collectionMode
 */
export async function computeSessionCollection(
  session: SessionWithParticipants,
  cardPool: CardPoolItem[]
): Promise<{ collectionCodes: string[]; cardQuantities: Record<string, number> }> {
  const cardQuantities: Record<string, number> = {};

  if (session.collectionMode === 'single') {
    const ownerId = session.collectionOwnerId ?? session.hostId;
    const ownerPacks = await getUserOwnedPacks(ownerId);
    return { collectionCodes: [...ALWAYS_OWNED_CODES, ...ownerPacks], cardQuantities };
  }

  // Combined or duplicates: gather all participants' packs
  const allPacks = await Promise.all(
    session.participants.map(p => getUserOwnedPacks(p.userId))
  );

  const packSet = new Set(ALWAYS_OWNED_CODES);
  for (const packs of allPacks) packs.forEach(p => packSet.add(p));

  if (session.collectionMode === 'duplicates') {
    // Sum card quantities across participants
    for (const card of cardPool) {
      let total = 0;
      for (const participantPacks of allPacks) {
        const owned = new Set([...ALWAYS_OWNED_CODES, ...participantPacks]);
        if (card.packCodes.some(pc => owned.has(pc))) total += card.quantity;
      }
      if (total > 0) cardQuantities[card.id] = total;
    }
  }

  return { collectionCodes: [...packSet], cardQuantities };
}

/**
 * Get map of unique cards used by teammates (for conflict detection)
 */
export function getTeammateUniqueCards(
  session: SessionWithParticipants,
  userId: string,
  cardPool: CardPoolItem[]
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  const cardById = new Map(cardPool.map(c => [c.id, c]));

  for (const p of session.participants) {
    if (p.userId === userId || !p.deck) continue;
    const cards = p.deck.cards as { cardId: string; quantity: number }[];
    for (const { cardId } of cards) {
      const card = cardById.get(cardId);
      if (card?.isUnique) {
        result[cardId] ??= [];
        result[cardId].push(p.user.name ?? 'Unknown');
      }
    }
  }
  return result;
}

/**
 * Format teammates for client display
 */
export function formatTeammates(session: SessionWithParticipants, userId: string) {
  return session.participants
    .filter(p => p.userId !== userId)
    .map(p => ({
      userId: p.userId,
      userName: p.user.name,
      userImage: p.user.image,
      heroName: p.heroCard?.name ?? null,
      heroImageUrl: p.heroCard?.identities.find(i => i.identityType === 'hero')?.imageUrl ?? null,
      aspects: p.aspects,
      deckName: p.deck?.name ?? null,
    }));
}

export function formatSessionForClient(
  session: NonNullable<Awaited<ReturnType<typeof getSessionByCode>>>
) {
  return {
    id: session.id,
    name: session.name,
    inviteCode: session.inviteCode,
    status: session.status,
    collectionMode: session.collectionMode,
    hostId: session.hostId,
    participants: session.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      userName: p.user.name,
      userImage: p.user.image,
      heroCardId: p.heroCardId,
      heroName: p.heroCard?.name ?? null,
      heroImageUrl:
        p.heroCard?.identities.find((i) => i.identityType === 'hero')?.imageUrl ?? null,
      deckId: p.deckId,
      deckName: p.deck?.name ?? null,
      aspects: p.aspects,
      isLocked: p.isLocked,
      joinedAt: p.joinedAt.toISOString(),
    })),
  };
}

export type LobbySession = ReturnType<typeof formatSessionForClient>;
export type LobbyParticipant = LobbySession['participants'][number];
