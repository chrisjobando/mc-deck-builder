import { useMemo, useState } from 'react';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AspectBadge, StatBox } from '@/components/ui/marvel';
import { heroSlug } from '@/lib/utils';
import { formatCardText, formatTraits, formatType, COST_BUCKETS } from '@/lib/cardFormatting';
import { showConfirm } from '../lib/dialog';

interface PreviewCard {
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
  quantity: number;
  imageUrl: string | null;
  text: string | null;
  traits: string | null;
  resourceEnergy: number | null;
  resourceMental: number | null;
  resourcePhysical: number | null;
  resourceWild: number | null;
  isUnique: boolean;
}

export interface DeckPreview {
  id: string;
  name: string;
  heroId: string;
  heroName: string;
  heroHealth: number;
  heroImageUrl: string | null;
  heroText: string | null;
  heroTraits: string | null;
  heroAttack: number | null;
  heroThwart: number | null;
  heroDefense: number | null;
  heroRecover: number | null;
  heroHandSize: number | null;
  alterEgoName: string | null;
  alterEgoImageUrl: string | null;
  alterEgoText: string | null;
  alterEgoTraits: string | null;
  alterEgoAttack: number | null;
  alterEgoThwart: number | null;
  alterEgoDefense: number | null;
  alterEgoRecover: number | null;
  alterEgoHandSize: number | null;
  aspects: string[];
  cards: PreviewCard[];
  total: number;
  updatedAt: string;
}

const TYPE_ORDER_LIST = ['ally', 'event', 'support', 'upgrade', 'resource', 'player_side_scheme'];

function HeroDetails({ deck, heroSide }: { deck: DeckPreview; heroSide: 'hero' | 'alter_ego' }) {
  const isAlterEgo = heroSide === 'alter_ego';
  const displayName = isAlterEgo ? deck.alterEgoName : deck.heroName;
  const text = isAlterEgo ? deck.alterEgoText : deck.heroText;
  const atk = isAlterEgo ? deck.alterEgoAttack : deck.heroAttack;
  const thw = isAlterEgo ? deck.alterEgoThwart : deck.heroThwart;
  const def = isAlterEgo ? deck.alterEgoDefense : deck.heroDefense;
  const rec = isAlterEgo ? deck.alterEgoRecover : deck.heroRecover;
  const hnd = isAlterEgo ? deck.alterEgoHandSize : deck.heroHandSize;
  const traitList = formatTraits(isAlterEgo ? deck.alterEgoTraits : deck.heroTraits);
  return (
    <>
      <p>{displayName}</p>
      <div>
        <StatBox size="xs" label="THW" value={thw} color="text-blue-400" />
        <StatBox size="xs" label="ATK" value={atk} color="text-red-400" />
        <StatBox size="xs" label="DEF" value={def} color="text-green-400" />
        <StatBox size="xs" label="REC" value={rec} color="text-yellow-400" />
        <StatBox size="xs" label="HAND" value={hnd} color="text-purple-400" />
        <StatBox size="xs" label="HP" value={deck.heroHealth} color="text-pink-400" />
      </div>
      {traitList.length > 0 && (
        <div>
          {traitList.map(t => (
            <Badge key={t} variant="outline">
              {t}
            </Badge>
          ))}
        </div>
      )}
      {text && (
        <p

          dangerouslySetInnerHTML={{ __html: formatCardText(text) }}
        />
      )}
    </>
  );
}

function CardDetails({ card }: { card: PreviewCard }) {
  const traitList = formatTraits(card.traits);
  const icons = [
    ...Array(card.resourceEnergy ?? 0).fill('e'),
    ...Array(card.resourceMental ?? 0).fill('m'),
    ...Array(card.resourcePhysical ?? 0).fill('p'),
    ...Array(card.resourceWild ?? 0).fill('w'),
  ];
  return (
    <>
      <p>{card.name}</p>
      <div>
        {card.cost !== null && (
          <Badge variant="outline">
            Cost {card.cost}
          </Badge>
        )}
        <Badge variant="outline">
          {formatType(card.type)}
        </Badge>
        {card.aspect && <AspectBadge aspect={card.aspect} />}
        {card.isUnique && (
          <Badge variant="outline">
            <span className="marvel-glyph">S</span>&nbsp;Unique
          </Badge>
        )}
      </div>
      {(card.thwart !== null || card.attack !== null || card.health !== null) && (
        <div>
          {card.thwart !== null && <StatBox size="xs" label="THW" value={card.thwart} color="text-blue-400" />}
          {card.attack !== null && <StatBox size="xs" label="ATK" value={card.attack} color="text-red-400" />}
          {card.health !== null && <StatBox size="xs" label="HP" value={card.health} color="text-pink-400" />}
        </div>
      )}
      {traitList.length > 0 && (
        <div>
          {traitList.map(t => (
            <Badge key={t} variant="outline">
              {t}
            </Badge>
          ))}
        </div>
      )}
      {card.text && (
        <p

          dangerouslySetInnerHTML={{ __html: formatCardText(card.text) }}
        />
      )}
      {icons.length > 0 && (
        <div>
          {icons.map((icon, i) => <span key={i} className="marvel-glyph">{icon}</span>)}
        </div>
      )}
    </>
  );
}

