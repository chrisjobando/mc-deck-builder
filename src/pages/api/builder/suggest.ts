import { anthropic } from '@ai-sdk/anthropic';
import type { APIRoute } from 'astro';
import { streamText } from 'ai';

export const POST: APIRoute = async ({ request }) => {
  let body: {
    heroName?: string;
    aspects?: string[];
    currentDeck?: { cardId: string; name: string; quantity: number }[];
    cardPool?: { id: string; name: string; type: string; aspect: string | null; cost: number | null; traits: string | null; text: string | null }[];
  };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { heroName, aspects = [], currentDeck = [], cardPool = [] } = body;

  if (!heroName) return new Response('Missing heroName', { status: 400 });

  const deckTotal = currentDeck.reduce((sum, c) => sum + c.quantity, 0);
  const aspectList = `Basic${aspects.length ? `, ${aspects.join(', ')}` : ''}`;

  const system = `You are a Marvel Champions deck building assistant. \
The deck must be exactly 40 cards (hero-specific cards are free and don't count). \
Aspects available: ${aspectList}. Cards must be Basic or match one of the player's aspects. \
Unique cards: max 1 copy. Non-unique cards: up to their deck limit (usually 3). \
Analyze the current deck and available card pool. Give 3-5 specific suggestions: \
which cards to add (and how many), which cards to cut (and why), and 1-2 sentences of strategic direction. \
Be concise and specific. Format as a numbered list.`;

  const userMessage = `Hero: ${heroName}
Aspects: ${aspectList}

Current deck (${deckTotal}/40 cards):
${currentDeck.length ? currentDeck.map(c => `- ${c.name} x${c.quantity}`).join('\n') : '(empty)'}

Available card pool (${cardPool.length} cards):
${cardPool
  .slice(0, 120)
  .map(c => `- ${c.name} (${c.aspect ?? 'Basic'}, ${c.type}, cost ${c.cost ?? '?'}${c.traits ? `, ${c.traits}` : ''})`)
  .join('\n')}`;

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system,
    messages: [{ role: 'user', content: userMessage }],
    maxOutputTokens: 1024,
  });

  return result.toTextStreamResponse();
};
