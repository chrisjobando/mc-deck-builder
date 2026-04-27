import { useEffect, useMemo, useRef, useState } from 'react';
import { COST_BUCKETS, formatType, TYPE_COLOR } from '../lib/cardFormatting';
import { heroSlug, WARLOCK_ID } from '../lib/utils';
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
  packCodes: string[];
}

interface DeckEntry {
  card: CardPoolItem;
  quantity: number;
}

interface SessionTeammate {
  userId: string;
  userName: string | null;
  userImage: string | null;
  heroName: string | null;
  heroImageUrl: string | null;
  aspects: string[];
  deckName: string | null;
}

interface SessionContext {
  code: string;
  name: string;
  collectionMode: 'single' | 'combined' | 'duplicates';
  teammates: SessionTeammate[];
  cardQuantities: Record<string, number>; // cardId -> total available qty
  teammateUniques: Record<string, string[]>; // cardId -> [userName, ...]
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


const ASPECT_TEXT_COLOR: Record<string, string> = {
  Aggression: 'text-red-400',
  Justice: 'text-yellow-400',
  Leadership: 'text-blue-400',
  Protection: 'text-green-400',
  Pool: 'text-pink-400',
  Basic: 'text-[var(--color-text-muted)]',
};


const ALL_ASPECTS = ['Aggression', 'Justice', 'Leadership', 'Protection'];

function serializeDeckCards(deck: Map<string, { quantity: number }>) {
  return [...deck.entries()].map(([id, e]) => ({ id, qty: e.quantity })).sort((a, b) => a.id.localeCompare(b.id));
}

const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'ally', label: 'Allies' },
  { value: 'event', label: 'Events' },
  { value: 'resource', label: 'Resources' },
  { value: 'player_side_scheme', label: 'Side Schemes' },
  { value: 'support', label: 'Supports' },
  { value: 'upgrade', label: 'Upgrades' },
];

