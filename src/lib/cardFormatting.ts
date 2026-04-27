export function formatCardText(text: string): string {
  return text
    .replace(/\[\[([^\]]+)\]\]/g, '<strong class="uppercase">$1</strong>')
    .replace(/\[star\]/g, '★')
    .replace(/\[wild\]/g, '🍃')
    .replace(/\[energy\]/g, '⚡')
    .replace(/\[mental\]/g, '🧪')
    .replace(/\[physical\]/g, '👊')
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

export const COST_BUCKETS = [0, 1, 2, 3, 4, 5, 6] as const;
