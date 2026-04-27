import { useEffect } from 'react';
import { formatCardText, formatType } from '../lib/cardFormatting';

export interface ModalCard {
  id: string;
  name: string;
  type: string;
  aspect: string | null;
  cost: number | null;
  attack: number | null;
  attackConsequential: number | null;
  thwart: number | null;
  thwartConsequential: number | null;
  health: number | null;
  traits: string | null;
  text: string | null;
  imageUrl: string | null;
  isPermanent: boolean;
  isUnique: boolean;
  deckLimit: number;
  packName: string | null;
  packs?: string[];
  heroId: string | null;
  resourceEnergy: number | null;
  resourceMental: number | null;
  resourcePhysical: number | null;
  resourceWild: number | null;
}

interface Props {
  card: ModalCard | null;
  onClose: () => void;
}

const ASPECT_BG: Record<string, string> = {
  Aggression: 'bg-red-700',
  Justice: 'bg-yellow-600',
  Leadership: 'bg-blue-700',
  Protection: 'bg-green-700',
  Pool: 'bg-pink-700',
  Basic: 'bg-gray-700',
};


function formatTraits(traits: string | null | undefined): string[] {
  if (!traits) return [];
  return traits.split('. ').map(t => t.replace(/\.$/, '').trim()).filter(Boolean);
}

export default function CardModal({ card, onClose }: Props) {
  useEffect(() => {
    if (!card) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, onClose]);

  if (!card) return null;

  const isPSS = card.type === 'player_side_scheme';
  const traits = formatTraits(card.traits);

  const resources = [
    card.resourceEnergy && { glyph: 'e', label: 'Energy', count: card.resourceEnergy, cls: 'bg-yellow-900/50 text-yellow-400' },
    card.resourceMental && { glyph: 'm', label: 'Mental', count: card.resourceMental, cls: 'bg-blue-900/50 text-blue-400' },
    card.resourcePhysical && { glyph: 'p', label: 'Physical', count: card.resourcePhysical, cls: 'bg-red-900/50 text-red-400' },
    card.resourceWild && { glyph: 'w', label: 'Wild', count: card.resourceWild, cls: 'bg-green-900/50 text-green-400' },
  ].filter(Boolean) as { glyph: string; label: string; count: number; cls: string }[];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-[var(--color-surface)] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 text-2xl leading-none hover:text-[var(--color-primary)]"
        >
          ×
        </button>

        <div className={`flex flex-col gap-6 p-6 md:flex-row ${isPSS ? 'md:items-center' : ''}`}>
          {/* Card image */}
          <div className={`flex-shrink-0 ${isPSS ? 'md:w-1/2' : 'md:w-1/3'}`}>
            <div
              className={`relative overflow-hidden rounded-lg bg-black/50 shadow-lg ${isPSS ? 'aspect-[88/63]' : 'aspect-[63/88]'}`}
            >
              {card.imageUrl ? (
                <img
                  src={card.imageUrl}
                  alt={card.name}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-[var(--color-text-muted)]">
                  No Image
                </div>
              )}
            </div>
          </div>

          {/* Card details */}
          <div className={isPSS ? 'md:w-1/2' : 'md:w-2/3'}>
            {/* Name + HP */}
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold">{card.name}</h2>
              {card.health !== null && (
                <span className="rounded-lg bg-red-600 px-3 py-1 font-bold text-white">
                  {card.health} HP
                </span>
              )}
            </div>

            {/* Badges */}
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/20 px-3 py-1 text-sm">{formatType(card.type)}</span>
              {card.aspect && (
                <span className={`rounded-full px-3 py-1 text-sm text-white ${ASPECT_BG[card.aspect] ?? 'bg-gray-700'}`}>
                  {card.aspect}
                </span>
              )}
              {card.isUnique && (
                <span className="rounded-full bg-yellow-600/50 px-3 py-1 text-sm"><span className="marvel-glyph">S</span> Unique</span>
              )}
              {card.isPermanent && (
                <span className="rounded-full bg-purple-600/50 px-3 py-1 text-sm">Permanent</span>
              )}
              {card.heroId && (
                <span className="rounded-full bg-purple-600/50 px-3 py-1 text-sm">Hero Card</span>
              )}
            </div>

            {/* Traits */}
            {traits.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {traits.map(t => (
                  <span key={t} className="rounded bg-white/10 px-2 py-0.5 text-sm">{t}</span>
                ))}
              </div>
            )}

            {/* Stats */}
            <div className="mb-4 flex flex-wrap gap-3">
              {card.cost !== null && (
                <StatBox value={card.cost} label="Cost" color="text-purple-400" />
              )}
              {card.thwart !== null && (
                <StatBox
                  value={`${card.thwart}${'*'.repeat(card.thwartConsequential ?? 0)}`}
                  label="THW"
                  color="text-blue-400"
                />
              )}
              {card.attack !== null && (
                <StatBox
                  value={`${card.attack}${'*'.repeat(card.attackConsequential ?? 0)}`}
                  label="ATK"
                  color="text-red-400"
                />
              )}
              {resources.map(r => (
                <div key={r.label} className={`min-w-[60px] rounded-lg p-3 text-center ${r.cls.split(' ')[0]}`}>
                  <div className={`text-2xl font-bold ${r.cls.split(' ')[1]}`}>
                    <span className="marvel-glyph">{r.glyph}</span> {r.count}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">{r.label}</div>
                </div>
              ))}
            </div>

            {/* Card text */}
            {card.text && (
              <div className="mb-4 rounded-lg bg-black/30 p-4">
                <div
                  className="prose prose-invert prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: formatCardText(card.text) }}
                />
              </div>
            )}

            {/* Footer */}
            <div className="flex flex-wrap gap-4 text-sm text-[var(--color-text-muted)]">
              {card.deckLimit > 0 && (
                <span><strong className="text-[var(--color-text)]">Deck Limit:</strong> {card.deckLimit}</span>
              )}
              {(() => {
                const displayPacks = (card.packs && card.packs.length > 0 ? [...card.packs].sort() : card.packName ? [card.packName] : []);
                if (displayPacks.length === 0) return null;
                return (
                  <span>
                    <strong className="text-[var(--color-text)]">
                      {displayPacks.length > 1 ? 'Packs:' : 'Pack:'}
                    </strong>{' '}
                    {displayPacks.join(', ')}
                  </span>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div className="min-w-[60px] rounded-lg bg-black/30 p-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-[var(--color-text-muted)]">{label}</div>
    </div>
  );
}
