import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AspectBadge, CardTypeBadge, StatBox } from '@/components/ui/marvel';
import { formatCardText, formatTraits } from '@/lib/cardFormatting';

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

export default function CardModal({ card, onClose }: Props) {
  const isPSS = card?.type === 'player_side_scheme';
  const traits = formatTraits(card?.traits);

  const resources = card ? [
    card.resourceEnergy && { glyph: 'e', label: 'Energy', count: card.resourceEnergy, bg: 'bg-yellow-900/50', text: 'text-yellow-400' },
    card.resourceMental && { glyph: 'm', label: 'Mental', count: card.resourceMental, bg: 'bg-blue-900/50', text: 'text-blue-400' },
    card.resourcePhysical && { glyph: 'p', label: 'Physical', count: card.resourcePhysical, bg: 'bg-red-900/50', text: 'text-red-400' },
    card.resourceWild && { glyph: 'w', label: 'Wild', count: card.resourceWild, bg: 'bg-green-900/50', text: 'text-green-400' },
  ].filter(Boolean) as { glyph: string; label: string; count: number; bg: string; text: string }[] : [];

  return (
    <Dialog open={card !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-4xl h-[80vh] overflow-hidden p-0 flex flex-col">
        {card && (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className={`flex flex-col gap-6 p-6 md:flex-row ${isPSS ? 'md:items-center' : ''}`}>
            <div className={`flex-shrink-0 ${isPSS ? 'md:w-1/2' : 'md:w-1/3'}`}>
              <div className={`relative overflow-hidden rounded-lg bg-black/50 shadow-lg ${isPSS ? 'aspect-[88/63]' : 'aspect-[63/88]'}`}>
                {card.imageUrl ? (
                  <img src={card.imageUrl} alt={card.name} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">No Image</div>
                )}
              </div>
            </div>

            <div className={isPSS ? 'md:w-1/2' : 'md:w-2/3'}>
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-bold">{card.name}</h2>
                {card.health !== null && (
                  <Badge className="bg-red-600 border-transparent text-white px-3 py-1 h-auto text-sm font-bold">
                    {card.health} HP
                  </Badge>
                )}
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                <CardTypeBadge type={card.type} className="rounded-full px-3 h-7 text-sm" />
                {card.aspect && <AspectBadge aspect={card.aspect} size="md" className="rounded-full" />}
                {card.isUnique && (
                  <Badge variant="outline" className="rounded-full border-yellow-600/50 bg-yellow-600/20 text-yellow-300 px-3 h-7 text-sm">
                    <span className="marvel-glyph">S</span>&nbsp;Unique
                  </Badge>
                )}
                {card.isPermanent && (
                  <Badge variant="outline" className="rounded-full border-purple-600/50 bg-purple-600/20 text-purple-300 px-3 h-7 text-sm">
                    Permanent
                  </Badge>
                )}
                {card.heroId && (
                  <Badge variant="outline" className="rounded-full border-purple-600/50 bg-purple-600/20 text-purple-300 px-3 h-7 text-sm">
                    Hero Card
                  </Badge>
                )}
              </div>

              {traits.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {traits.map(t => (
                    <Badge key={t} variant="outline" className="rounded border-white/10 bg-white/10 text-foreground text-sm">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="mb-4 flex flex-wrap gap-3">
                {card.cost !== null && <StatBox value={card.cost} label="Cost" color="text-purple-400" />}
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
                  <div key={r.label} className={`min-w-[60px] rounded-lg p-3 text-center ${r.bg}`}>
                    <div className={`text-2xl font-bold ${r.text}`}>
                      <span className="marvel-glyph">{r.glyph}</span> {r.count}
                    </div>
                    <div className="text-xs text-muted-foreground">{r.label}</div>
                  </div>
                ))}
              </div>

              {card.text && (
                <div className="mb-4 rounded-lg bg-black/30 p-4">
                  <div
                    className="prose prose-invert prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: formatCardText(card.text) }}
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {card.deckLimit > 0 && (
                  <span><strong className="text-foreground">Deck Limit:</strong> {card.deckLimit}</span>
                )}
                {(() => {
                  const displayPacks = (card.packs && card.packs.length > 0 ? [...card.packs].sort() : card.packName ? [card.packName] : []);
                  if (displayPacks.length === 0) return null;
                  return (
                    <span>
                      <strong className="text-foreground">{displayPacks.length > 1 ? 'Packs:' : 'Pack:'}</strong>{' '}
                      {displayPacks.join(', ')}
                    </span>
                  );
                })()}
              </div>
            </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