export default function DeckGrid({ decks: initialDecks }: { decks: DeckPreview[] }) {
  const [decks, setDecks] = useState(initialDecks);
  const [openDeck, setOpenDeck] = useState<DeckPreview | null>(null);
  const [selectedCard, setSelectedCard] = useState<PreviewCard | null>(null);
  const [heroSide, setHeroSide] = useState<'hero' | 'alter_ego'>('hero');
  const [deleting, setDeleting] = useState(false);
  const [copying, setCopying] = useState(false);

  function openModal(deck: DeckPreview) {
    setOpenDeck(deck);
    setSelectedCard(null);
    setHeroSide('hero');
  }

  function closeModal() {
    setOpenDeck(null);
    setSelectedCard(null);
  }

  async function copyDeck() {
    if (!openDeck) return;
    setCopying(true);
    const res = await fetch('/api/builder/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${openDeck.name} (Copy)`,
        heroCardId: openDeck.heroId,
        aspects: openDeck.aspects,
        cards: openDeck.cards.map(c => ({ cardId: c.id, quantity: c.quantity })),
        isPublic: false,
      }),
    });
    if (res.ok) {
      const { deckId } = await res.json() as { deckId: string };
      const copy: DeckPreview = { ...openDeck, id: deckId, name: `${openDeck.name} (Copy)`, updatedAt: 'just now' };
      setDecks(prev => [copy, ...prev]);
      closeModal();
    }
    setCopying(false);
  }

  async function deleteDeck() {
    if (!openDeck) return;
    const confirmed = await showConfirm('This deck will be permanently deleted.', { title: 'Delete deck?', confirmLabel: 'Delete', danger: true });
    if (!confirmed) return;
    setDeleting(true);
    const res = await fetch(`/api/decks/${openDeck.id}`, { method: 'DELETE' });
    if (res.ok) {
      setDecks(prev => prev.filter(d => d.id !== openDeck.id));
      closeModal();
    }
    setDeleting(false);
  }

  const leftImageUrl = selectedCard
    ? selectedCard.imageUrl
    : heroSide === 'alter_ego'
      ? openDeck?.alterEgoImageUrl
      : openDeck?.heroImageUrl;

  const grouped = useMemo(
    () => openDeck
      ? openDeck.cards.reduce<Record<string, PreviewCard[]>>((acc, c) => {
          (acc[c.type] ??= []).push(c);
          return acc;
        }, {})
      : {},
    [openDeck]
  );

  const typeBreakdown = useMemo(
    () => openDeck
      ? Object.entries(
          openDeck.cards.reduce<Record<string, number>>((acc, c) => {
            acc[c.type] = (acc[c.type] ?? 0) + c.quantity;
            return acc;
          }, {}),
        ).sort(([ta], [tb]) => TYPE_ORDER_LIST.indexOf(ta) - TYPE_ORDER_LIST.indexOf(tb))
      : [],
    [openDeck]
  );

  const { costBreakdown, maxCostCount } = useMemo(() => {
    const breakdown = COST_BUCKETS.reduce<Record<number, number>>((acc, b) => ({ ...acc, [b]: 0 }), {});
    if (openDeck) {
      for (const c of openDeck.cards) {
        if (c.cost === null) continue;
        breakdown[Math.min(c.cost, 4)] += c.quantity;
      }
    }
    return { costBreakdown: breakdown, maxCostCount: Math.max(...COST_BUCKETS.map(b => breakdown[b]), 1) };
  }, [openDeck]);

  if (decks.length === 0) {
    return (
      <div>
        <p>No decks yet</p>
        <p>Head to the builder to create your first deck.</p>
        <Button asChild>
          <a href="/builder">Build a Deck</a>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div>
        {decks.map(deck => (
          <div key={deck.id}>
            <button onClick={() => openModal(deck)}>
              <div>
                {deck.heroImageUrl ? (
                  <img src={deck.heroImageUrl} alt={deck.heroName} />
                ) : (
                  <div>No Image</div>
                )}
              </div>
              <div>
                <p>{deck.name}</p>
                <p>{deck.heroName}</p>
                <div>
                  {deck.aspects.map(aspect => (
                    <AspectBadge key={aspect} aspect={aspect} />
                  ))}
                </div>
                <div>
                  <span>
                    {deck.total} cards
                  </span>
                  <span>{deck.updatedAt}</span>
                </div>
              </div>
            </button>
          </div>
        ))}
      </div>

      <Dialog open={openDeck !== null} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent
          showCloseButton={false}

          style={{ maxHeight: '90vh' }}
        >
          {openDeck && (
            <>
              {/* Left panel */}
              <div>
                <div>
                  <div>
                    <h2>{openDeck.name}</h2>
                    <p>{openDeck.heroName}</p>
                    <div>
                      {openDeck.aspects.map(a => (
                        <AspectBadge key={a} aspect={a} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <Button variant="ghost" size="icon-sm" asChild aria-label="Edit deck" title="Edit deck">
                      <a href={`/builder/${heroSlug(openDeck.heroName, openDeck.heroId)}/${openDeck.aspects.map(a => a.toLowerCase()).sort().join(',')}?deck=${openDeck.id}`}>
                        <Pencil />
                      </a>
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={copyDeck} disabled={copying} aria-label="Copy deck" title="Copy deck">
                      <Copy />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={deleteDeck} disabled={deleting} aria-label="Delete deck">
                      <Trash2 />
                    </Button>
                  </div>
                </div>

                <div>
                  <div>
                    <div>
                      <div>
                        {leftImageUrl ? (
                          <img src={leftImageUrl} alt={selectedCard?.name ?? openDeck.heroName} className={selectedCard?.type === 'player_side_scheme' ? 'pss-img' : ''} />
                        ) : (
                          <div>No Image</div>
                        )}
                      </div>
                      {!selectedCard && openDeck.alterEgoImageUrl && (
                        <Button
                          variant="outline"
                          size="xs"

                          onClick={() => setHeroSide(s => s === 'hero' ? 'alter_ego' : 'hero')}
                        >
                          {heroSide === 'hero' ? 'Alter Ego →' : '← Hero'}
                        </Button>
                      )}
                      {selectedCard && (
                        <Button
                          variant="outline"
                          size="xs"

                          onClick={() => setSelectedCard(null)}
                        >
                          ← Hero
                        </Button>
                      )}
                    </div>

                    <div>
                      {selectedCard
                        ? <CardDetails card={selectedCard} />
                        : <HeroDetails deck={openDeck} heroSide={heroSide} />
                      }
                    </div>
                  </div>

                  <div>
                    <p>Composition</p>
                    <div>
                      {typeBreakdown.map(([type, count]) => (
                        <div
                          key={type}

                          style={{ width: `${(count / openDeck.total) * 100}%` }}
                          title={`${formatType(type)}: ${count}`}
                        />
                      ))}
                    </div>
                    <div>
                      {typeBreakdown.map(([type, count]) => (
                        <span key={type}>
                          <span />
                          {formatType(type)} {count}
                        </span>
                      ))}
                    </div>
                    <p>Cost Curve</p>
                    <div>
                      {COST_BUCKETS.map(cost => {
                        const count = costBreakdown[cost];
                        const barPx = count > 0 ? Math.max(4, Math.round((count / maxCostCount) * 36)) : 0;
                        return (
                          <div key={cost}>
                            <span>{count}</span>
                            <div>
                              <div

                                style={{ height: `${barPx}px` }}
                              />
                            </div>
                            <span>
                              {cost === 4 ? '4+' : cost}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right panel — card list */}
              <div>
                <div>
                  {Object.entries(grouped).map(([type, cards]) => (
                    <div key={type}>
                      <p>
                        {formatType(type)} ({cards.reduce((s, c) => s + c.quantity, 0)})
                      </p>
                      {cards.map(card => (
                        <button
                          key={card.id}
                          onClick={() => setSelectedCard(selectedCard?.id === card.id ? null : card)}

                        >
                          <span>
                            <span

                              style={{ backgroundColor: card.aspect ? `var(--color-aspect-dot-${card.aspect.toLowerCase()})` : 'rgb(75 85 99)' }}
                            />
                            <span>{card.name}</span>
                            {card.isUnique && <span className="marvel-glyph">S</span>}
                          </span>
                          <span>×{card.quantity}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
                <div>
                  {openDeck.total} cards · updated {openDeck.updatedAt}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
