const G = (char: string) => `<span class="marvel-glyph">${char}</span>`;

export function formatCardText(text: string): string {
  return text
    .replace(/\[\[([^\]]+)\]\]/g, '<strong class="uppercase">$1</strong>')
    .replace(/\[energy\]/g, G('e'))
    .replace(/\[mental\]/g, G('m'))
    .replace(/\[physical\]/g, G('p'))
    .replace(/\[wild\]/g, G('w'))
    .replace(/\[star\]/g, G('S'))
    .replace(/\[unique\]/g, G('U'))
    .replace(/\[acceleration\]/g, G('A'))
    .replace(/\[crisis\]/g, G('C'))
    .replace(/\[hazard\]/g, G('H'))
    .replace(/\[per_hero\]/g, G('P'))
    .replace(/→/g, G('E'))
    .replace(/\n/g, '<br>');
}

export function formatType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export const TYPE_COLOR: Record<string, string> = {
  ally: 'bg-blue-500',
  event: 'bg-purple-500',
  support: 'bg-yellow-500',
  upgrade: 'bg-emerald-500',
  resource: 'bg-gray-500',
  player_side_scheme: 'bg-orange-500',
};

export const COST_BUCKETS = [0, 1, 2, 3, 4] as const;

export const ASPECT_BG: Record<string, string> = {
  Aggression: 'bg-red-700',
  Justice: 'bg-yellow-600',
  Leadership: 'bg-blue-700',
  Protection: 'bg-green-700',
  Pool: 'bg-pink-700',
  Basic: 'bg-gray-700',
};

export const ASPECT_DOT: Record<string, string> = {
  Aggression: 'bg-red-500',
  Justice: 'bg-yellow-500',
  Leadership: 'bg-blue-500',
  Protection: 'bg-green-500',
  Pool: 'bg-pink-500',
  Basic: 'bg-gray-400',
};

export const ASPECT_RING: Record<string, string> = {
  Aggression: 'ring-red-400',
  Justice: 'ring-yellow-400',
  Leadership: 'ring-blue-400',
  Protection: 'ring-green-400',
  Pool: 'ring-pink-400',
};

export const ASPECT_TEXT_COLOR: Record<string, string> = {
  Aggression: 'text-red-400',
  Justice: 'text-yellow-400',
  Leadership: 'text-blue-400',
  Protection: 'text-green-400',
  Pool: 'text-pink-400',
  Basic: 'text-[var(--color-text-muted)]',
};

export function formatTraits(traits: string | null | undefined): string[] {
  if (!traits) return [];
  return traits.split('. ').map(t => t.replace(/\.$/, '').trim()).filter(Boolean);
}
