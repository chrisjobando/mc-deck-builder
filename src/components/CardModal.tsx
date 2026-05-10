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
      <DialogContent>
        {card && (
          <div>
            <div>
            <div>
              <div>
                {card.imageUrl ? (
                  <img src={card.imageUrl} alt={card.name} />
                ) : (
                  <div>No Image</div>
                )}
              </div>
            </div>

            <div>
              <div>
                <h2>{card.name}</h2>
                {card.health !== null && (
                  <Badge>
                    {card.health} HP
                  </Badge>
                )}
              </div>

              <div>
                <CardTypeBadge type={card.type} />
                {card.aspect && <AspectBadge aspect={card.aspect} size="md" />}
                {card.isUnique && (
                  <Badge variant="outline">
                    <span className="marvel-glyph">S</span>&nbsp;Unique
                  </Badge>
                )}
                {card.isPermanent && (
                  <Badge variant="outline">
                    Permanent
                  </Badge>
                )}
                {card.heroId && (
                  <Badge variant="outline">
                    Hero Card
                  </Badge>
                )}
              </div>

              {traits.length > 0 && (
                <div>
                  {traits.map(t => (
                    <Badge key={t} variant="outline">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}

              <div>
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
                  <div key={r.label}>
                    <div>
                      <span className="marvel-glyph">{r.glyph}</span> {r.count}
                    </div>
                    <div>{r.label}</div>
                  </div>
                ))}
              </div>

              {card.text && (
                <div>
                  <div

                    dangerouslySetInnerHTML={{ __html: formatCardText(card.text) }}
                  />
                </div>
              )}

              <div>
                {card.deckLimit > 0 && (
                  <span><strong>Deck Limit:</strong> {card.deckLimit}</span>
                )}
                {(() => {
                  const displayPacks = (card.packs && card.packs.length > 0 ? [...card.packs].sort() : card.packName ? [card.packName] : []);
                  if (displayPacks.length === 0) return null;
                  return (
                    <span>
                      <strong>{displayPacks.length > 1 ? 'Packs:' : 'Pack:'}</strong>{' '}
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
