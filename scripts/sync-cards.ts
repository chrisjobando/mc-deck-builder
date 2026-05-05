import 'dotenv/config';
import crypto from 'node:crypto';
import postgres from 'postgres';

const MARVELCDB_BASE = 'https://marvelcdb.com';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const sql = postgres(databaseUrl, { prepare: false, max: 1 });
const forceSync = process.argv.includes('--force');

interface MarvelCDBCard {
  code: string;
  name: string;
  type_code: string;
  faction_code: string;
  card_set_code: string;
  card_set_type_name_code: string;
  pack_code: string;
  pack_name: string;
  health?: number;
  attack?: number;
  attack_cost?: number;
  defense?: number;
  hand_size?: number;
  recover?: number;
  thwart?: number;
  thwart_cost?: number;
  cost?: number;
  deck_limit?: number;
  quantity?: number;
  resource_energy?: number;
  resource_mental?: number;
  resource_physical?: number;
  resource_wild?: number;
  text?: string;
  traits?: string;
  imagesrc?: string;
  is_unique?: boolean;
  permanent?: boolean;
  meta?: { multi_aspect?: boolean };
  // Encounter card fields
  scheme?: number;
  base_threat?: number;
  base_threat_fixed?: boolean;
  base_threat_per_group?: boolean;
  health_per_hero?: boolean;
  scheme_acceleration?: number;
  boost?: number;
  card_set_name?: string;
  // For hero_special sub-sets, links back to the parent hero's card_set_code
  card_set_parent_code?: string;
  // Linked cards (e.g., alter_ego linked to hero)
  linked_card?: MarvelCDBCard;
}

interface SyncStats {
  new: number;
  updated: number;
  skipped: number;
}

interface HashRow {
  id: string;
  data_hash: string;
}

interface MarvelCDBPack {
  code: string;
  name: string;
  position: number;
  available: string;
  known: number;
  total: number;
  url: string;
  id: number;
}

interface SyncedPackRow {
  code: string;
  data_hash: string;
}

interface HeroRow {
  id: string;
  data_hash: string;
  card_set_code: string | null;
}

const HERO_TYPE = 'hero';
const ALTER_EGO_TYPE = 'alter_ego';
const DECK_CARD_TYPES = ['ally', 'event', 'support', 'upgrade', 'resource', 'player_side_scheme'];
const ENCOUNTER_CARD_TYPES = [
  'obligation', 'minion', 'treachery', 'side_scheme',
  'attachment', 'environment', 'villain', 'main_scheme',
];
const ENCOUNTER_SET_TYPES = ['hero', 'hero_special', 'villain', 'modular', 'scenario', 'campaign'];
const EXCLUDED_SET_TYPES = ['modular', 'villain', 'scenario', 'campaign'];
const HERO_SET_TYPES = new Set(['hero', 'hero_special']);

const FACTION_TO_ASPECT: Record<string, string> = {
  aggression: 'Aggression',
  justice: 'Justice',
  leadership: 'Leadership',
  protection: 'Protection',
  basic: 'Basic',
  pool: 'Pool',
};

function computeHash(obj: unknown): string {
  return crypto.createHash('md5').update(JSON.stringify(obj)).digest('hex');
}

