import 'dotenv/config';
import { writeFileSync } from 'fs';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const sql = postgres(databaseUrl, { prepare: false, max: 1 });

try {
  // Fetch all deck cards with fields needed for dedup key
  const deckCards = await sql`
    SELECT
      dc.id,
      dc.name,
      dc.text,
      dc.hero_id,
      dc.type,
      dc.aspect,
      dc.pack_name,
      dc.pack_code,
      dc.set_position,
      dc.image_url,
      dc.resource_energy,
      dc.resource_mental,
      dc.resource_physical,
      dc.resource_wild,
      hc.name as hero_name
    FROM deck_cards dc
    LEFT JOIN hero_cards hc ON dc.hero_id = hc.id
    ORDER BY hc.name NULLS LAST, dc.set_position NULLS LAST, dc.name
  `;

  // Group by same dedup key as browse.astro / builder-data.ts
  const groups = new Map();
  for (const card of deckCards) {
    const key = [
      card.name,
      card.text ?? '',
      card.hero_id ?? '',
      card.resource_energy ?? 0,
      card.resource_mental ?? 0,
      card.resource_physical ?? 0,
      card.resource_wild ?? 0,
    ].join('|||');
    const group = groups.get(key) ?? [];
    group.push(card);
    groups.set(key, group);
  }

  // Keep groups where NO card in the group has an image
  const missing = [];
  for (const group of groups.values()) {
    const hasImage = group.some(c => c.image_url);
    if (!hasImage) {
      // Emit all rows in the group so every DB record is visible
      missing.push(...group);
    }
  }

  // Hero identities missing images (no dedup — each identity is unique)
  const identities = await sql`
    SELECT hi.id, hc.name as hero_name, hi.identity_type, hi.name, hi.image_url
    FROM hero_identities hi
    JOIN hero_cards hc ON hi.hero_id = hc.id
    WHERE hi.image_url IS NULL
    ORDER BY hc.name, hi.identity_type
  `;

  const lines = [
    `# Deck cards with no image in any printing (${missing.length} rows)`,
    '# Format: table | id | hero | subtype | name | pack | set_position',
    '',
    ...missing.map(c => `deck_card | ${c.id} | ${c.hero_name ?? 'Basic'} | ${c.type} | ${c.name} | ${c.pack_name ?? ''} | ${c.set_position ?? ''}`),
    '',
    `# Hero identities missing images (${identities.length})`,
    '# Format: table | id | hero | subtype | name',
    '',
    ...identities.map(i => `hero_identity | ${i.id} | ${i.hero_name} | ${i.identity_type} | ${i.name}`),
  ];

  const outPath = './scripts/missing-images.txt';
  writeFileSync(outPath, lines.join('\n'));
  console.log(`Wrote ${missing.length} deck card rows and ${identities.length} identities to ${outPath}`);
} finally {
  await sql.end();
}
