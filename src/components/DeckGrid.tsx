import { useMemo, useState } from 'react';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AspectBadge, StatBox } from '@/components/ui/marvel';
import { heroSlug } from '@/lib/utils';
import { formatCardText, formatTraits, formatType, TYPE_COLOR, COST_BUCKETS } from '@/lib/cardFormatting';
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
      <p className="font-semibold leading-tight">{displayName}</p>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <StatBox size="xs" label="THW" value={thw} color="text-blue-400" />
        <StatBox size="xs" label="ATK" value={atk} color="text-red-400" />
        <StatBox size="xs" label="DEF" value={def} color="text-green-400" />
        <StatBox size="xs" label="REC" value={rec} color="text-yellow-400" />
        <StatBox size="xs" label="HAND" value={hnd} color="text-purple-400" />
        <StatBox size="xs" label="HP" value={deck.heroHealth} color="text-pink-400" />
      </div>
      {traitList.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {traitList.map(t => (
            <Badge key={t} variant="outline" className="rounded border-white/10 bg-white/10 text-[10px] text-muted-foreground">
              {t}
            </Badge>
          ))}
        </div>
      )}
      {text && (
        <p
          className="mt-2 text-xs leading-relaxed text-muted-foreground"
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
      <p className="font-semibold leading-tight">{card.name}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {card.cost !== null && (
          <Badge variant="outline" className="rounded border-purple-900/60 bg-purple-900/60 text-purple-300 text-xs font-bold">
            Cost {card.cost}
          </Badge>
        )}
        <Badge variant="outline" className="rounded border-white/10 bg-white/10 text-xs text-muted-foreground">
          {formatType(card.type)}
        </Badge>
        {card.aspect && <AspectBadge aspect={card.aspect} className="rounded text-xs" />}
        {card.isUnique && (
          <Badge variant="outline" className="rounded border-yellow-600/30 bg-yellow-600/30 text-yellow-400 text-xs">
            <span className="marvel-glyph">S</span>&nbsp;Unique
          </Badge>
        )}
      </div>
      {(card.thwart !== null || card.attack !== null || card.health !== null) && (
        <div className="mt-2 flex gap-1.5">
          {card.thwart !== null && <StatBox size="xs" label="THW" value={card.thwart} color="text-blue-400" />}
          {card.attack !== null && <StatBox size="xs" label="ATK" value={card.attack} color="text-red-400" />}
          {card.health !== null && <StatBox size="xs" label="HP" value={card.health} color="text-pink-400" />}
        </div>
      )}
      {traitList.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {traitList.map(t => (
            <Badge key={t} variant="outline" className="rounded border-white/10 bg-white/10 text-[10px] text-muted-foreground">
              {t}
            </Badge>
          ))}
        </div>
      )}
      {card.text && (
        <p
          className="mt-2 text-xs leading-relaxed text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: formatCardText(card.text) }}
        />
      )}
      {icons.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-0.5">
          {icons.map((icon, i) => <span key={i} className="marvel-glyph text-xs">{icon}</span>)}
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
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-20 text-center">
        <p className="text-lg font-semibold">No decks yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Head to the builder to create your first deck.</p>
        <Button asChild className="mt-4">
          <a href="/builder">Build a Deck</a>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {decks.map(deck => (
          <div key={deck.id} className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card transition hover:border-primary">
            <button className="cursor-pointer text-left" onClick={() => openModal(deck)}>
              <div className="relative aspect-[63/88] w-full overflow-hidden bg-black/30">
                {deck.heroImageUrl ? (
                  <img src={deck.heroImageUrl} alt={deck.heroName} className="h-full w-full object-cover transition group-hover:scale-105" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No Image</div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-2">
                <p className="truncate text-xs font-semibold">{deck.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">{deck.heroName}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {deck.aspects.map(aspect => (
                    <AspectBadge key={aspect} aspect={aspect} className="rounded text-[9px] h-4 px-1" />
                  ))}
                </div>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className={`text-[10px] ${deck.total >= 40 && deck.total <= 50 ? 'text-green-400' : 'text-muted-foreground'}`}>
                    {deck.total} cards
                  </span>
                  <span className="text-[10px] text-muted-foreground">{deck.updatedAt}</span>
                </div>
              </div>
            </button>
          </div>
        ))}
      </div>

      <Dialog open={openDeck !== null} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent
          showCloseButton={false}
          className="max-w-4xl p-0 overflow-hidden flex flex-col sm:flex-row"
          style={{ maxHeight: '90vh' }}
        >
          {openDeck && (
            <>
              {/* Left panel */}
              <div className="flex min-w-0 flex-col sm:w-[70%]">
                <div className="flex items-start justify-between border-b border-border px-4 py-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-bold">{openDeck.name}</h2>
                    <p className="text-xs text-muted-foreground">{openDeck.heroName}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {openDeck.aspects.map(a => (
                        <AspectBadge key={a} aspect={a} className="rounded text-[10px] h-5" />
                      ))}
                    </div>
                  </div>
                  <div className="ml-3 flex flex-shrink-0 items-center gap-0.5">
                    <Button variant="ghost" size="icon-sm" asChild aria-label="Edit deck" title="Edit deck">
                      <a href={`/builder/${heroSlug(openDeck.heroName, openDeck.heroId)}/${openDeck.aspects.map(a => a.toLowerCase()).sort().join(',')}?deck=${openDeck.id}`}>
                        <Pencil className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={copyDeck} disabled={copying} aria-label="Copy deck" title="Copy deck">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={deleteDeck} disabled={deleting} className="hover:bg-red-900/40 hover:text-red-400" aria-label="Delete deck">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  <div className="flex gap-4 p-4">
                    <div className="w-32 flex-shrink-0 sm:w-36">
                      <div className="relative aspect-[63/88] overflow-hidden rounded-lg bg-black/30">
                        {leftImageUrl ? (
                          <img src={leftImageUrl} alt={selectedCard?.name ?? openDeck.heroName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No Image</div>
                        )}
                      </div>
                      {!selectedCard && openDeck.alterEgoImageUrl && (
                        <Button
                          variant="outline"
                          size="xs"
                          className="mt-2 w-full text-[10px]"
                          onClick={() => setHeroSide(s => s === 'hero' ? 'alter_ego' : 'hero')}
                        >
                          {heroSide === 'hero' ? 'Alter Ego →' : '← Hero'}
                        </Button>
                      )}
                      {selectedCard && (
                        <Button
                          variant="outline"
                          size="xs"
                          className="mt-2 w-full text-[10px]"
                          onClick={() => setSelectedCard(null)}
                        >
                          ← Hero
                        </Button>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      {selectedCard
                        ? <CardDetails card={selectedCard} />
                        : <HeroDetails deck={openDeck} heroSide={heroSide} />
                      }
                    </div>
                  </div>

                  <div className="border-t border-border px-4 py-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Composition</p>
                    <div className="mb-2 flex h-1.5 w-full overflow-hidden rounded-full">
                      {typeBreakdown.map(([type, count]) => (
                        <div
                          key={type}
                          className={`h-full ${TYPE_COLOR[type] ?? 'bg-gray-500'}`}
                          style={{ width: `${(count / openDeck.total) * 100}%` }}
                          title={`${formatType(type)}: ${count}`}
                        />
                      ))}
                    </div>
                    <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1">
                      {typeBreakdown.map(([type, count]) => (
                        <span key={type} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <span className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${TYPE_COLOR[type] ?? 'bg-gray-500'}`} />
                          {formatType(type)} {count}
                        </span>
                      ))}
                    </div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cost Curve</p>
                    <div className="flex gap-1">
                      {COST_BUCKETS.map(cost => {
                        const count = costBreakdown[cost];
                        const barPx = count > 0 ? Math.max(4, Math.round((count / maxCostCount) * 36)) : 0;
                        return (
                          <div key={cost} className="flex flex-1 flex-col items-center">
                            <span className={`mb-0.5 text-[10px] leading-none ${count > 0 ? '' : 'invisible'}`}>{count}</span>
                            <div className="flex h-9 w-full items-end">
                              <div
                                className="w-full rounded-t-sm bg-primary transition-all duration-300"
                                style={{ height: `${barPx}px` }}
                              />
                            </div>
                            <span className="mt-0.5 text-[10px] leading-none text-muted-foreground">
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
              <div className="flex flex-col border-t border-border sm:w-[30%] sm:border-l sm:border-t-0">
                <div className="flex-1 overflow-y-auto px-3 py-3">
                  {Object.entries(grouped).map(([type, cards]) => (
                    <div key={type} className="mb-4">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {formatType(type)} ({cards.reduce((s, c) => s + c.quantity, 0)})
                      </p>
                      {cards.map(card => (
                        <button
                          key={card.id}
                          onClick={() => setSelectedCard(selectedCard?.id === card.id ? null : card)}
                          className={`flex w-full items-center justify-between rounded px-1.5 py-1 text-xs transition hover:bg-white/5 ${selectedCard?.id === card.id ? 'bg-white/10' : ''}`}
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            <span
                              className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                              style={{ backgroundColor: card.aspect ? `var(--color-aspect-dot-${card.aspect.toLowerCase()})` : 'rgb(75 85 99)' }}
                            />
                            <span className="truncate">{card.name}</span>
                            {card.isUnique && <span className="marvel-glyph flex-shrink-0 text-[10px] text-yellow-400">S</span>}
                          </span>
                          <span className="ml-2 flex-shrink-0 text-muted-foreground">×{card.quantity}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
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
