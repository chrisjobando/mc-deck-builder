import { prisma } from './db';

export function heroSlug(name: string, id: string): string {
  const nameSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${nameSlug}-${id}`;
}

export async function loadBuilderData() {
  const heroes = await prisma.heroCard.findMany({
    orderBy: { name: 'asc' },
    include: { identities: true },
  });

  const rawCards = await prisma.deckCard.findMany({ orderBy: { name: 'asc' } });

  // Deduplicate cards by name + text + heroId (reprints collapse to one entry)
  // Prefer the printing that has an image over one that doesn't
  const cardsByKey = new Map<string, typeof rawCards[0]>();
  const cardPacksMap = new Map<string, string[]>();
  for (const card of rawCards) {
    const key = `${card.name}|||${card.text ?? ''}|||${card.heroId ?? ''}|||${card.resourceEnergy ?? 0}|${card.resourceMental ?? 0}|${card.resourcePhysical ?? 0}|${card.resourceWild ?? 0}`;
    const existing = cardsByKey.get(key);
    if (!existing || (!existing.imageUrl && card.imageUrl)) {
      cardsByKey.set(key, card);
    }
    const packs = cardPacksMap.get(key) ?? [];
    if (card.packName && !packs.includes(card.packName)) packs.push(card.packName);
    cardPacksMap.set(key, packs);
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
    packs: (cardPacksMap.get(key) ?? [c.packName ?? '']).sort(),
  }));

  return { heroOptions, cardPool };
}
