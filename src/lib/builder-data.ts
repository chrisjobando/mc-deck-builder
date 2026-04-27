import { prisma } from './db';
export { heroSlug, WARLOCK_ID } from './utils';

export async function loadBuilderData() {
  const heroes = await prisma.heroCard.findMany({
    orderBy: { name: 'asc' },
    include: { identities: true },
  });

  const rawCards = await prisma.deckCard.findMany({ orderBy: { name: 'asc' } });

  // Deduplicate cards by name + text + heroId (reprints collapse to one entry)
  // Prefer the printing that has an image over one that doesn't
  const cardsByKey = new Map<string, typeof rawCards[0]>();
  const cardPacksMap = new Map<string, Set<string>>();
  const cardPackCodesMap = new Map<string, Set<string>>();
  const cardAllIdsMap = new Map<string, Set<string>>(); // Track ALL card IDs for each deduped entry
  for (const card of rawCards) {
    const key = `${card.name}|||${card.text ?? ''}|||${card.heroId ?? ''}|||${card.resourceEnergy ?? 0}|${card.resourceMental ?? 0}|${card.resourcePhysical ?? 0}|${card.resourceWild ?? 0}`;
    const existing = cardsByKey.get(key);
    if (!existing || (!existing.imageUrl && card.imageUrl)) {
      cardsByKey.set(key, card);
    }
    if (card.packName) {
      const s = cardPacksMap.get(key) ?? new Set<string>();
      s.add(card.packName);
      cardPacksMap.set(key, s);
    }
    if (card.packCode) {
      const s = cardPackCodesMap.get(key) ?? new Set<string>();
      s.add(card.packCode);
      cardPackCodesMap.set(key, s);
    }
    // Track all card IDs (MarvelCDB codes) for this card
    const ids = cardAllIdsMap.get(key) ?? new Set<string>();
    ids.add(card.id);
    cardAllIdsMap.set(key, ids);
  }

  const heroOptions = heroes
    .filter(h => h.identities.length > 0)
    .map(h => ({
      id: h.id,
      name: h.name,
      health: h.health,
      isMultiAspect: h.isMultiAspect,
      packCode: h.packCode,
      packName: h.packName,
      identities: h.identities.map(i => ({
        identityType: i.identityType,
        imageUrl: i.imageUrl,
        name: i.name,
      })),
    }));

  const cardPool = Array.from(cardsByKey.entries()).map(([key, c]) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    aspect: c.aspect,
    cost: c.cost,
    attack: c.attack,
    attackConsequential: c.attackConsequential,
    thwart: c.thwart,
    thwartConsequential: c.thwartConsequential,
    health: c.health,
    traits: c.traits,
    text: c.text,
    imageUrl: c.imageUrl,
    isPermanent: c.isPermanent,
    isUnique: c.isUnique,
    deckLimit: c.deckLimit,
    packCode: c.packCode,
    packName: c.packName,
    heroId: c.heroId,
    resourceEnergy: c.resourceEnergy,
    resourceMental: c.resourceMental,
    resourcePhysical: c.resourcePhysical,
    resourceWild: c.resourceWild,
    quantity: c.quantity,
    packs: [...(cardPacksMap.get(key) ?? (c.packName ? [c.packName] : []))].sort(),
    packCodes: [...(cardPackCodesMap.get(key) ?? (c.packCode ? [c.packCode] : []))].sort(),
    // All MarvelCDB card IDs that map to this deduplicated entry (for import matching)
    allIds: [...(cardAllIdsMap.get(key) ?? new Set([c.id]))],
  }));

  return { heroOptions, cardPool };
}
