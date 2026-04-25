import { useEffect, useMemo, useState } from 'react';
import CardModal from './CardModal';

interface HeroIdentity {
  identityType: string;
  imageUrl: string | null;
  name: string;
}

interface HeroOption {
  id: string;
  name: string;
  health: number;
  isMultiAspect: boolean;
  packCode: string | null;
  packName: string | null;
  identities: HeroIdentity[];
}

interface CardPoolItem {
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
  packCode: string | null;
  packName: string | null;
  heroId: string | null;
  resourceEnergy: number | null;
  resourceMental: number | null;
  resourcePhysical: number | null;
  resourceWild: number | null;
  quantity: number;
  packs: string[];
}

interface DeckEntry {
  card: CardPoolItem;
  quantity: number;
}

type Step = 'hero' | 'aspect' | 'editor';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const ASPECTS = ['Aggression', 'Justice', 'Leadership', 'Protection', 'Pool'] as const;

const ASPECT_BG: Record<string, string> = {
  Aggression: 'bg-red-700',
  Justice: 'bg-yellow-600',
  Leadership: 'bg-blue-700',
  Protection: 'bg-green-700',
  Pool: 'bg-pink-700',
  Basic: 'bg-gray-700',
};

const ASPECT_RING: Record<string, string> = {
  Aggression: 'ring-red-400',
  Justice: 'ring-yellow-400',
  Leadership: 'ring-blue-400',
  Protection: 'ring-green-400',
  Pool: 'ring-pink-400',
};

const ASPECT_DOT: Record<string, string> = {
  Aggression: 'bg-red-500',
  Justice: 'bg-yellow-500',
  Leadership: 'bg-blue-500',
  Protection: 'bg-green-500',
  Pool: 'bg-pink-500',
  Basic: 'bg-gray-400',
};

const TYPE_BADGE: Record<string, string> = {
  ally: 'bg-blue-900/80 text-blue-200',
  event: 'bg-purple-900/80 text-purple-200',
  support: 'bg-yellow-900/80 text-yellow-200',
  upgrade: 'bg-emerald-900/80 text-emerald-200',
  resource: 'bg-gray-800 text-gray-300',
  player_side_scheme: 'bg-orange-900/80 text-orange-200',
};

const TYPE_COLOR: Record<string, string> = {
  ally: 'bg-blue-500',
  event: 'bg-purple-500',
  support: 'bg-yellow-500',
  upgrade: 'bg-emerald-500',
  resource: 'bg-gray-500',
  player_side_scheme: 'bg-orange-500',
};

function formatType(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Adam Warlock must use all 4 aspects — skip the aspect step for him
const WARLOCK_ID = '21031a';
const ALL_ASPECTS = ['Aggression', 'Justice', 'Leadership', 'Protection'];

const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'ally', label: 'Allies' },
  { value: 'event', label: 'Events' },
  { value: 'support', label: 'Supports' },
  { value: 'upgrade', label: 'Upgrades' },
  { value: 'resource', label: 'Resources' },
];

