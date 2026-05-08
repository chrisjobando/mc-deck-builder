import 'dotenv/config';
import postgres from 'postgres';
import { writeFileSync } from 'fs';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const sql = postgres(databaseUrl, { prepare: false, max: 1 });

try {
  const [identities, deckCards, encounterCards] = await Promise.all([
    sql`
      SELECT hi.id, 'hero_identity' as table_name, hc.name as hero_name, hi.identity_type as subtype, hi.name, hi.image_url
      FROM hero_identities hi
      JOIN hero_cards hc ON hi.hero_id = hc.id
      WHERE hi.image_url ILIKE '%hallofheroeslcg%'
      ORDER BY hc.name, hi.identity_type
    `,
    sql`
      SELECT dc.id, 'deck_card' as table_name, COALESCE(hc.name, 'Basic') as hero_name, dc.type as subtype, dc.name, dc.image_url
      FROM deck_cards dc
      LEFT JOIN hero_cards hc ON dc.hero_id = hc.id
      WHERE dc.image_url ILIKE '%hallofheroeslcg%'
      ORDER BY hc.name NULLS LAST, dc.name
    `,
    sql`
      SELECT ec.id, 'encounter_card' as table_name, COALESCE(hc.name, '') as hero_name, ec.type as subtype, ec.name, ec.image_url
      FROM encounter_cards ec
      LEFT JOIN hero_cards hc ON ec.hero_id = hc.id
      WHERE ec.image_url ILIKE '%hallofheroeslcg%'
      ORDER BY ec.name
    `,
  ]);

  const all = [...identities, ...deckCards, ...encounterCards];

  const lines = [
    '# Cards with Hall of Heroes image URLs',
    '# Format: table | id | hero | subtype | name | image_url',
    '',
    ...all.map(r => `${r.table_name} | ${r.id} | ${r.hero_name} | ${r.subtype} | ${r.name} | ${r.image_url}`)
  ];

  writeFileSync('./scripts/hallofheroes-image-urls.txt', lines.join('\n'));
  console.log(`Found ${all.length} cards (${identities.length} identities, ${deckCards.length} deck cards, ${encounterCards.length} encounter cards)`);
} finally {
  await sql.end();
}
