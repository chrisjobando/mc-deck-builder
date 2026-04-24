import crypto from 'node:crypto';
import 'dotenv/config';
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

const HERO_TYPE = 'hero';
const ALTER_EGO_TYPE = 'alter_ego';
const DECK_CARD_TYPES = ['ally', 'event', 'support', 'upgrade', 'resource', 'player_side_scheme'];

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

  const allCards = await fetchJson<MarvelCDBCard[]>(`${MARVELCDB_BASE}/api/public/cards/`);
  console.log(`📦 Fetched ${allCards.length} total cards\n`);

  console.log('Loading existing card hashes...');
  const existingHeroCards = await sql<HashRow[]>`SELECT id, data_hash FROM hero_cards`;
  const existingIdentities = await sql<HashRow[]>`SELECT id, data_hash FROM hero_identities`;
  const existingDeckCards = await sql<HashRow[]>`SELECT id, data_hash FROM deck_cards`;

  const heroHashMap = new Map(existingHeroCards.map((c) => [c.id, c.data_hash]));
  const identityHashMap = new Map(existingIdentities.map((c) => [c.id, c.data_hash]));
  const deckHashMap = new Map(existingDeckCards.map((c) => [c.id, c.data_hash]));
  console.log(
    `  Found ${heroHashMap.size} heroes, ${identityHashMap.size} identities, ${deckHashMap.size} deck cards\n`
  );

  const heroCards = allCards.filter((c) => c.type_code === HERO_TYPE);
  const alterEgoCards = allCards.filter((c) => c.type_code === ALTER_EGO_TYPE);
  const EXCLUDED_SET_TYPES = ['modular', 'villain', 'scenario', 'campaign'];

  const deckCards = allCards.filter(
    (c) =>
      DECK_CARD_TYPES.includes(c.type_code) &&
      (c.faction_code in FACTION_TO_ASPECT || c.faction_code === 'hero') &&
      !EXCLUDED_SET_TYPES.includes(c.card_set_type_name_code)
  );

  console.log(`🦸 Found ${heroCards.length} hero cards`);
  console.log(`🎭 Found ${alterEgoCards.length} alter ego cards`);
  console.log(`🃏 Found ${deckCards.length} deck-building cards\n`);

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

    const hashData = {
      name: card.name,
      health: card.health ?? 10,
      isMultiAspect: card.meta?.multi_aspect ?? false,
      packCode: card.pack_code,
      packName: card.pack_name,
    };
    const dataHash = computeHash(hashData);

    const existingHash = heroHashMap.get(card.code);
    if (!forceSync && existingHash === dataHash) {
      heroStats.skipped++;
      continue;
    }

    await sql`
      INSERT INTO hero_cards (
        id, name, health, is_multi_aspect, pack_code, pack_name, data_hash, synced_at
      ) VALUES (
        ${card.code},
        ${card.name},
        ${card.health ?? 10},
        ${card.meta?.multi_aspect ?? false},
        ${card.pack_code},
        ${card.pack_name},
        ${dataHash},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        health = EXCLUDED.health,
        is_multi_aspect = EXCLUDED.is_multi_aspect,
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
      const hero = heroCards.find((h) => h.card_set_code === card.card_set_code);
      heroId = hero?.code ?? null;
    }

    const hashData = {
      name: card.name,
      aspect,
      attack: card.attack ?? null,
      attackCost: card.attack_cost ?? null,
      cost: card.cost ?? null,
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
        data_hash, synced_at, text, thwart, thwart_consequential, traits, type
      ) VALUES (
        ${card.code},
        ${card.name},
        ${aspect},
        ${card.attack ?? null},
        ${card.attack_cost ?? null},
        ${card.cost ?? null},
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

  const packs = await fetchJson<unknown[]>(`${MARVELCDB_BASE}/api/public/packs/`);
  console.log(`📚 Available packs: ${packs.length}`);

  await sql.end();
  console.log('\n✅ Sync complete!');
}

syncCards().catch((err: Error) => {
  console.error('❌ Sync failed:', err.message);
  process.exit(1);
});
