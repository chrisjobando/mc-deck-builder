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

interface HeroIdentity {
  identityType: string;
  name: string;
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
  // Include card text for context on effects
  if (c.text && c.text.length < 100) parts.push(`| ${c.text}`);

  return parts.join(' ');
}

export const POST: APIRoute = async ({ request }) => {
  let body: {
    heroName?: string;
    heroIdentities?: HeroIdentity[];
    heroHealth?: number;
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

  const { heroName, heroIdentities = [], heroHealth, aspects = [], currentDeck = [], cardPool = [], heroCards = [], isMultiAspect = false } = body;

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

  // Multi-aspect balance rules for Spider-Woman (2 aspects) and Adam Warlock (4 aspects)
  const multiAspectRule = isMultiAspect && aspects.length > 1
    ? `\n- MULTI-ASPECT BALANCE: This hero requires equal cards from each chosen aspect. With ${aspects.length} aspects (${aspects.join(', ')}), the deck must have the same number of cards from each aspect. Basic cards don't count toward this balance.`
    : '';

  // RAG: Search for relevant rules/strategy content
  let rulesContext = '';
  try {
    // Search for hero-specific info and general deck building rules
    const searchQueries = [
      `${heroName} hero abilities playstyle`,
      `${aspects.join(' ')} aspect cards strategy`,
      `deck building resource curve economy`,
    ];
    const allDocs: string[] = [];
    for (const query of searchQueries) {
      const docs = await searchDocuments(query, 2, 0.5);
      allDocs.push(...docs.map(d => d.content));
    }
    if (allDocs.length > 0) {
      // Dedupe and limit
      const uniqueDocs = [...new Set(allDocs)].slice(0, 4);
      rulesContext = `\n\nRELEVANT RULES & STRATEGY (from official documentation):\n${uniqueDocs.join('\n\n')}`;
    }
  } catch (err) {
    console.warn('RAG search failed:', err);
  }

  // Determine deck state for tailored advice
  const deckState = deckTotal < 40 ? 'incomplete' : deckTotal > 50 ? 'oversized' : 'complete';
  const cardsNeeded = Math.max(0, 40 - deckTotal);
  const cardsToRemove = Math.max(0, deckTotal - 50);

  const system = `You are an expert Marvel Champions deck building coach. You give specific, actionable advice to improve decks.${rulesContext}

CRITICAL RULE - CARD ACCURACY:
- ONLY reference cards that appear in the CURRENT DECK or AVAILABLE TO ADD sections below
- Use the EXACT card name as written in the data
- Use the EXACT card type as provided (ally, event, support, upgrade, resource, player_side_scheme)
- NEVER invent, hallucinate, or guess card names, types, or effects
- If you're unsure about a card, don't mention it
- When describing a card's effect, quote from the provided text or say "see card text"

DECK RULES:
- Total deck size: 40–50 cards (hero-specific cards count toward this)
- Hero-specific cards (typically 15): mandatory, auto-included
- Allowed aspects: ${aspectList}
- Unique cards: max 1 copy
- Non-unique: up to deck limit (usually 3)${multiAspectRule}

YOUR TASK:
${deckState === 'incomplete' ? `This deck needs ${cardsNeeded} more cards. Recommend specific cards to ADD from the available pool.` : ''}
${deckState === 'oversized' ? `This deck is ${cardsToRemove} cards over the limit. Identify the weakest cards to CUT.` : ''}
${deckState === 'complete' ? `This deck is complete. Look for SWAPS to improve it (remove weak cards, add stronger options).` : ''}

ANALYSIS TO PERFORM:
1. **Card Combos**: Identify 2-3 powerful synergies in the deck or that could be added
   - Example: "Rapid Response + Nick Fury = replay Nick every turn for 3 cards"
   - Example: "Sidearm + Warrior Skill = extra attack with +2 damage"
2. **Weak Cards**: Name specific cards in the deck that underperform or don't synergize
3. **Missing Staples**: Key cards from the pool that would strengthen this build
4. **Resource Curve**: Is the cost distribution healthy? Too many expensive cards?

RESPONSE FORMAT:
Use these sections:

**🔄 Suggested Changes**
${deckState === 'incomplete' ? '• ADD: [Card Name] x[qty] — [why it fits]' : ''}
${deckState === 'oversized' ? '• CUT: [Card Name] — [why it\'s weak here]' : ''}
${deckState === 'complete' ? '• SWAP: Remove [Card] → Add [Card] — [improvement reason]' : ''}
(List 3-5 changes)

**⚡ Key Combos**
• [Card A] + [Card B] = [what happens]
(List 2-3 combos, either existing in deck or recommended to add)

**📊 Deck Assessment**
One paragraph: overall strengths, main weakness, and strategic direction.

REMEMBER: Only reference cards from the lists provided. Use exact names and types as given.`;

  // Format hero identities (hero form, alter-ego)
  const heroIdentitySection = heroIdentities.length > 0
    ? `Hero Identities:\n${heroIdentities.map(i => `  - ${i.name} (${i.identityType})`).join('\n')}${heroHealth ? `\nBase Health: ${heroHealth}` : ''}`
    : '';

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

  // Build set of cards currently in deck for filtering
  const deckCardIds = new Set(currentDeck.map(c => c.cardId));

  // Cards NOT in deck (available to add)
  const availableCards = cardPool.filter(c => !deckCardIds.has(c.id));

  // Format deck cards with their effects for better analysis
  const deckCardsFormatted = Object.entries(deckByType)
    .map(([type, cards]) => {
      const cardLines = cards.map(c => {
        const poolCard = cardPool.find(pc => pc.id === c.cardId);
        const text = poolCard?.text ? ` | ${poolCard.text.slice(0, 80)}${poolCard.text.length > 80 ? '...' : ''}` : '';
        return `  - ${c.name} x${c.quantity} (${c.aspect ?? 'Basic'}, ${type}, cost ${c.cost ?? '?'})${text}`;
      });
      return `${type.toUpperCase()}:\n${cardLines.join('\n')}`;
    })
    .join('\n');

  const userMessage = `Hero: ${heroName}
${heroIdentitySection}
Aspects: ${aspectList}${aspectBreakdown}
${heroCardsSection}

═══ CURRENT DECK (${deckTotal}/${deckState === 'incomplete' ? '40 minimum' : '50 maximum'} cards) ═══
${deckTotal > 0 ? deckCardsFormatted : '(empty - need to add cards!)'}

═══ AVAILABLE TO ADD (${availableCards.length} cards not in deck) ═══
${availableCards
  .slice(0, 80)
  .map(c => `- ${formatCardForPrompt(c)}`)
  .join('\n')}
${availableCards.length > 80 ? `\n... and ${availableCards.length - 80} more cards` : ''}

Analyze this deck and provide specific improvements.`;

  const result = streamText({
    model: google('gemini-2.5-flash'),
    system,
    messages: [{ role: 'user', content: userMessage }],
  });

  return result.toTextStreamResponse();
};
