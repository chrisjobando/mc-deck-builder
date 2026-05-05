import { prisma } from './db';
export { heroSlug, WARLOCK_ID } from './utils';

export async function loadEncounterSets() {
  const rows = await prisma.encounterCard.findMany({
    where: { heroId: null },
    select: { setCode: true, setName: true, setType: true, packName: true },
    orderBy: { setName: 'asc' },
  });
  const seen = new Set<string>();
  const sets: { setCode: string; setName: string; setType: string; packName: string | null }[] = [];
  for (const r of rows) {
    if (!r.setName || seen.has(r.setCode)) continue;
    seen.add(r.setCode);
    sets.push({ setCode: r.setCode, setName: r.setName, setType: r.setType, packName: r.packName });
  }
  return sets;
}

export async function loadBuilderData() {
  const [heroes, rawCards, heroEncounterRows] = await Promise.all([
    prisma.heroCard.findMany({ orderBy: { name: 'asc' }, include: { identities: true } }),
    prisma.deckCard.findMany({ orderBy: { name: 'asc' } }),
    prisma.encounterCard.findMany({
      where: { heroId: { not: null } },
      orderBy: [{ heroId: 'asc' }, { type: 'asc' }],
    }),
  ]);

  const encounterByHero = new Map<string, typeof heroEncounterRows>();
  for (const c of heroEncounterRows) {
    if (!c.heroId) continue;
    if (!encounterByHero.has(c.heroId)) encounterByHero.set(c.heroId, []);
    encounterByHero.get(c.heroId)!.push(c);
  }

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
        attack: i.attack,
        thwart: i.thwart,
        defense: i.defense,
        handSize: i.handSize,
        recover: i.recover,
      })),
      encounterCards: (encounterByHero.get(h.id) ?? []).map(c => ({
        type: c.type,
        name: c.name,
        text: c.text,
        traits: c.traits,
        attack: c.attack,
        health: c.health,
        scheme: c.scheme,
        baseThreat: c.baseThreat,
        baseThreatFixed: c.baseThreatFixed,
        isHealthPerHero: c.isHealthPerHero,
        schemeAcceleration: c.schemeAcceleration,
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
