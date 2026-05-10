export const COST_BUCKETS = [0, 1, 2, 3, 4] as const;
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

export function formatTraits(traits: string | null | undefined): string[] {
  if (!traits) return [];
  return traits.split('. ').map(t => t.replace(/\.$/, '').trim()).filter(Boolean);
}

export function formatType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
