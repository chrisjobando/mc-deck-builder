import { useState } from 'react';
import { heroSlug } from '../lib/utils';
import { formatCardText, formatType, TYPE_COLOR, COST_BUCKETS } from '../lib/cardFormatting';

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

const ASPECT_BG: Record<string, string> = {
  Aggression: 'bg-red-700',
  Justice: 'bg-yellow-600',
  Leadership: 'bg-blue-700',
  Protection: 'bg-green-700',
  Pool: 'bg-pink-700',
  Basic: 'bg-gray-700',
};

const ASPECT_DOT: Record<string, string> = {
  Aggression: 'bg-red-500',
  Justice: 'bg-yellow-500',
  Leadership: 'bg-blue-500',
  Protection: 'bg-green-500',
  Pool: 'bg-pink-500',
  Basic: 'bg-gray-400',
};

const TYPE_ORDER_LIST = ['ally', 'event', 'support', 'upgrade', 'resource', 'player_side_scheme'];

function splitTraits(traits: string | null): string[] {
  if (!traits) return [];
  return traits.split('. ').map(t => t.replace(/\.$/, '').trim()).filter(Boolean);
}

function StatBox({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <div className="rounded bg-black/30 px-2 py-1.5 text-center">
      <p className={`text-sm font-bold leading-none ${color}`}>{value ?? '—'}</p>
      <p className="mt-0.5 text-[9px] leading-none text-[var(--color-text-muted)]">{label}</p>
    </div>
  );
}

function HeroDetails({ deck, heroSide }: { deck: DeckPreview; heroSide: 'hero' | 'alter_ego' }) {
  const isAlterEgo = heroSide === 'alter_ego';
  const displayName = isAlterEgo ? deck.alterEgoName : deck.heroName;
  const text = isAlterEgo ? deck.alterEgoText : deck.heroText;
  const atk = isAlterEgo ? deck.alterEgoAttack : deck.heroAttack;
  const thw = isAlterEgo ? deck.alterEgoThwart : deck.heroThwart;
  const def = isAlterEgo ? deck.alterEgoDefense : deck.heroDefense;
  const rec = isAlterEgo ? deck.alterEgoRecover : deck.heroRecover;
  const hnd = isAlterEgo ? deck.alterEgoHandSize : deck.heroHandSize;
  const traitList = splitTraits(isAlterEgo ? deck.alterEgoTraits : deck.heroTraits);
  return (
    <>
      <p className="font-semibold leading-tight">{displayName}</p>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <StatBox label="THW" value={thw} color="text-blue-400" />
        <StatBox label="ATK" value={atk} color="text-red-400" />
        <StatBox label="DEF" value={def} color="text-green-400" />
        <StatBox label="REC" value={rec} color="text-yellow-400" />
        <StatBox label="HAND" value={hnd} color="text-purple-400" />
        <StatBox label="HP" value={deck.heroHealth} color="text-pink-400" />
      </div>
      {traitList.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {traitList.map(t => (
            <span key={t} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]">{t}</span>
          ))}
        </div>
      )}
      {text && (
        <p
          className="mt-2 text-xs leading-relaxed text-[var(--color-text-muted)]"
          dangerouslySetInnerHTML={{ __html: formatCardText(text) }}
        />
      )}
    </>
  );
}