async function fetchJson<T>(url: string): Promise<T> {
  console.log(`Fetching ${url}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json() as Promise<T>;
}

async function syncCards(): Promise<void> {
  console.log('🚀 Starting MarvelCDB sync...\n');
  if (forceSync) console.log('⚠️  Force sync enabled - all cards will be updated\n');

  const [apiPacks, existingSyncedPacks] = await Promise.all([
    fetchJson<MarvelCDBPack[]>(`${MARVELCDB_BASE}/api/public/packs/`),
    sql<SyncedPackRow[]>`SELECT code, data_hash FROM synced_packs`,
  ]);
  console.log(`📚 Found ${apiPacks.length} packs in API`);
  const syncedPackMap = new Map(existingSyncedPacks.map((p) => [p.code, p.data_hash]));
  console.log(`  ${syncedPackMap.size} packs already synced\n`);

  // Determine which packs need syncing; cache hash for reuse when writing synced_packs
  const packHashMap = new Map<string, string>();
  const packsToSync: MarvelCDBPack[] = [];
  for (const pack of apiPacks) {
    const packHash = computeHash({ name: pack.name, position: pack.position, available: pack.available, known: pack.known, total: pack.total });
    packHashMap.set(pack.code, packHash);
    const existingHash = syncedPackMap.get(pack.code);
    if (forceSync || !existingHash || existingHash !== packHash) {
      packsToSync.push(pack);
    }
  }

  if (packsToSync.length === 0) {
    console.log('✅ All packs up to date, nothing to sync!');
    await sql.end();
    return;
  }

  console.log(`📦 ${packsToSync.length} pack(s) to sync: ${packsToSync.map(p => p.code).join(', ')}\n`);

  const allCards: MarvelCDBCard[] = [];
  for (const [i, pack] of packsToSync.entries()) {
    const packCards = await fetchJson<MarvelCDBCard[]>(`${MARVELCDB_BASE}/api/public/cards/${pack.code}`);
    // Extract linked_card objects (e.g., alter_ego cards nested inside hero cards)
    for (const card of packCards) {
      allCards.push(card);
      if (card.linked_card) {
        // Copy pack info to linked card since it may be missing
        const linkedCard = { ...card.linked_card, pack_code: card.pack_code, pack_name: card.pack_name };
        allCards.push(linkedCard);
      }
    }
    process.stdout.write(`\r  Fetched ${allCards.length} cards from ${i + 1}/${packsToSync.length} packs`);
  }
  console.log(`\n📦 Fetched ${allCards.length} total cards from packs to sync\n`);

  console.log('Loading existing card hashes...');
  const [existingHeroRows, existingIdentities, existingDeckCards, existingEncounterCards] = await Promise.all([
    sql<HeroRow[]>`SELECT id, data_hash, card_set_code FROM hero_cards`,
    sql<HashRow[]>`SELECT id, data_hash FROM hero_identities`,
    sql<HashRow[]>`SELECT id, data_hash FROM deck_cards`,
    sql<HashRow[]>`SELECT id, data_hash FROM encounter_cards`,
  ]);

  const heroHashMap = new Map(existingHeroRows.map((c) => [c.id, c.data_hash]));
  const identityHashMap = new Map(existingIdentities.map((c) => [c.id, c.data_hash]));
  const deckHashMap = new Map(existingDeckCards.map((c) => [c.id, c.data_hash]));
  const encounterHashMap = new Map(existingEncounterCards.map((c) => [c.id, c.data_hash]));

  const dbHeroSetCodeMap = new Map<string, string>(); // setCode -> heroId
  for (const row of existingHeroRows) {
    if (row.card_set_code) dbHeroSetCodeMap.set(row.card_set_code, row.id);
  }

  console.log(
    `  Found ${heroHashMap.size} heroes, ${identityHashMap.size} identities, ${deckHashMap.size} deck cards, ${encounterHashMap.size} encounter cards\n`
  );

  const heroCards = allCards.filter((c) => c.type_code === HERO_TYPE);
  const alterEgoCards = allCards.filter((c) => c.type_code === ALTER_EGO_TYPE);

  const deckCards = allCards.filter((c) => {
    if (c.faction_code !== 'hero' && !(c.faction_code in FACTION_TO_ASPECT)) return false;
    if (DECK_CARD_TYPES.includes(c.type_code)) return !EXCLUDED_SET_TYPES.includes(c.card_set_type_name_code);
    // attachment/obligation types in hero_special sets are player cards (e.g. Hercules Labor Deck)
    return c.faction_code === 'hero' && c.card_set_type_name_code === 'hero_special' &&
      (c.type_code === 'attachment' || c.type_code === 'obligation');
  });

  // Exclude hero-faction cards — they belong in deck_cards, not encounter_cards
  const allEncounterCards = allCards.filter(
    (c) =>
      ENCOUNTER_CARD_TYPES.includes(c.type_code) &&
      ENCOUNTER_SET_TYPES.includes(c.card_set_type_name_code) &&
      c.faction_code !== 'hero'
  );

  console.log(`🦸 Found ${heroCards.length} hero cards`);
  console.log(`🎭 Found ${alterEgoCards.length} alter ego cards`);
  console.log(`🃏 Found ${deckCards.length} deck-building cards`);
  console.log(`⚔️  Found ${allEncounterCards.length} encounter cards\n`);

  const heroSetMap = new Map<string, MarvelCDBCard[]>();
  for (const card of heroCards) {
    const setCode = card.card_set_code;
    if (!heroSetMap.has(setCode)) heroSetMap.set(setCode, []);
    heroSetMap.get(setCode)!.push(card);
  }

  const validHeroSets = new Set<string>();
  for (const card of heroCards) {
    const hasAlterEgo = alterEgoCards.some((ae) => ae.card_set_code === card.card_set_code);
    if (hasAlterEgo) validHeroSets.add(card.card_set_code);
  }

  // Sync hero cards
  console.log('Syncing hero cards...');
  const heroStats: SyncStats = { new: 0, updated: 0, skipped: 0 };
  for (const card of heroCards) {
    if (!validHeroSets.has(card.card_set_code)) continue;

    const heroesInSet = heroSetMap.get(card.card_set_code) ?? [];
    const isPrimary = heroesInSet[0]?.code === card.code;
    if (!isPrimary) continue;

    // MarvelCDB doesn't reliably return meta.multi_aspect; hardcode known heroes
    // Spider-Woman uses 2 aspects; Adam Warlock uses all 4 (flagged here, handled in builder)
    const MULTI_ASPECT_HERO_IDS = new Set(['04031a', '21031a']); // Spider-Woman, Adam Warlock
    const isMultiAspect = card.meta?.multi_aspect ?? MULTI_ASPECT_HERO_IDS.has(card.code);

    const hashData = {
      name: card.name,
      health: card.health ?? 10,
      isMultiAspect,
      cardSetCode: card.card_set_code,
      packCode: card.pack_code,
      packName: card.pack_name,
    };
    const dataHash = computeHash(hashData);

    // Always populate maps from current API data before the hash skip check,
    // so deck/encounter card lookups work even when the hero record is unchanged.
    dbHeroSetCodeMap.set(card.card_set_code, card.code);

    const existingHash = heroHashMap.get(card.code);
    if (!forceSync && existingHash === dataHash) {
      heroStats.skipped++;
      continue;
    }

    await sql`
      INSERT INTO hero_cards (
        id, name, health, is_multi_aspect, card_set_code, pack_code, pack_name, data_hash, synced_at
      ) VALUES (
        ${card.code},
        ${card.name},
        ${card.health ?? 10},
        ${isMultiAspect},
        ${card.card_set_code},
        ${card.pack_code},
        ${card.pack_name},
        ${dataHash},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        health = EXCLUDED.health,
        is_multi_aspect = EXCLUDED.is_multi_aspect,
        card_set_code = EXCLUDED.card_set_code,
        pack_code = EXCLUDED.pack_code,
        pack_name = EXCLUDED.pack_name,
        data_hash = EXCLUDED.data_hash,
        synced_at = NOW()
    `;
    if (existingHash) heroStats.updated++;
    else heroStats.new++;
  }
  console.log(`✓ Heroes: ${heroStats.new} new, ${heroStats.updated} updated, ${heroStats.skipped} skipped\n`);

  // Sync hero identities
  console.log('Syncing hero identities...');
  const identityStats: SyncStats = { new: 0, updated: 0, skipped: 0 };

  async function syncIdentity(
    card: MarvelCDBCard,
    primaryHeroId: string,
    identityType: string
  ): Promise<void> {
    const hashData = {
      heroId: primaryHeroId,
      identityType,
      name: card.name,
      attack: card.attack ?? null,
      defense: card.defense ?? null,
      handSize: card.hand_size ?? null,
      imageUrl: card.imagesrc ?? null,
      recover: card.recover ?? null,
      text: card.text ?? null,
      thwart: card.thwart ?? null,
      traits: card.traits ?? null,
    };
    const dataHash = computeHash(hashData);

    const existingHash = identityHashMap.get(card.code);
    if (!forceSync && existingHash === dataHash) {
      identityStats.skipped++;
      return;
    }

    await sql`
      INSERT INTO hero_identities (
        id, hero_id, identity_type, name, attack, defense, hand_size,
        image_url, recover, text, thwart, traits, data_hash
      ) VALUES (
        ${card.code},
        ${primaryHeroId},
        ${identityType},
        ${card.name},
        ${card.attack ?? null},
        ${card.defense ?? null},
        ${card.hand_size ?? null},
        ${card.imagesrc ? MARVELCDB_BASE + card.imagesrc : null},
        ${card.recover ?? null},
        ${card.text ?? null},
        ${card.thwart ?? null},
        ${card.traits ?? null},
        ${dataHash}
      )
      ON CONFLICT (id) DO UPDATE SET
        hero_id = EXCLUDED.hero_id,
        identity_type = EXCLUDED.identity_type,
        name = EXCLUDED.name,
        attack = EXCLUDED.attack,
        defense = EXCLUDED.defense,
        hand_size = EXCLUDED.hand_size,
        image_url = EXCLUDED.image_url,
        recover = EXCLUDED.recover,
        text = EXCLUDED.text,
        thwart = EXCLUDED.thwart,
        traits = EXCLUDED.traits,
        data_hash = EXCLUDED.data_hash
    `;
    if (existingHash) identityStats.updated++;
    else identityStats.new++;
  }

  for (const card of heroCards) {
    if (!validHeroSets.has(card.card_set_code)) continue;

    const heroesInSet = heroSetMap.get(card.card_set_code) ?? [];
    const primaryHeroId = heroesInSet[0]?.code;
    if (!primaryHeroId) continue;

    let identityType = 'hero';
    if (heroesInSet.length > 1) {
      const index = heroesInSet.findIndex((h) => h.code === card.code);
      identityType = `hero_${index + 1}`;
    }

    await syncIdentity(card, primaryHeroId, identityType);
  }

  for (const card of alterEgoCards) {
    const heroesInSet = heroSetMap.get(card.card_set_code) ?? [];
    const primaryHeroId = heroesInSet[0]?.code;

    if (!primaryHeroId) {
      console.log(`  ⚠ No hero found for alter_ego: ${card.name}`);
      continue;
    }

    await syncIdentity(card, primaryHeroId, 'alter_ego');
  }
  console.log(
    `✓ Identities: ${identityStats.new} new, ${identityStats.updated} updated, ${identityStats.skipped} skipped\n`
  );

  // Sync deck cards
  console.log('Syncing deck cards...');
  const deckStats: SyncStats = { new: 0, updated: 0, skipped: 0 };
  for (const card of deckCards) {
    const aspect = FACTION_TO_ASPECT[card.faction_code] ?? null;

    let heroId: string | null = null;
    if (card.faction_code === 'hero') {
      const setCode = card.card_set_parent_code ?? card.card_set_code;
      heroId = dbHeroSetCodeMap.get(setCode) ?? null;
    }

    // Resources have no cost concept (null); all other playable types default to 0 when the API omits the field
    const cost = card.type_code === 'resource' ? (card.cost ?? null) : (card.cost ?? 0);

    const setType = card.faction_code !== 'hero'
      ? null
      : card.card_set_type_name_code === 'hero_special'
        ? (card.card_set_name ?? 'hero_special')
        : card.card_set_type_name_code;

    const hashData = {
      name: card.name,
      aspect,
      attack: card.attack ?? null,
      attackCost: card.attack_cost ?? null,
      cost,
      deckLimit: card.deck_limit ?? 3,
      health: card.health ?? null,
      heroId,
      imageUrl: card.imagesrc ?? null,
      isPermanent: card.permanent ?? false,
      isUnique: card.is_unique ?? false,
      packCode: card.pack_code,
      packName: card.pack_name,
      quantity: card.quantity ?? 1,
      resourceEnergy: card.resource_energy ?? null,
      resourceMental: card.resource_mental ?? null,
      resourcePhysical: card.resource_physical ?? null,
      resourceWild: card.resource_wild ?? null,
      setType,
      text: card.text ?? null,
      thwart: card.thwart ?? null,
      thwartCost: card.thwart_cost ?? null,
      traits: card.traits ?? null,
      type: card.type_code,
    };
    const dataHash = computeHash(hashData);

    const existingHash = deckHashMap.get(card.code);
    if (!forceSync && existingHash === dataHash) {
      deckStats.skipped++;
      continue;
    }

    await sql`
      INSERT INTO deck_cards (
        id, name, aspect, attack, attack_consequential, cost, deck_limit,
        health, hero_id, image_url, is_permanent, is_unique, pack_code, pack_name, quantity,
        resource_energy, resource_mental, resource_physical, resource_wild,
        set_type, data_hash, synced_at, text, thwart, thwart_consequential, traits, type
      ) VALUES (
        ${card.code},
        ${card.name},
        ${aspect},
        ${card.attack ?? null},
        ${card.attack_cost ?? null},
        ${cost},
        ${card.deck_limit ?? 3},
        ${card.health ?? null},
        ${heroId},
        ${card.imagesrc ? MARVELCDB_BASE + card.imagesrc : null},
        ${card.permanent ?? false},
        ${card.is_unique ?? false},
        ${card.pack_code},
        ${card.pack_name},
        ${card.quantity ?? 1},
        ${card.resource_energy ?? null},
        ${card.resource_mental ?? null},
        ${card.resource_physical ?? null},
        ${card.resource_wild ?? null},
        ${setType},
        ${dataHash},
        NOW(),
        ${card.text ?? null},
        ${card.thwart ?? null},
        ${card.thwart_cost ?? null},
        ${card.traits ?? null},
        ${card.type_code}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        aspect = EXCLUDED.aspect,
        attack = EXCLUDED.attack,
        attack_consequential = EXCLUDED.attack_consequential,
        cost = EXCLUDED.cost,
        deck_limit = EXCLUDED.deck_limit,
        health = EXCLUDED.health,
        hero_id = EXCLUDED.hero_id,
        image_url = EXCLUDED.image_url,
        is_permanent = EXCLUDED.is_permanent,
        is_unique = EXCLUDED.is_unique,
        pack_code = EXCLUDED.pack_code,
        pack_name = EXCLUDED.pack_name,
        quantity = EXCLUDED.quantity,
        resource_energy = EXCLUDED.resource_energy,
        resource_mental = EXCLUDED.resource_mental,
        resource_physical = EXCLUDED.resource_physical,
        resource_wild = EXCLUDED.resource_wild,
        set_type = EXCLUDED.set_type,
        data_hash = EXCLUDED.data_hash,
        synced_at = NOW(),
        text = EXCLUDED.text,
        thwart = EXCLUDED.thwart,
        thwart_consequential = EXCLUDED.thwart_consequential,
        traits = EXCLUDED.traits,
        type = EXCLUDED.type
    `;
    if (existingHash) deckStats.updated++;
    else deckStats.new++;

    const processed = deckStats.new + deckStats.updated + deckStats.skipped;
    if (processed % 100 === 0) process.stdout.write(`\r  ${processed}/${deckCards.length}`);
  }
  console.log(
    `\r✓ Deck cards: ${deckStats.new} new, ${deckStats.updated} updated, ${deckStats.skipped} skipped\n`
  );

  // Remove modular/scenario cards that may have been previously synced
  console.log('Cleaning up non-deckbuilding cards...');
  const modularCards = allCards.filter(
    (c) =>
      DECK_CARD_TYPES.includes(c.type_code) && EXCLUDED_SET_TYPES.includes(c.card_set_type_name_code)
  );
  const modularIds = modularCards.map((c) => c.code);
  if (modularIds.length > 0) {
    const deleted = await sql`DELETE FROM deck_cards WHERE id = ANY(${modularIds}) RETURNING id`;
    if (deleted.length > 0) console.log(`🗑️  Removed ${deleted.length} modular/encounter cards\n`);
    else console.log(`✓ No modular cards to remove\n`);
  }

  // Sync encounter cards (obligation, nemesis, villain, modular, scenario)
  console.log('Syncing encounter cards...');
  const encounterStats: SyncStats = { new: 0, updated: 0, skipped: 0 };
  for (const card of allEncounterCards) {
    let heroId: string | null = null;
    if (HERO_SET_TYPES.has(card.card_set_type_name_code)) {
      heroId = dbHeroSetCodeMap.get(card.card_set_code) ?? null;
    }

    const hashData = {
      name: card.name,
      type: card.type_code,
      setCode: card.card_set_code,
      setType: card.card_set_type_name_code,
      text: card.text ?? null,
      traits: card.traits ?? null,
      heroId,
      attack: card.attack ?? null,
      health: card.health ?? null,
      scheme: card.scheme ?? null,
      baseThreat: card.base_threat ?? null,
      baseThreatFixed: card.base_threat_fixed ?? false,
      baseThreatPerGroup: card.base_threat_per_group ?? false,
      isHealthPerHero: card.health_per_hero ?? false,
      schemeAcceleration: card.scheme_acceleration ?? null,
      boost: card.boost ?? null,
      packCode: card.pack_code,
      quantity: card.quantity ?? 1,
    };
    const dataHash = computeHash(hashData);

    const existingHash = encounterHashMap.get(card.code);
    if (!forceSync && existingHash === dataHash) {
      encounterStats.skipped++;
      continue;
    }

    await sql`
      INSERT INTO encounter_cards (
        id, hero_id, set_code, set_name, set_type, name, type, text, traits,
        attack, health, scheme, base_threat, base_threat_fixed, base_threat_per_group,
        is_health_per_hero, scheme_acceleration, boost,
        image_url, pack_code, pack_name, quantity, data_hash, synced_at
      ) VALUES (
        ${card.code},
        ${heroId},
        ${card.card_set_code},
        ${card.card_set_name ?? null},
        ${card.card_set_type_name_code},
        ${card.name},
        ${card.type_code},
        ${card.text ?? null},
        ${card.traits ?? null},
        ${card.attack ?? null},
        ${card.health ?? null},
        ${card.scheme ?? null},
        ${card.base_threat ?? null},
        ${card.base_threat_fixed ?? false},
        ${card.base_threat_per_group ?? false},
        ${card.health_per_hero ?? false},
        ${card.scheme_acceleration ?? null},
        ${card.boost ?? null},
        ${card.imagesrc ? MARVELCDB_BASE + card.imagesrc : null},
        ${card.pack_code},
        ${card.pack_name},
        ${card.quantity ?? 1},
        ${dataHash},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        hero_id = EXCLUDED.hero_id,
        set_code = EXCLUDED.set_code,
        set_name = EXCLUDED.set_name,
        set_type = EXCLUDED.set_type,
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        text = EXCLUDED.text,
        traits = EXCLUDED.traits,
        attack = EXCLUDED.attack,
        health = EXCLUDED.health,
        scheme = EXCLUDED.scheme,
        base_threat = EXCLUDED.base_threat,
        base_threat_fixed = EXCLUDED.base_threat_fixed,
        base_threat_per_group = EXCLUDED.base_threat_per_group,
        is_health_per_hero = EXCLUDED.is_health_per_hero,
        scheme_acceleration = EXCLUDED.scheme_acceleration,
        boost = EXCLUDED.boost,
        image_url = EXCLUDED.image_url,
        pack_code = EXCLUDED.pack_code,
        pack_name = EXCLUDED.pack_name,
        quantity = EXCLUDED.quantity,
        data_hash = EXCLUDED.data_hash,
        synced_at = NOW()
    `;
    if (existingHash) encounterStats.updated++;
    else encounterStats.new++;

    const processed = encounterStats.new + encounterStats.updated + encounterStats.skipped;
    if (processed % 100 === 0) process.stdout.write(`\r  ${processed}/${allEncounterCards.length}`);
  }
  console.log(
    `\r✓ Encounter cards: ${encounterStats.new} new, ${encounterStats.updated} updated, ${encounterStats.skipped} skipped\n`
  );

  console.log('Updating synced packs table...');
  for (const pack of packsToSync) {
    const packHash = packHashMap.get(pack.code)!;
    await sql`
      INSERT INTO synced_packs (code, name, position, available, known, total, data_hash, synced_at)
      VALUES (${pack.code}, ${pack.name}, ${pack.position}, ${pack.available}, ${pack.known}, ${pack.total}, ${packHash}, NOW())
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        position = EXCLUDED.position,
        available = EXCLUDED.available,
        known = EXCLUDED.known,
        total = EXCLUDED.total,
        data_hash = EXCLUDED.data_hash,
        synced_at = NOW()
    `;
  }
  console.log(`✓ Updated ${packsToSync.length} pack(s) in synced_packs table\n`);

  await sql.end();
  console.log('\n✅ Sync complete!');
}

syncCards().catch((err: Error) => {
  console.error('❌ Sync failed:', err.message);
  process.exit(1);
});
