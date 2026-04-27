import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import type { APIRoute } from 'astro';
import { searchDocuments } from '../../../lib/embeddings';

interface CardInfo {
  id: string;
  name: string;
  type: string;
  aspect: string | null;
  cost: number | null;
  traits: string | null;
  text: string | null;
  isUnique: boolean;
  attack?: number | null;
  thwart?: number | null;
  health?: number | null;
  resourceEnergy?: number | null;
  resourceMental?: number | null;
  resourcePhysical?: number | null;
  resourceWild?: number | null;
}

interface DeckCard {
  cardId: string;
  name: string;
  quantity: number;
  type?: string;
  cost?: number | null;
  aspect?: string | null;
}

function formatCardForPrompt(c: CardInfo): string {
  const parts: string[] = [`${c.name}`];
  parts.push(`(${c.aspect ?? 'Basic'}, ${c.type}, cost ${c.cost ?? '?'})`);
  
  // Add stats for allies
  if (c.type === 'ally') {
    const stats: string[] = [];
    if (c.attack) stats.push(`ATK ${c.attack}`);
    if (c.thwart) stats.push(`THW ${c.thwart}`);
    if (c.health) stats.push(`HP ${c.health}`);
    if (stats.length > 0) parts.push(`[${stats.join(', ')}]`);
  }
  
  // Add resource values for resources
  if (c.type === 'resource') {
    const res: string[] = [];
    if (c.resourceEnergy) res.push(`⚡${c.resourceEnergy}`);
    if (c.resourceMental) res.push(`🧠${c.resourceMental}`);
    if (c.resourcePhysical) res.push(`💪${c.resourcePhysical}`);
    if (c.resourceWild) res.push(`★${c.resourceWild}`);
    if (res.length > 0) parts.push(`[${res.join(' ')}]`);
  }
  
  if (c.isUnique) parts.push('(Unique)');
  if (c.traits) parts.push(`— ${c.traits}`);
  
  return parts.join(' ');
}

export const POST: APIRoute = async ({ request }) => {
  let body: {
    heroName?: string;
    aspects?: string[];
    currentDeck?: DeckCard[];
    cardPool?: CardInfo[];
    heroCards?: DeckCard[];
    isMultiAspect?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { heroName, aspects = [], currentDeck = [], cardPool = [], heroCards = [], isMultiAspect = false } = body;

  if (!heroName) return new Response('Missing heroName', { status: 400 });

  const heroCardTotal = heroCards.reduce((sum, c) => sum + c.quantity, 0);
  const deckTotal = currentDeck.reduce((sum, c) => sum + c.quantity, 0) + heroCardTotal;
  const aspectList = `Basic${aspects.length ? `, ${aspects.join(', ')}` : ''}`;

  // Group deck cards by type for better readability
  const deckByType: Record<string, DeckCard[]> = {};
  for (const c of currentDeck) {
    const type = c.type ?? 'unknown';
    if (!deckByType[type]) deckByType[type] = [];
    deckByType[type].push(c);
  }

  const deckListFormatted = Object.entries(deckByType)
    .map(([type, cards]) => `${type.toUpperCase()}:\n${cards.map(c => `  - ${c.name} x${c.quantity} (cost ${c.cost ?? '?'})`).join('\n')}`)
    .join('\n');

  // Multi-aspect balance rules for Spider-Woman (2 aspects) and Adam Warlock (4 aspects)
  const multiAspectRule = isMultiAspect && aspects.length > 1
    ? `\n- MULTI-ASPECT BALANCE: This hero requires equal cards from each chosen aspect. With ${aspects.length} aspects (${aspects.join(', ')}), the deck must have the same number of cards from each aspect. Basic cards don't count toward this balance.`
    : '';

  // RAG: Search for relevant rules/strategy content
  let rulesContext = '';
  try {
    const searchQuery = `${heroName} deck building ${aspects.join(' ')} strategy synergies`;
    const relevantDocs = await searchDocuments(searchQuery, 3, 0.5);
    if (relevantDocs.length > 0) {
      rulesContext = `\n\nRELEVANT RULES & STRATEGY (from game documentation):\n${relevantDocs.map(d => d.content).join('\n\n')}`;
    }
  } catch (err) {
    // RAG is optional - continue without it if it fails
    console.warn('RAG search failed:', err);
  }

  const system = `You are a Marvel Champions deck building assistant. You understand card synergies, economy, and hero playstyles.${rulesContext}

DECK RULES:
- Deck must be exactly 40–50 cards total (including hero-specific cards)
- Hero-specific cards (15 cards) are mandatory and count toward the total
- Aspects available: ${aspectList}. Non-hero cards must be Basic or match one of the player's aspects.
- Unique cards (marked with ★): max 1 copy per deck
- Non-unique cards: up to their deck limit (usually 3)${multiAspectRule}

ANALYSIS APPROACH:
1. Consider the hero's identity and playstyle
2. Look for synergies with hero-specific cards
3. Evaluate resource curve and cost distribution
4. Check for trait synergies (Avenger, Guardian, etc.)
5. Balance between damage, thwart, and utility${isMultiAspect ? '\n6. Ensure aspect card counts are balanced' : ''}

RESPONSE FORMAT:
Give 3-5 specific, actionable suggestions. For each:
- Name exact cards to add/remove with quantities
- Explain the synergy or strategic reason briefly
End with 1-2 sentences of overall strategic direction.

Be concise and specific. Use bullet points.`;

  const heroCardsSection = heroCards.length > 0
    ? `\nHero-specific cards (${heroCardTotal} cards, mandatory):\n${heroCards.map(c => `- ${c.name} x${c.quantity}`).join('\n')}`
    : '';

  // Calculate aspect breakdown for multi-aspect heroes
  let aspectBreakdown = '';
  if (isMultiAspect && aspects.length > 1) {
    const aspectCounts: Record<string, number> = {};
    for (const aspect of aspects) aspectCounts[aspect] = 0;
    aspectCounts['Basic'] = 0;
    
    for (const c of currentDeck) {
      const cardAspect = c.aspect ?? 'Basic';
      if (cardAspect in aspectCounts) {
        aspectCounts[cardAspect] += c.quantity;
      }
    }
    
    aspectBreakdown = `\nAspect breakdown: ${Object.entries(aspectCounts).map(([a, n]) => `${a}: ${n}`).join(', ')}`;
    
    // Check if balanced
    const aspectOnlyCounts = aspects.map(a => aspectCounts[a]);
    const isBalanced = aspectOnlyCounts.every(c => c === aspectOnlyCounts[0]);
    if (!isBalanced) {
      aspectBreakdown += ` ⚠️ UNBALANCED - must be equal!`;
    }
  }

  const userMessage = `Hero: ${heroName}
Aspects: ${aspectList}${aspectBreakdown}
${heroCardsSection}

Current deck (${deckTotal}/40 cards):
${deckTotal > 0 ? deckListFormatted : '(empty)'}

Available card pool (${cardPool.length} cards):
${cardPool
  .slice(0, 100)
  .map(c => `- ${formatCardForPrompt(c)}`)
  .join('\n')}
${cardPool.length > 100 ? `\n... and ${cardPool.length - 100} more cards` : ''}`;

  const result = streamText({
    model: google('gemini-1.5-flash'),
    system,
    messages: [{ role: 'user', content: userMessage }],
    maxOutputTokens: 1024,
  });

  return result.toTextStreamResponse();
};