const TYPE_ORDER = TYPE_FILTERS.slice(1).map(f => f.value);
const TYPE_LABEL = Object.fromEntries(TYPE_FILTERS.slice(1).map(f => [f.value, f.label]));

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
  const [deckName, setDeckName] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [modalCard, setModalCard] = useState<CardPoolItem | null>(null);
  const [heroSide, setHeroSide] = useState<'hero' | 'alter_ego'>('hero');
  const [editDeckId, setEditDeckId] = useState<string | null>(null);
  const [editOriginalSnapshot, setEditOriginalSnapshot] = useState<string | null>(null);
  const [ownedPacks, setOwnedPacks] = useState<Set<string>>(new Set());
  const [collectionOnly, setCollectionOnly] = useState(false);
  const [mobileTab, setMobileTab] = useState<'cards' | 'deck'>('cards');
  const [sessionContext, setSessionContext] = useState<SessionContext | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const cardPoolRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const heroesEl = document.getElementById('heroes-data');
    const cardsEl = document.getElementById('cards-data');
    const initialEl = document.getElementById('initial-state');

    const heroesData: HeroOption[] = heroesEl?.dataset.heroes ? JSON.parse(heroesEl.dataset.heroes) : [];
    const cardsData: CardPoolItem[] = cardsEl?.dataset.cards ? JSON.parse(cardsEl.dataset.cards) : [];

    setHeroes(heroesData);
    setAllCards(cardsData);

    const collectionEl = document.getElementById('collection-data');
    const ownedData: string[] = collectionEl?.dataset.owned ? JSON.parse(collectionEl.dataset.owned) : [];
    setOwnedPacks(new Set(ownedData));
    if (collectionEl?.dataset.hasCollection === 'true') setCollectionOnly(true);

    // Read session context if present
    const sessionEl = document.getElementById('session-context');
    const sessionCode = initialEl?.dataset.sessionCode;
    if (sessionEl && sessionCode) {
      const sessionName = sessionEl.dataset.sessionName ?? '';
      const collectionMode = (sessionEl.dataset.collectionMode ?? 'combined') as SessionContext['collectionMode'];
      const teammates: SessionTeammate[] = sessionEl.dataset.teammates ? JSON.parse(sessionEl.dataset.teammates) : [];
      const cardQuantities: Record<string, number> = sessionEl.dataset.cardQuantities ? JSON.parse(sessionEl.dataset.cardQuantities) : {};
      const teammateUniques: Record<string, string[]> = sessionEl.dataset.teammateUniques ? JSON.parse(sessionEl.dataset.teammateUniques) : {};
      
      setSessionContext({
        code: sessionCode,
        name: sessionName,
        collectionMode,
        teammates,
        cardQuantities,
        teammateUniques,
      });
      
      // In session mode, always filter by collection
      setCollectionOnly(true);
    }

    const initialStep = (initialEl?.dataset.step as Step) ?? 'hero';
    setStep(initialStep);

    const initialHeroId = initialEl?.dataset.heroId;
    if (initialHeroId) {
      const hero = heroesData.find(h => h.id === initialHeroId);
      if (hero) {
        setSelectedHero(hero);

        const initialDeck = new Map<string, DeckEntry>();
        const savedCardsJson = initialEl?.dataset.editDeckCards;
        if (savedCardsJson) {
          // Editing an existing deck — restore saved card quantities
          const savedCards: { cardId: string; quantity: number }[] = JSON.parse(savedCardsJson);
          const cardById = new Map(cardsData.map(c => [c.id, c]));
          for (const { cardId, quantity } of savedCards) {
            const card = cardById.get(cardId);
            if (card) initialDeck.set(card.id, { card, quantity });
          }
        } else {
          // New deck — pre-populate hero-specific cards at their deck limit
          for (const card of cardsData.filter(c => c.heroId === initialHeroId)) {
            initialDeck.set(card.id, { card, quantity: card.deckLimit });
          }
        }
        setDeck(initialDeck);

        const editId = initialEl?.dataset.editDeckId;
        if (editId) {
          setEditDeckId(editId);
          const editName = initialEl?.dataset.editDeckName ?? '';
          setDeckName(editName);
          const snapshot = JSON.stringify({ name: editName, cards: serializeDeckCards(initialDeck) });
          setEditOriginalSnapshot(snapshot);
        } else {
          const editName = initialEl?.dataset.editDeckName;
          if (editName) setDeckName(editName);
        }

        const aspectsStr = initialEl?.dataset.aspects;
        if (aspectsStr) {
          const aspects = aspectsStr.split(',').map(a => a.charAt(0).toUpperCase() + a.slice(1));
          setSelectedAspects(aspects);
        }
      }
    }
  }, []);

  useEffect(() => {
    setTypeFilter('all');
  }, [selectedAspects]);

  useEffect(() => {
    cardPoolRef.current?.scrollTo({ top: 0 });
  }, [typeFilter, cardSearch]);

  const isMultiAspect = !!selectedHero?.isMultiAspect;

  const hasChanges = useMemo(() => {
    if (!editDeckId || !editOriginalSnapshot) return true;
    const current = JSON.stringify({
      name: deckName.trim() || `${selectedHero?.name ?? ''} — ${selectedAspects.join('/')}`,
      cards: serializeDeckCards(deck),
    });
    return current !== editOriginalSnapshot;
  }, [editDeckId, editOriginalSnapshot, deckName, deck, selectedHero, selectedAspects]);

  function selectHero(hero: HeroOption) {
    const slug = heroSlug(hero.name, hero.id);
    if (hero.id === WARLOCK_ID) {
      const aspectsParam = [...ALL_ASPECTS].map(a => a.toLowerCase()).sort().join(',');
      window.location.href = `/builder/${slug}/${aspectsParam}`;
    } else {
      window.location.href = `/builder/${slug}`;
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

  const filteredHeroes = useMemo(() =>
    heroes
      .filter(h => !collectionOnly || (h.packCode ? ownedPacks.has(h.packCode) : false))
      .filter(h => !heroSearch || h.name.toLowerCase().includes(heroSearch.toLowerCase())),
    [heroes, collectionOnly, ownedPacks, heroSearch],
  );

  const totalDeckSize = useMemo(
    () => deckEntries.reduce((sum, e) => sum + e.quantity, 0),
    [deckEntries],
  );

  const filteredPool = useMemo(() => {
    if (!selectedHero) return [];
    const activeAspects = new Set(['Basic', ...selectedAspects]);
    return allCards
      .filter(card => {
        if (card.heroId) return false;
        return card.aspect ? activeAspects.has(card.aspect) : false;
      })
      .filter(card => !collectionOnly || card.packCodes.some(c => ownedPacks.has(c)))
      .filter(card => typeFilter === 'all' || card.type === typeFilter)
      .filter(card => !cardSearch || card.name.toLowerCase().includes(cardSearch.toLowerCase()));
  }, [allCards, selectedHero, selectedAspects, cardSearch, typeFilter, collectionOnly, ownedPacks]);

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

  // Get effective card quantity considering session duplicates mode
  function getEffectiveQuantity(card: CardPoolItem): number {
    if (sessionContext?.collectionMode === 'duplicates' && sessionContext.cardQuantities[card.id]) {
      return sessionContext.cardQuantities[card.id];
    }
    return card.quantity;
  }

  // Check if a unique card is claimed by a teammate
  function isClaimedByTeammate(card: CardPoolItem): string[] | null {
    if (!card.isUnique || !sessionContext) return null;
    return sessionContext.teammateUniques[card.id] ?? null;
  }

  async function doSave(asNew = false) {
    if (!selectedHero || totalDeckSize === 0) return;
    setSaveStatus('saving');
    const name = deckName.trim() || `${selectedHero.name} — ${selectedAspects.join('/')}`;
    const cards = deckEntries.map(e => ({ cardId: e.card.id, quantity: e.quantity }));
    
    try {
      let resp: Response;
      
      if (sessionContext) {
        // Session mode: use session-aware save endpoint
        resp = await fetch(`/api/sessions/${sessionContext.code}/save-deck`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, cards }),
        });
      } else if (!asNew && editDeckId) {
        // Editing existing deck
        resp = await fetch(`/api/decks/${editDeckId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, aspects: selectedAspects, cards }),
        });
      } else {
        // Creating new deck
        resp = await fetch('/api/builder/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, heroCardId: selectedHero.id, aspects: selectedAspects, cards, isPublic: false }),
        });
      }
      
      setSaveStatus(resp.ok ? 'saved' : 'error');
    } catch {
      setSaveStatus('error');
    }
  }

  async function requestAiSuggestions() {
    if (!selectedHero || aiLoading) return;
    
    setAiLoading(true);
    setAiSuggestions('');
    setAiPanelOpen(true);
    
    try {
      // Prepare hero-specific cards
      const heroCards = deckEntries
        .filter(e => e.card.heroId === selectedHero.id)
        .map(e => ({
          cardId: e.card.id,
          name: e.card.name,
          quantity: e.quantity,
          type: e.card.type,
          cost: e.card.cost,
        }));
      
      // Prepare non-hero deck cards
      const currentDeck = deckEntries
        .filter(e => !e.card.heroId)
        .map(e => ({
          cardId: e.card.id,
          name: e.card.name,
          quantity: e.quantity,
          type: e.card.type,
          cost: e.card.cost,
          aspect: e.card.aspect,
        }));
      
      // Prepare available card pool
      const cardPool = filteredPool.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        aspect: c.aspect,
        cost: c.cost,
        traits: c.traits,
        text: c.text,
        isUnique: c.isUnique,
        attack: c.attack,
        thwart: c.thwart,
        health: c.health,
        resourceEnergy: c.resourceEnergy,
        resourceMental: c.resourceMental,
        resourcePhysical: c.resourcePhysical,
        resourceWild: c.resourceWild,
      }));
      
      const resp = await fetch('/api/builder/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          heroName: selectedHero.name,
          aspects: selectedAspects,
          currentDeck,
          cardPool,
          heroCards,
          isMultiAspect: selectedHero.isMultiAspect,
        }),
      });
      
      if (!resp.ok) {
        setAiSuggestions('Failed to get suggestions. Please try again.');
        setAiLoading(false);
        return;
      }
      
      const reader = resp.body?.getReader();
      if (!reader) {
        setAiSuggestions('Failed to read response.');
        setAiLoading(false);
        return;
      }
      
      const decoder = new TextDecoder();
      let text = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setAiSuggestions(text);
      }
      // Flush any remaining bytes
      text += decoder.decode();
      setAiSuggestions(text);
    } catch (err) {
      setAiSuggestions('Error getting suggestions. Please try again.');
    } finally {
      setAiLoading(false);
    }
  }

  // ── Step 1: Hero selection ────────────────────────────────────────────────

  if (step === 'hero') {
    return (
      <div>
        <h1 className="mb-1 text-3xl font-bold">Build a Deck</h1>
        <p className="mb-6 text-[var(--color-text-muted)]">Step 1 of 3 — Choose your hero</p>
        <div className="mb-6 flex items-center gap-3">
          <input
            type="text"
            placeholder="Search heroes..."
            value={heroSearch}
            onChange={e => setHeroSearch(e.target.value)}
            className="w-full max-w-sm rounded border border-white/10 bg-[var(--color-surface)] px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--color-secondary)]"
          />
          <OwnedOnlyButton active={collectionOnly} onClick={() => setCollectionOnly(v => !v)} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filteredHeroes.map(hero => {
            const primary =
              hero.identities.find(i => i.identityType.startsWith('hero')) || hero.identities[0];
            const alterEgo = hero.identities.find(i => i.identityType === 'alter_ego');
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
                  {alterEgo && (
                    <p className="truncate text-[10px] text-[var(--color-text-muted)]">{alterEgo.name}</p>
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
    const ownsDeadpool = ownedPacks.has('deadpool');
    const visibleAspects = ASPECTS.filter(a => a !== 'Pool' || !collectionOnly || ownsDeadpool);
    return (
      <div className="mx-auto max-w-lg">
        <button
          onClick={() => { window.location.href = '/builder'; }}
          className="mb-6 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          ← Back
        </button>
        <h1 className="mb-1 text-3xl font-bold">Build a Deck</h1>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[var(--color-text-muted)]">
            Step 2 of 3 — Choose your aspect{isMultiAspect ? 's' : ''}
          </p>
          <OwnedOnlyButton active={collectionOnly} onClick={() => setCollectionOnly(v => !v)} />
        </div>
        <p className="mb-6 text-sm text-[var(--color-text-muted)]">
          Building with <strong className="text-[var(--color-text)]">{selectedHero?.name}</strong>.{' '}
          {isMultiAspect
            ? 'Pick 2 aspects — Basic is always included.'
            : 'Pick 1 aspect — Basic is always included.'}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visibleAspects.map(aspect => {
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
          onClick={() => {
            if (!selectedHero) return;
            const slug = heroSlug(selectedHero.name, selectedHero.id);
            const aspectsParam = [...selectedAspects].map(a => a.toLowerCase()).sort().join(',');
            window.location.href = `/builder/${slug}/${aspectsParam}`;
          }}
          disabled={selectedAspects.length !== (isMultiAspect ? 2 : 1)}
          className="mt-6 w-full rounded-lg bg-[var(--color-primary)] px-6 py-3 font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue to Deck Builder
        </button>
      </div>
    );
  }

  // ── Step 3: Editor ────────────────────────────────────────────────────────

  const saveLabel =
    saveStatus === 'saving' ? 'Saving…' :
    saveStatus === 'saved' ? (editDeckId ? 'Updated!' : 'Saved!') :
    editDeckId ? 'Update Deck' : 'Save Deck';

  const typeBreakdown = Object.entries(
    deckEntries.reduce<Record<string, number>>((acc, e) => {
      acc[e.card.type] = (acc[e.card.type] ?? 0) + e.quantity;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

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
      {/* Session Header */}
      {sessionContext && (
        <div className="mb-4">
          <a 
            href={`/sessions/${sessionContext.code}`} 
            className="text-sm text-[var(--color-text-muted)] hover:text-white"
          >
            ← Back to {sessionContext.name}
          </a>
        </div>
      )}
      
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
        {!sessionContext && (
          <button
            onClick={() => {
              window.location.href = selectedHero?.id === WARLOCK_ID
                ? '/builder'
                : `/builder/${heroSlug(selectedHero!.name, selectedHero!.id)}`;
            }}
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            {selectedHero?.id === WARLOCK_ID ? '← Change Hero' : '← Change Hero/Aspect'}
          </button>
        )}
      </div>

      {/* Teammates Panel (Session Mode) */}
      {sessionContext && sessionContext.teammates.length > 0 && (
        <div className="mb-4 rounded-lg border border-white/10 bg-[var(--color-surface)] p-4">
          <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-muted)]">
            Teammates
          </h3>
          <div className="flex flex-wrap gap-3">
            {sessionContext.teammates.map((t) => (
              <div key={t.userId} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                {t.userImage ? (
                  <img src={t.userImage} alt={t.userName ?? ''} className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold uppercase">
                    {(t.userName ?? '?')[0]}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{t.userName}</span>
                    {t.aspects.map(a => (
                      <span key={a} className={`rounded px-1 py-0.5 text-[10px] text-white ${ASPECT_BG[a] ?? 'bg-gray-700'}`}>
                        {a[0]}
                      </span>
                    ))}
                  </div>
                  <div className="truncate text-xs text-[var(--color-text-muted)]">
                    {t.heroName}
                    {t.deckName && <span className="ml-1 text-green-400">✓</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {sessionContext.collectionMode !== 'single' && (
            <p className="mt-2 text-[10px] text-[var(--color-text-muted)]">
              Collection: {sessionContext.collectionMode === 'combined' ? 'Union of all players' : 'Summed duplicates'}
            </p>
          )}
        </div>
      )}

      <div className="mb-3 flex rounded-lg border border-white/10 lg:hidden">
        <button
          onClick={() => setMobileTab('cards')}
          className={`flex-1 rounded-l-lg py-3 text-sm font-medium transition ${mobileTab === 'cards' ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-surface)]'}`}
        >
          Cards
        </button>
        <button
          onClick={() => setMobileTab('deck')}
          className={`flex-1 rounded-r-lg py-3 text-sm font-medium transition ${mobileTab === 'deck' ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-surface)]'}`}
        >
          Deck ({totalDeckSize} / 40)
        </button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        {/* ── Left: Card Pool ── */}
        <div className={`${mobileTab === 'deck' ? 'hidden lg:flex' : 'flex'} min-w-0 flex-col gap-3`} style={{ flex: '0 1 56rem' }}>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search cards..."
              value={cardSearch}
              onChange={e => setCardSearch(e.target.value)}
              className="flex-1 rounded border border-white/10 bg-[var(--color-surface)] px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[var(--color-secondary)]"
            />
            <OwnedOnlyButton active={collectionOnly} onClick={() => setCollectionOnly(v => !v)} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex flex-wrap gap-1.5">
              {TYPE_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setTypeFilter(f.value)}
                  className={`rounded px-2.5 py-1.5 text-xs font-medium transition ${
                    typeFilter === f.value
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-[var(--color-text-muted)]">
              {sortedPool.length} card{sortedPool.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="overflow-hidden rounded border border-white/10">
            <div ref={cardPoolRef} className="max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
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
                      <th className="px-2 py-2 text-center">Left</th>
                      <th className="px-2 py-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPool.map(card => {
                      const inDeck = deck.get(card.id)?.quantity ?? 0;
                      const effectiveQty = getEffectiveQuantity(card);
                      const limit = card.isUnique ? 1 : card.deckLimit;
                      const atLimit = inDeck >= limit;
                      const atDeckCap = totalDeckSize >= 50 && inDeck === 0;
                      const claimedBy = isClaimedByTeammate(card);
                      const isBlocked = claimedBy && claimedBy.length > 0 && inDeck === 0;
                      return (
                        <tr key={card.id} className={`border-t border-white/5 ${inDeck > 0 ? 'bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/15' : isBlocked ? 'bg-red-500/5' : 'hover:bg-white/[0.03]'}`}>
                          <td className={`py-2 ${inDeck > 0 ? 'border-l-2 border-[var(--color-primary)] pl-[10px] pr-3' : 'px-3'}`}>
                            <div className="flex items-center gap-2">
                              {card.aspect && (
                                <span
                                  className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${ASPECT_DOT[card.aspect] ?? 'bg-gray-500'}`}
                                />
                              )}
                              <div>
                                <button
                                  onClick={() => setModalCard(card)}
                                  className={`hover:underline ${card.heroId ? 'text-yellow-300' : ''} ${isBlocked ? 'text-red-300' : ''}`}
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
                                {claimedBy && claimedBy.length > 0 && (
                                  <span className="ml-1.5 text-[10px] text-red-400" title={`Used by ${claimedBy.join(', ')}`}>
                                    ({claimedBy.join(', ')})
                                  </span>
                                )}
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
                              const remaining = effectiveQty - inDeck;
                              const cls = remaining === 0
                                ? 'text-red-400'
                                : remaining < effectiveQty
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
                                  className="flex h-7 w-7 items-center justify-center rounded bg-white/10 hover:bg-white/20"
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
                                disabled={atLimit || atDeckCap || !!isBlocked}
                                title={isBlocked ? `Used by ${claimedBy?.join(', ')}` : undefined}
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

          {/* Composition */}
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
                    <span className={`mb-0.5 text-[10px] leading-none ${count > 0 ? '' : 'invisible'}`}>
                      {count}
                    </span>
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

        {/* ── Right: Deck Panel ── */}
        <div className={`${mobileTab === 'cards' ? 'hidden lg:flex' : 'flex'} w-full flex-col gap-3 lg:w-96 lg:flex-shrink-0`}>
          {/* Hero card */}
          {selectedHero && (() => {
            const shownIdentity = selectedHero.identities.find(i =>
              heroSide === 'alter_ego' ? i.identityType === 'alter_ego' : i.identityType.startsWith('hero')
            ) ?? selectedHero.identities[0];
            const hasAlterEgo = selectedHero.identities.some(i => i.identityType === 'alter_ego');
            return (
              <div className="overflow-hidden rounded-lg border border-white/10">
                <div className="relative aspect-[63/88] w-full bg-black/30">
                  {shownIdentity?.imageUrl ? (
                    <img src={shownIdentity.imageUrl} alt={shownIdentity.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-[var(--color-text-muted)]">No Image</div>
                  )}
                </div>
                {hasAlterEgo && (
                  <button
                    onClick={() => setHeroSide(s => s === 'hero' ? 'alter_ego' : 'hero')}
                    className="w-full bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text-muted)] transition hover:bg-white/5 hover:text-[var(--color-text)]"
                  >
                    {heroSide === 'hero' ? `Flip to Alter Ego →` : `← Flip to Hero`}
                  </button>
                )}
              </div>
            );
          })()}
          {/* Deck stats */}
          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-white/10 bg-[var(--color-surface)] p-4">
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

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {deckEntries.length === 0 ? (
                <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">
                  No cards added yet
                </p>
              ) : (
                <div className="space-y-2">
                  {TYPE_ORDER.filter(type => deckEntries.some(e => e.card.type === type)).map(type => (
                    <div key={type}>
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                        {TYPE_LABEL[type]}
                      </p>
                      {deckEntries.filter(e => e.card.type === type).map(e => (
                        <DeckRow key={e.card.id} entry={e} onAdd={addCard} onRemove={removeCard} onCardClick={setModalCard} />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Save */}
          <div className="rounded-lg border border-white/10 bg-[var(--color-surface)] p-4">
            <h2 className="mb-3 font-semibold">
              {sessionContext ? 'Save to Session' : editDeckId ? 'Update Deck' : 'Save Deck'}
            </h2>
            <input
              type="text"
              placeholder={`${selectedHero?.name} — ${selectedAspects.join('/')}`}
              value={deckName}
              onChange={e => setDeckName(e.target.value)}
              className="mb-3 w-full rounded border border-white/10 bg-black/30 px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[var(--color-secondary)]"
            />
            <button
              onClick={() => doSave()}
              disabled={saveStatus === 'saving' || totalDeckSize < 40 || totalDeckSize > 50 || (!sessionContext && !hasChanges)}
              className="w-full rounded bg-[var(--color-primary)] px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved!' : sessionContext ? 'Save Deck' : saveLabel}
            </button>
            {editDeckId && !sessionContext && (
              <button
                onClick={() => doSave(true)}
                disabled={saveStatus === 'saving' || totalDeckSize < 40 || totalDeckSize > 50}
                className="mt-2 w-full rounded border border-white/10 px-4 py-2 text-sm font-medium text-[var(--color-text-muted)] transition hover:border-white/20 hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save as New Deck
              </button>
            )}
            {saveStatus === 'error' && (
              <p className="mt-2 text-xs text-red-400">Failed to save. Please try again.</p>
            )}
            {saveStatus === 'saved' && (
              <p className="mt-2 text-xs text-green-400">
                {sessionContext ? 'Deck saved to session!' : editDeckId ? 'Deck updated!' : 'Deck saved!'}
              </p>
            )}
          </div>

        </div>
      </div>
      <CardModal card={modalCard} onClose={() => setModalCard(null)} />
      
      {/* Floating AI Button */}
      <button
        onClick={() => aiPanelOpen ? setAiPanelOpen(false) : requestAiSuggestions()}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-2xl shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95"
        title="AI Suggestions"
      >
        ✨
      </button>
      
      {/* AI Panel Overlay */}
      {aiPanelOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setAiPanelOpen(false)}
          />
          
          {/* Slide-out Panel */}
          <div className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col border-l border-white/10 bg-[var(--color-bg)] shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <span>✨</span>
                AI Suggestions
              </h2>
              <button
                onClick={() => setAiPanelOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-muted)] transition hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {aiLoading && !aiSuggestions && (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <span className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-[var(--color-primary)] border-t-transparent" />
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Analyzing your deck...
                  </p>
                </div>
              )}
              {aiSuggestions && (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {aiSuggestions}
                </div>
              )}
              {!aiLoading && !aiSuggestions && (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Click refresh to get AI-powered deck suggestions.
                  </p>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="border-t border-white/10 p-4">
              <button
                onClick={requestAiSuggestions}
                disabled={aiLoading}
                className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-sm font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {aiLoading ? 'Analyzing...' : aiSuggestions ? 'Refresh Suggestions' : 'Get Suggestions'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DeckRow({
  entry,
  onAdd,
  onRemove,
  onCardClick,
}: {
  entry: DeckEntry;
  onAdd: (card: CardPoolItem) => void;
  onRemove: (id: string) => void;
  onCardClick: (card: CardPoolItem) => void;
}) {
  const isHero = !!entry.card.heroId;
  const nameColor = isHero
    ? 'text-white'
    : (ASPECT_TEXT_COLOR[entry.card.aspect ?? ''] ?? '');
  return (
    <div className="group flex items-center gap-1.5 text-xs">
      <span className={`w-3 flex-shrink-0 text-right font-bold ${isHero ? 'text-white/50' : 'text-[var(--color-text-muted)]'}`}>
        {entry.quantity}
      </span>
      <button
        onClick={() => onCardClick(entry.card)}
        className={`min-w-0 flex-1 truncate text-left hover:underline ${nameColor}`}
      >
        {entry.card.name}
      </button>
      {!isHero && (
        <div className="flex flex-shrink-0 items-center gap-0.5 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
          <button
            onClick={() => onRemove(entry.card.id)}
            className="flex h-5 w-5 items-center justify-center rounded text-white/50 hover:bg-white/10 hover:text-white"
          >
            −
          </button>
          <button
            onClick={() => onAdd(entry.card)}
            className="flex h-5 w-5 items-center justify-center rounded text-white/50 hover:bg-white/10 hover:text-white"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

function OwnedOnlyButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded px-2.5 py-1.5 text-xs font-medium transition hover:opacity-90 ${active ? 'bg-[var(--color-primary)]' : 'bg-white/10'}`}
    >
      Owned only
    </button>
  );
}