function CardDetails({ card }: { card: PreviewCard }) {
  const traitList = splitTraits(card.traits);
  const icons = [
    ...Array(card.resourceEnergy ?? 0).fill('⚡'),
    ...Array(card.resourceMental ?? 0).fill('🧪'),
    ...Array(card.resourcePhysical ?? 0).fill('👊'),
    ...Array(card.resourceWild ?? 0).fill('🍃'),
  ];
  return (
    <>
      <p className="font-semibold leading-tight">{card.name}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {card.cost !== null && (
          <span className="rounded bg-purple-900/60 px-2 py-0.5 text-xs font-bold text-purple-300">
            Cost {card.cost}
          </span>
        )}
        <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
          {formatType(card.type)}
        </span>
        {card.aspect && (
          <span className={`rounded px-2 py-0.5 text-xs text-white ${ASPECT_BG[card.aspect] ?? 'bg-gray-700'}`}>
            {card.aspect}
          </span>
        )}
        {card.isUnique && (
          <span className="rounded bg-yellow-600/30 px-2 py-0.5 text-xs text-yellow-400">★ Unique</span>
        )}
      </div>
      {(card.thwart !== null || card.attack !== null || card.health !== null) && (
        <div className="mt-2 flex gap-1.5">
          {card.thwart !== null && <StatBox label="THW" value={card.thwart} color="text-blue-400" />}
          {card.attack !== null && <StatBox label="ATK" value={card.attack} color="text-red-400" />}
          {card.health !== null && <StatBox label="HP" value={card.health} color="text-pink-400" />}
        </div>
      )}
      {traitList.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {traitList.map(t => (
            <span key={t} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]">{t}</span>
          ))}
        </div>
      )}
      {card.text && (
        <p
          className="mt-2 text-xs leading-relaxed text-[var(--color-text-muted)]"
          dangerouslySetInnerHTML={{ __html: formatCardText(card.text) }}
        />
      )}
      {icons.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-0.5">
          {icons.map((icon, i) => <span key={i} className="text-xs">{icon}</span>)}
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
    if (!openDeck || !confirm('Delete this deck?')) return;
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

  const grouped = openDeck
    ? openDeck.cards.reduce<Record<string, PreviewCard[]>>((acc, c) => {
        (acc[c.type] ??= []).push(c);
        return acc;
      }, {})
    : {};

  const typeBreakdown = openDeck
    ? Object.entries(
        openDeck.cards.reduce<Record<string, number>>((acc, c) => {
          acc[c.type] = (acc[c.type] ?? 0) + c.quantity;
          return acc;
        }, {}),
      ).sort(([ta], [tb]) => TYPE_ORDER_LIST.indexOf(ta) - TYPE_ORDER_LIST.indexOf(tb))
    : [];

  const costBreakdown = COST_BUCKETS.reduce<Record<number, number>>((acc, b) => ({ ...acc, [b]: 0 }), {});
  if (openDeck) {
    for (const c of openDeck.cards) {
      if (c.cost === null) continue;
      costBreakdown[Math.min(c.cost, 6)] += c.quantity;
    }
  }
  const maxCostCount = Math.max(...COST_BUCKETS.map(b => costBreakdown[b]), 1);

  if (decks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-[var(--color-surface)] py-20 text-center">
        <p className="text-lg font-semibold">No decks yet</p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">Head to the builder to create your first deck.</p>
        <a href="/builder" className="mt-4 rounded bg-[var(--color-primary)] px-4 py-2 text-sm font-medium hover:opacity-90">
          Build a Deck
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {decks.map(deck => (
          <div key={deck.id} className="group relative flex flex-col overflow-hidden rounded-lg border border-white/10 bg-[var(--color-surface)] transition hover:border-[var(--color-primary)]">
            <button className="cursor-pointer text-left" onClick={() => openModal(deck)}>
              <div className="relative aspect-[63/88] w-full overflow-hidden bg-black/30">
                {deck.heroImageUrl ? (
                  <img src={deck.heroImageUrl} alt={deck.heroName} className="h-full w-full object-cover transition group-hover:scale-105" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-[var(--color-text-muted)]">No Image</div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-2">
                <p className="truncate text-xs font-semibold">{deck.name}</p>
                <p className="truncate text-[10px] text-[var(--color-text-muted)]">{deck.heroName}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {deck.aspects.map(aspect => (
                    <span key={aspect} className={`rounded px-1 py-0.5 text-[9px] font-medium text-white ${ASPECT_BG[aspect] ?? 'bg-gray-700'}`}>
                      {aspect}
                    </span>
                  ))}
                </div>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className={`text-[10px] ${deck.total >= 40 && deck.total <= 50 ? 'text-green-400' : 'text-[var(--color-text-muted)]'}`}>
                    {deck.total} cards
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">{deck.updatedAt}</span>
                </div>
              </div>
            </button>
          </div>
        ))}
      </div>

      {openDeck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={closeModal} />
          <div className="relative z-10 flex w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[var(--color-surface)] shadow-2xl sm:flex-row" style={{ maxHeight: '90vh' }}>

            <div className="flex min-w-0 flex-col sm:w-[70%]">
              <div className="flex items-start justify-between border-b border-white/10 px-4 py-3">
                <div className="min-w-0">
                  <h2 className="truncate font-bold">{openDeck.name}</h2>
                  <p className="text-xs text-[var(--color-text-muted)]">{openDeck.heroName}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {openDeck.aspects.map(a => (
                      <span key={a} className={`rounded px-1.5 py-0.5 text-[10px] font-medium text-white ${ASPECT_BG[a] ?? 'bg-gray-700'}`}>{a}</span>
                    ))}
                  </div>
                </div>
                <div className="ml-3 flex flex-shrink-0 items-center gap-1">
                  <a
                    href={`/builder/${heroSlug(openDeck.heroName, openDeck.heroId)}/${openDeck.aspects.map(a => a.toLowerCase()).sort().join(',')}?deck=${openDeck.id}`}
                    className="rounded p-1.5 text-[var(--color-text-muted)] transition hover:bg-white/10 hover:text-[var(--color-text)]"
                    aria-label="Edit deck" title="Edit deck"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </a>
                  <button onClick={copyDeck} disabled={copying} className="rounded p-1.5 text-[var(--color-text-muted)] transition hover:bg-white/10 hover:text-[var(--color-text)] disabled:opacity-50" aria-label="Copy deck" title="Copy deck">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
                      <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" />
                    </svg>
                  </button>
                  <button onClick={deleteDeck} disabled={deleting} className="rounded p-1.5 text-[var(--color-text-muted)] transition hover:bg-red-900/40 hover:text-red-400 disabled:opacity-50" aria-label="Delete deck">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button onClick={closeModal} className="rounded p-2 hover:bg-white/10" aria-label="Close">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="flex gap-4 p-4">
                  <div className="w-32 flex-shrink-0 sm:w-36">
                    <div className="relative aspect-[63/88] overflow-hidden rounded-lg bg-black/30">
                      {leftImageUrl ? (
                        <img src={leftImageUrl} alt={selectedCard?.name ?? openDeck.heroName} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-[var(--color-text-muted)]">No Image</div>
                      )}
                    </div>
                    {!selectedCard && openDeck.alterEgoImageUrl && (
                      <button
                        onClick={() => setHeroSide(s => s === 'hero' ? 'alter_ego' : 'hero')}
                        className="mt-2 w-full rounded border border-white/10 px-2 py-1 text-center text-[10px] text-[var(--color-text-muted)] transition hover:bg-white/5 hover:text-[var(--color-text)]"
                      >
                        {heroSide === 'hero' ? 'Alter Ego →' : '← Hero'}
                      </button>
                    )}
                    {selectedCard && (
                      <button
                        onClick={() => setSelectedCard(null)}
                        className="mt-2 w-full rounded border border-white/10 px-2 py-1 text-center text-[10px] text-[var(--color-text-muted)] transition hover:bg-white/5 hover:text-[var(--color-text)]"
                      >
                        ← Hero
                      </button>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    {selectedCard
                      ? <CardDetails card={selectedCard} />
                      : <HeroDetails deck={openDeck} heroSide={heroSide} />
                    }
                  </div>
                </div>

                <div className="border-t border-white/10 px-4 py-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Composition</p>
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
                      <span key={type} className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                        <span className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${TYPE_COLOR[type] ?? 'bg-gray-500'}`} />
                        {formatType(type)} {count}
                      </span>
                    ))}
                  </div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Cost Curve</p>
                  <div className="flex gap-1">
                    {COST_BUCKETS.map(cost => {
                      const count = costBreakdown[cost];
                      const barPx = count > 0 ? Math.max(4, Math.round((count / maxCostCount) * 36)) : 0;
                      return (
                        <div key={cost} className="flex flex-1 flex-col items-center">
                          <span className={`mb-0.5 text-[10px] leading-none ${count > 0 ? '' : 'invisible'}`}>{count}</span>
                          <div className="flex h-9 w-full items-end">
                            <div
                              className="w-full rounded-t-sm bg-[var(--color-primary)] transition-all duration-300"
                              style={{ height: `${barPx}px` }}
                            />
                          </div>
                          <span className="mt-0.5 text-[10px] leading-none text-[var(--color-text-muted)]">
                            {cost === 6 ? '6+' : cost}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col border-t border-white/10 sm:w-[30%] sm:border-l sm:border-t-0">
              <div className="flex-1 overflow-y-auto px-3 py-3">
                {Object.entries(grouped).map(([type, cards]) => (
                  <div key={type} className="mb-4">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                      {formatType(type)} ({cards.reduce((s, c) => s + c.quantity, 0)})
                    </p>
                    {cards.map(card => (
                      <button
                        key={card.id}
                        onClick={() => setSelectedCard(selectedCard?.id === card.id ? null : card)}
                        className={`flex w-full items-center justify-between rounded px-1.5 py-1 text-xs transition hover:bg-white/5 ${selectedCard?.id === card.id ? 'bg-white/10' : ''}`}
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <span className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${card.aspect ? (ASPECT_DOT[card.aspect] ?? 'bg-gray-400') : 'bg-gray-600'}`} />
                          <span className="truncate">{card.name}</span>
                          {card.isUnique && <span className="flex-shrink-0 text-[10px] text-yellow-400">★</span>}
                        </span>
                        <span className="ml-2 flex-shrink-0 text-[var(--color-text-muted)]">×{card.quantity}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              <div className="border-t border-white/10 px-3 py-2 text-xs text-[var(--color-text-muted)]">
                {openDeck.total} cards · updated {openDeck.updatedAt}
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