export default function DeckBuilder() {
  const [step, setStep] = useState<Step>('hero');
  const [heroes, setHeroes] = useState<HeroOption[]>([]);
  const [allCards, setAllCards] = useState<CardPoolItem[]>([]);
  const [selectedHero, setSelectedHero] = useState<HeroOption | null>(null);
  const [selectedAspects, setSelectedAspects] = useState<string[]>([]);
  const [deck, setDeck] = useState<Map<string, DeckEntry>>(new Map());
  const [heroSearch, setHeroSearch] = useState('');
  const [cardSearch, setCardSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [deckName, setDeckName] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [modalCard, setModalCard] = useState<CardPoolItem | null>(null);

  useEffect(() => {
    const heroesEl = document.getElementById('heroes-data');
    const cardsEl = document.getElementById('cards-data');
    if (heroesEl?.dataset.heroes) setHeroes(JSON.parse(heroesEl.dataset.heroes));
    if (cardsEl?.dataset.cards) setAllCards(JSON.parse(cardsEl.dataset.cards));
  }, []);

  const isMultiAspect = !!selectedHero?.isMultiAspect;

  function selectHero(hero: HeroOption) {
    setSelectedHero(hero);
    setAiSuggestion('');
    setSaveStatus('idle');
    setDeckName('');

    // Pre-populate hero-specific cards at their deck limit
    const initialDeck = new Map<string, DeckEntry>();
    for (const card of allCards.filter(c => c.heroId === hero.id)) {
      initialDeck.set(card.id, { card, quantity: card.deckLimit });
    }
    setDeck(initialDeck);

    if (hero.id === WARLOCK_ID) {
      setSelectedAspects(ALL_ASPECTS);
      setStep('editor');
    } else {
      setSelectedAspects([]);
      setStep('aspect');
    }
  }

  function toggleAspect(aspect: string) {
    setSelectedAspects(prev => {
      if (prev.includes(aspect)) return prev.filter(a => a !== aspect);
      // Multi-aspect (Spider-Woman): exactly 2 — replace oldest when full
      if (isMultiAspect) return prev.length >= 2 ? [...prev.slice(1), aspect] : [...prev, aspect];
      // Single-aspect: replace
      return [aspect];
    });
  }

  const deckEntries = useMemo(() => Array.from(deck.values()), [deck]);

  const totalDeckSize = useMemo(
    () => deckEntries.reduce((sum, e) => sum + e.quantity, 0),
    [deckEntries],
  );

  const filteredPool = useMemo(() => {
    if (!selectedHero) return [];
    const activeAspects = new Set(['Basic', ...selectedAspects]);
    return allCards
      .filter(card => {
        if (card.heroId) return false; // hero-specific cards are pre-populated, not shown in pool
        return card.aspect ? activeAspects.has(card.aspect) : false;
      })
      .filter(card => (typeFilter === 'all' ? true : card.type === typeFilter))
      .filter(card => !cardSearch || card.name.toLowerCase().includes(cardSearch.toLowerCase()));
  }, [allCards, selectedHero, selectedAspects, cardSearch, typeFilter]);

  function addCard(card: CardPoolItem) {
    setDeck(prev => {
      const entry = prev.get(card.id);
      const currentQty = entry?.quantity ?? 0;
      const limit = card.isUnique ? 1 : card.deckLimit;
      if (currentQty >= limit) return prev;
      const currentTotal = Array.from(prev.values()).reduce((sum, e) => sum + e.quantity, 0);
      if (currentTotal >= 50) return prev;
      const next = new Map(prev);
      next.set(card.id, { card, quantity: currentQty + 1 });
      return next;
    });
  }

  function removeCard(cardId: string) {
    setDeck(prev => {
      const entry = prev.get(cardId);
      if (!entry) return prev;
      const next = new Map(prev);
      if (entry.quantity <= 1) next.delete(cardId);
      else next.set(cardId, { ...entry, quantity: entry.quantity - 1 });
      return next;
    });
  }

  async function handleAiSuggest() {
    if (!selectedHero) return;
    setAiLoading(true);
    setAiSuggestion('');

    const currentDeck = deckEntries.map(e => ({
      cardId: e.card.id,
      name: e.card.name,
      quantity: e.quantity,
    }));

    const cardPool = filteredPool.slice(0, 150).map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      aspect: c.aspect,
      cost: c.cost,
      traits: c.traits,
      text: c.text ? c.text.substring(0, 100) : null,
    }));

    try {
      const resp = await fetch('/api/builder/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          heroName: selectedHero.name,
          aspects: selectedAspects,
          currentDeck,
          cardPool,
        }),
      });

      if (!resp.ok || !resp.body) {
        setAiSuggestion('Failed to get suggestions. Please try again.');
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setAiSuggestion(prev => prev + decoder.decode(value));
      }
    } catch {
      setAiSuggestion('Error connecting to AI. Please try again.');
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSave() {
    if (!selectedHero || totalDeckSize === 0) return;
    setSaveStatus('saving');

    const name = deckName.trim() || `${selectedHero.name} — ${selectedAspects.join('/')}`;
    const cards = deckEntries.map(e => ({ cardId: e.card.id, quantity: e.quantity }));

    try {
      const resp = await fetch('/api/builder/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, heroCardId: selectedHero.id, aspects: selectedAspects, cards, isPublic: false }),
      });
      setSaveStatus(resp.ok ? 'saved' : 'error');
    } catch {
      setSaveStatus('error');
    }
  }

  // ── Step 1: Hero selection ────────────────────────────────────────────────

  if (step === 'hero') {
    const filteredHeroes = heroes.filter(
      h => !heroSearch || h.name.toLowerCase().includes(heroSearch.toLowerCase()),
    );
    return (
      <div>
        <h1 className="mb-1 text-3xl font-bold">Build a Deck</h1>
        <p className="mb-6 text-[var(--color-text-muted)]">Step 1 of 3 — Choose your hero</p>
        <input
          type="text"
          placeholder="Search heroes..."
          value={heroSearch}
          onChange={e => setHeroSearch(e.target.value)}
          className="mb-6 w-full max-w-sm rounded border border-white/10 bg-[var(--color-surface)] px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--color-secondary)]"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filteredHeroes.map(hero => {
            const primary =
              hero.identities.find(i => i.identityType.startsWith('hero')) || hero.identities[0];
            return (
              <button
                key={hero.id}
                onClick={() => selectHero(hero)}
                className="group flex flex-col overflow-hidden rounded-lg border border-white/10 bg-[var(--color-surface)] transition hover:border-[var(--color-primary)] hover:shadow-lg"
              >
                <div className="relative aspect-[63/88] w-full overflow-hidden bg-black/30">
                  {primary?.imageUrl ? (
                    <img
                      src={primary.imageUrl}
                      alt={hero.name}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-[var(--color-text-muted)]">
                      No Image
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-semibold">{hero.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">HP {hero.health}</p>
                  {hero.isMultiAspect && (
                    <span className="mt-1 inline-block rounded bg-blue-900/60 px-1.5 py-0.5 text-[10px] text-blue-300">
                      Multi-Aspect
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Step 2: Aspect selection ──────────────────────────────────────────────

  if (step === 'aspect') {
    return (
      <div className="mx-auto max-w-lg">
        <button
          onClick={() => setStep('hero')}
          className="mb-6 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          ← Back
        </button>
        <h1 className="mb-1 text-3xl font-bold">Build a Deck</h1>
        <p className="mb-1 text-[var(--color-text-muted)]">
          Step 2 of 3 — Choose your aspect{isMultiAspect ? 's' : ''}
        </p>
        <p className="mb-6 text-sm text-[var(--color-text-muted)]">
          Building with <strong className="text-[var(--color-text)]">{selectedHero?.name}</strong>.{' '}
          {isMultiAspect
            ? 'Pick 2 aspects — Basic is always included.'
            : 'Pick 1 aspect — Basic is always included.'}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ASPECTS.map(aspect => {
            const isSelected = selectedAspects.includes(aspect);
            return (
              <button
                key={aspect}
                onClick={() => toggleAspect(aspect)}
                className={`rounded-lg px-4 py-6 text-center font-semibold transition ${ASPECT_BG[aspect]} ${
                  isSelected
                    ? `scale-105 ring-2 ${ASPECT_RING[aspect]}`
                    : 'opacity-60 hover:opacity-90'
                }`}
              >
                {aspect}
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-sm text-[var(--color-text-muted)]">
          Selected: Basic{selectedAspects.length > 0 ? `, ${selectedAspects.join(', ')}` : ''}
        </p>
        <button
          onClick={() => setStep('editor')}
          disabled={selectedAspects.length !== (isMultiAspect ? 2 : 1)}
          className="mt-6 w-full rounded-lg bg-[var(--color-primary)] px-6 py-3 font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue to Deck Builder
        </button>
      </div>
    );
  }

  // ── Step 3: Editor ────────────────────────────────────────────────────────

  const heroSpecificEntries = deckEntries.filter(e => !!e.card.heroId);
  const nonHeroEntries = deckEntries.filter(e => !e.card.heroId);

  const nonHeroTotal = nonHeroEntries.reduce((s, e) => s + e.quantity, 0);
  const typeBreakdown = Object.entries(
    deckEntries.reduce<Record<string, number>>((acc, e) => {
      acc[e.card.type] = (acc[e.card.type] ?? 0) + e.quantity;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const COST_BUCKETS = [0, 1, 2, 3, 4, 5, 6] as const;
  const costBreakdown = COST_BUCKETS.reduce<Record<number, number>>((acc, b) => ({ ...acc, [b]: 0 }), {});
  for (const e of deckEntries) {
    if (e.card.cost === null) continue;
    const b = Math.min(e.card.cost, 6);
    costBreakdown[b] += e.quantity;
  }
  const maxCostCount = Math.max(...COST_BUCKETS.map(b => costBreakdown[b]), 1);

  const sortedPool = [...filteredPool].sort((a, b) => {
    const aInDeck = (deck.get(a.id)?.quantity ?? 0) > 0;
    const bInDeck = (deck.get(b.id)?.quantity ?? 0) > 0;
    if (aInDeck && !bInDeck) return -1;
    if (!aInDeck && bInDeck) return 1;
    if (a.heroId && !b.heroId) return -1;
    if (!a.heroId && b.heroId) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{selectedHero?.name}</h1>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className="rounded bg-gray-700 px-2 py-0.5 text-xs">Basic</span>
            {selectedAspects.map(a => (
              <span key={a} className={`rounded px-2 py-0.5 text-xs text-white ${ASPECT_BG[a]}`}>
                {a}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={() => setStep(selectedHero?.id === WARLOCK_ID ? 'hero' : 'aspect')}
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          {selectedHero?.id === WARLOCK_ID ? '← Change Hero' : '← Change Hero/Aspect'}
        </button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* ── Left: Card Pool ── */}
        <div className="flex flex-1 flex-col gap-3 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search cards..."
              value={cardSearch}
              onChange={e => setCardSearch(e.target.value)}
              className="flex-1 rounded border border-white/10 bg-[var(--color-surface)] px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[var(--color-secondary)]"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TYPE_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setTypeFilter(f.value)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                  typeFilter === f.value
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded border border-white/10">
            <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
              {sortedPool.length === 0 ? (
                <p className="p-4 text-center text-sm text-[var(--color-text-muted)]">
                  No cards found
                </p>
              ) : (
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col />
                    <col className="w-12" />
                    <col className="w-12" />
                    <col className="w-20" />
                  </colgroup>
                  <thead className="sticky top-0 bg-[var(--color-surface)] text-xs text-[var(--color-text-muted)]">
                    <tr>
                      <th className="px-3 py-2 text-left">Card</th>
                      <th className="px-2 py-2 text-center">Cost</th>
                      <th className="px-2 py-2 text-center">Owned</th>
                      <th className="px-2 py-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPool.map(card => {
                      const inDeck = deck.get(card.id)?.quantity ?? 0;
                      const limit = card.isUnique ? 1 : card.deckLimit;
                      const atLimit = inDeck >= limit;
                      const atDeckCap = totalDeckSize >= 50 && inDeck === 0;
                      return (
                        <tr key={card.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              {card.aspect && (
                                <span
                                  className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${ASPECT_DOT[card.aspect] ?? 'bg-gray-500'}`}
                                />
                              )}
                              <div>
                                <button
                                  onClick={() => setModalCard(card)}
                                  className={`hover:underline ${card.heroId ? 'text-yellow-300' : ''}`}
                                >
                                  {card.name}
                                </button>
                                {card.isUnique && (
                                  <span className="ml-1 text-xs text-[var(--color-text-muted)]">
                                    ★
                                  </span>
                                )}
                                <span
                                  className={`ml-1.5 rounded px-1 py-0.5 text-[10px] ${TYPE_BADGE[card.type] ?? 'bg-gray-800 text-gray-300'}`}
                                >
                                  {formatType(card.type)}
                                </span>
                              </div>
                            </div>
                            {card.traits && (
                              <p className="mt-0.5 pl-4 text-[10px] text-[var(--color-text-muted)]">
                                {card.traits}
                              </p>
                            )}
                          </td>
                          <td className="px-2 py-2 text-center text-xs text-[var(--color-text-muted)]">
                            {card.cost ?? '—'}
                          </td>
                          <td className="px-2 py-2 text-center text-xs">
                            {(() => {
                              const remaining = card.quantity - inDeck;
                              const cls = remaining === 0
                                ? 'text-red-400'
                                : remaining < card.quantity
                                  ? 'text-amber-400'
                                  : 'text-[var(--color-text-muted)]';
                              return <span className={cls}>{remaining}</span>;
                            })()}
                          </td>
                          <td className="px-2 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {inDeck > 0 && (
                                <button
                                  onClick={() => removeCard(card.id)}
                                  className="flex h-6 w-6 items-center justify-center rounded bg-white/10 hover:bg-white/20"
                                >
                                  −
                                </button>
                              )}
                              <span
                                className={`w-4 text-center text-xs ${inDeck > 0 ? 'font-bold text-[var(--color-primary)]' : ''}`}
                              >
                                {inDeck > 0 ? inDeck : ''}
                              </span>
                              <button
                                onClick={() => addCard(card)}
                                disabled={atLimit || atDeckCap}
                                className="flex h-6 w-6 items-center justify-center rounded bg-white/10 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                +
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: Deck Panel ── */}
        <div className="flex w-full flex-col gap-3 lg:w-80 lg:flex-shrink-0">
          {/* Deck stats */}
          <div className="rounded-lg border border-white/10 bg-[var(--color-surface)] p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">Deck</h2>
              <span
                className={`text-sm font-bold ${
                  totalDeckSize > 50
                    ? 'text-red-400'
                    : totalDeckSize >= 40
                      ? 'text-green-400'
                      : 'text-[var(--color-text-muted)]'
                }`}
              >
                {totalDeckSize}
              </span>
            </div>
            <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-all ${totalDeckSize > 50 ? 'bg-red-500' : totalDeckSize >= 40 ? 'bg-green-500' : 'bg-[var(--color-primary)]'}`}
                style={{ width: `${Math.min(100, (totalDeckSize / 40) * 100)}%` }}
              />
            </div>

            <div className="max-h-72 overflow-y-auto">
              {deckEntries.length === 0 ? (
                <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">
                  No cards added yet
                </p>
              ) : (
                <div className="space-y-1">
                  {heroSpecificEntries.length > 0 && (
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                      Hero Cards (Required)
                    </p>
                  )}
                  {heroSpecificEntries.map(e => (
                    <DeckRow key={e.card.id} entry={e} onAdd={addCard} onRemove={removeCard} onCardClick={setModalCard} isHero />
                  ))}
                  {heroSpecificEntries.length > 0 && nonHeroEntries.length > 0 && (
                    <hr className="my-1 border-white/10" />
                  )}
                  {nonHeroEntries.map(e => (
                    <DeckRow key={e.card.id} entry={e} onAdd={addCard} onRemove={removeCard} onCardClick={setModalCard} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Composition */}
          {nonHeroTotal > 0 && (
            <div className="rounded-lg border border-white/10 bg-[var(--color-surface)] p-4">
              <h2 className="mb-3 text-sm font-semibold">Composition</h2>

              {/* Segmented type bar */}
              <div className="mb-2 flex h-2 w-full overflow-hidden rounded-full">
                {typeBreakdown.map(([type, count]) => (
                  <div
                    key={type}
                    className={`h-full transition-all ${TYPE_COLOR[type] ?? 'bg-gray-500'}`}
                    style={{ width: `${(count / totalDeckSize) * 100}%` }}
                    title={`${formatType(type)}: ${count}`}
                  />
                ))}
              </div>

              {/* Type pills */}
              <div className="mb-4 flex flex-wrap gap-x-3 gap-y-1">
                {typeBreakdown.map(([type, count]) => (
                  <span key={type} className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                    <span className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${TYPE_COLOR[type] ?? 'bg-gray-500'}`} />
                    {formatType(type)} {count}
                  </span>
                ))}
              </div>

              {/* Cost curve */}
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Cost Curve</p>
              <div className="flex gap-1">
                {COST_BUCKETS.map(cost => {
                  const count = costBreakdown[cost];
                  const barPx = count > 0 ? Math.max(4, Math.round((count / maxCostCount) * 36)) : 0;
                  return (
                    <div key={cost} className="flex flex-1 flex-col items-center">
                      <span className={`mb-0.5 text-[9px] leading-none ${count > 0 ? '' : 'invisible'}`}>
                        {count}
                      </span>
                      <div className="flex h-9 w-full items-end">
                        <div
                          className="w-full rounded-t-sm bg-[var(--color-primary)] transition-all duration-300"
                          style={{ height: `${barPx}px` }}
                        />
                      </div>
                      <span className="mt-0.5 text-[9px] leading-none text-[var(--color-text-muted)]">
                        {cost === 6 ? '6+' : cost}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI Suggestions */}
          <div className="rounded-lg border border-white/10 bg-[var(--color-surface)] p-4">
            <h2 className="mb-3 font-semibold">AI Suggestions</h2>
            <button
              onClick={handleAiSuggest}
              disabled={aiLoading || totalDeckSize === 0}
              className="w-full rounded bg-[var(--color-secondary)] px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {aiLoading ? 'Thinking…' : 'Get AI Suggestions'}
            </button>
            {!aiSuggestion && !aiLoading && totalDeckSize === 0 && (
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                Add some cards to get suggestions
              </p>
            )}
            {aiSuggestion && (
              <div className="mt-3 max-h-56 overflow-y-auto rounded bg-black/30 p-3">
                <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-[var(--color-text-muted)]">
                  {aiSuggestion}
                </pre>
              </div>
            )}
          </div>

          {/* Save */}
          <div className="rounded-lg border border-white/10 bg-[var(--color-surface)] p-4">
            <h2 className="mb-3 font-semibold">Save Deck</h2>
            <input
              type="text"
              placeholder={`${selectedHero?.name} — ${selectedAspects.join('/')}`}
              value={deckName}
              onChange={e => setDeckName(e.target.value)}
              className="mb-3 w-full rounded border border-white/10 bg-black/30 px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[var(--color-secondary)]"
            />
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving' || totalDeckSize < 40 || totalDeckSize > 50}
              className="w-full rounded bg-[var(--color-primary)] px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved!' : 'Save Deck'}
            </button>
            {saveStatus === 'error' && (
              <p className="mt-2 text-xs text-red-400">Failed to save. Please try again.</p>
            )}
            {saveStatus === 'saved' && (
              <p className="mt-2 text-xs text-green-400">Deck saved successfully!</p>
            )}
          </div>
        </div>
      </div>
      <CardModal card={modalCard} onClose={() => setModalCard(null)} />
    </div>
  );
}

function DeckRow({
  entry,
  onAdd,
  onRemove,
  onCardClick,
  isHero = false,
}: {
  entry: DeckEntry;
  onAdd: (card: CardPoolItem) => void;
  onRemove: (id: string) => void;
  onCardClick: (card: CardPoolItem) => void;
  isHero?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-1 text-xs">
      <button
        onClick={() => onCardClick(entry.card)}
        className={`truncate text-left hover:underline ${isHero ? 'text-yellow-300' : ''}`}
      >
        {entry.card.name}
      </button>
      <div className="flex flex-shrink-0 items-center gap-1">
        {isHero ? (
          <span className="w-4 text-center font-bold text-yellow-300/60">{entry.quantity}</span>
        ) : (
          <>
            <button
              onClick={() => onRemove(entry.card.id)}
              className="text-white/40 hover:text-white/80"
            >
              −
            </button>
            <span className="w-4 text-center font-bold">{entry.quantity}</span>
            <button
              onClick={() => onAdd(entry.card)}
              className="text-white/40 hover:text-white/80"
            >
              +
            </button>
          </>
        )}
      </div>
    </div>
  );
}
