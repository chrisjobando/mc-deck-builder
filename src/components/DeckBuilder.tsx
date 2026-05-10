import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AspectBadge, AspectButton, CardTypeBadge, DeckProgress } from '@/components/ui/marvel';
import { COST_BUCKETS, formatType } from '@/lib/cardFormatting';
import { heroSlug, WARLOCK_ID } from '@/lib/utils';
import CardModal from './CardModal';

// Markdown + card text formatting for AI responses
function formatAiResponse(text: string): string {
  return text
    // Apply card text formatting first (handles [[bold]], [energy], [wild], etc.)
    .replace(/\[\[([^\]]+)\]\]/g, '<strong class="uppercase">$1</strong>')
    .replace(/\[star\]/g, '<span class="marvel-glyph">S</span>')
    .replace(/\[wild\]/g, '<span class="marvel-glyph">w</span>')
    .replace(/\[energy\]/g, '<span class="marvel-glyph">e</span>')
    .replace(/\[mental\]/g, '<span class="marvel-glyph">m</span>')
    .replace(/\[physical\]/g, '<span class="marvel-glyph">p</span>')
    .replace(/→/g, '<span class="marvel-glyph">E</span>')
    // Convert **text** to <strong> (markdown style)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Convert bullet points (•, -, *)
    .replace(/^[•\-\*] (.+)$/gm, '<li class="ml-4">$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, (match) => `<ul class="list-disc my-2">${match}</ul>`)
    // Convert double newlines to paragraph breaks
    .replace(/\n\n+/g, '</p><p class="my-3">')
    // Convert single newlines to <br>
    .replace(/\n/g, '<br/>')
    // Wrap in initial paragraph
    .replace(/^/, '<p class="my-3">')
    .replace(/$/, '</p>')
    // Clean up
    .replace(/<p class="my-3"><\/p>/g, '')
    .replace(/<p class="my-3"><br\/>/g, '<p class="my-3">');
}

interface HeroIdentity {
  identityType: string;
  imageUrl: string | null;
  name: string;
  attack: number | null;
  thwart: number | null;
  defense: number | null;
  handSize: number | null;
  recover: number | null;
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
  setPosition: number | null;
  packs: string[];
  packCodes: string[];
  allIds?: string[]; // All MarvelCDB card IDs that map to this card (for import)
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






const ALL_ASPECTS = ['Aggression', 'Justice', 'Leadership', 'Protection'];

function serializeDeckCards(deck: Map<string, { quantity: number }>) {
  return [...deck.entries()].map(([id, e]) => ({ id, qty: e.quantity })).sort((a, b) => a.id.localeCompare(b.id));
}

function sortedIdentities(hero: HeroOption): HeroIdentity[] {
  return [...hero.identities].sort((a, b) => {
    if (a.identityType === 'alter_ego') return 1;
    if (b.identityType === 'alter_ego') return -1;
    return a.identityType.localeCompare(b.identityType);
  });
}

function identityLabel(identityType: string): string {
  if (identityType === 'alter_ego') return 'Alter Ego';
  if (identityType === 'hero') return 'Hero';
  if (identityType.startsWith('hero_')) return `Hero ${identityType.replace('hero_', '')}`;
  return identityType;
}

function getHeroIdentity(hero: HeroOption): HeroIdentity {
  return hero.identities.find(i => i.identityType.startsWith('hero')) ?? hero.identities[0];
}

function getAspectRecommendations(hero: HeroOption): Record<string, { score: number; reason: string }> {
  const id = getHeroIdentity(hero);
  const atk = id?.attack ?? 0;
  const thw = id?.thwart ?? 0;
  const def = id?.defense ?? 0;
  const hp  = hero.health;

  const recs: Record<string, { score: number; reason: string }> = {
    Aggression: { score: 0, reason: 'Amplifies direct damage output' },
    Justice:    { score: 0, reason: 'Boosts threat removal and control' },
    Leadership: { score: 0, reason: 'Provides ally and resource support' },
    Protection: { score: 0, reason: 'Adds defense and survivability' },
    Pool:       { score: 0, reason: 'Hybrid damage and chaos effects' },
  };

  if (atk >= 3) recs.Aggression.score += 2;
  if (atk >= 2) recs.Aggression.score += 1;
  if (thw <= 1) recs.Aggression.score += 1;
  if (atk >= 3) recs.Aggression.reason = 'Ideal for high-attack heroes';

  if (thw >= 2) recs.Justice.score += 2;
  if (thw >= 3) recs.Justice.score += 1;
  if (atk <= 1) recs.Justice.score += 1;
  if (thw >= 3) recs.Justice.reason = 'Great for strong thwarters';

  if (atk >= 2 && thw >= 2) recs.Leadership.score += 2;
  if (atk >= 1 && thw >= 1) recs.Leadership.score += 1;

  if (def <= 1) recs.Protection.score += 2;
  if (hp <= 10) recs.Protection.score += 2;
  if (hp >= 13) recs.Protection.score -= 1;
  if (def <= 1 || hp <= 10) recs.Protection.reason = 'Compensates for low defense/HP';

  if (atk >= 3) recs.Pool.score += 1;
  if (thw <= 1) recs.Pool.score += 1;

  return recs;
}

interface CurveSummary {
  label: string;
  color: string;
  bgColor: string;
  warning?: string;
}

function getCurveSummary(costBreakdown: Record<number, number>): CurveSummary {
  const { totalCosted, weightedSum } = [1, 2, 3, 4].reduce(
    (acc, b) => { const n = costBreakdown[b] ?? 0; return { totalCosted: acc.totalCosted + n, weightedSum: acc.weightedSum + b * n }; },
    { totalCosted: 0, weightedSum: 0 },
  );
  if (totalCosted === 0) return { label: 'No costed cards', color: 'text-gray-400', bgColor: 'bg-white/5' };

  const avg = weightedSum / totalCosted;
  const heavyPct = ((costBreakdown[3] ?? 0) + (costBreakdown[4] ?? 0)) / totalCosted;
  const warning = heavyPct > 0.4 ? 'Consider adding cheaper cards' : undefined;

  if (avg < 2.0) return { label: 'Efficient curve', color: 'text-green-400', bgColor: 'bg-green-900/20', warning };
  if (avg <= 3.0) return { label: 'Balanced curve', color: 'text-blue-400', bgColor: 'bg-blue-900/20', warning };
  return { label: 'Heavy curve', color: 'text-orange-400', bgColor: 'bg-orange-900/20', warning: warning ?? 'Many expensive cards' };
}

interface HeroSummary {
  strengths: string[];
  weaknesses: string[];
  pairsSuggestion: string;
}

function getHeroStrengthsWeaknesses(hero: HeroOption): HeroSummary {
  const id = getHeroIdentity(hero);
  const atk  = id?.attack   ?? 0;
  const thw  = id?.thwart   ?? 0;
  const def  = id?.defense  ?? 0;
  const rec  = id?.recover  ?? 0;
  const hand = id?.handSize ?? 0;
  const hp   = hero.health;

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (atk >= 3)  strengths.push('High damage');
  if (thw >= 3)  strengths.push('Strong thwarter');
  if (def >= 2)  strengths.push('Tanky defense');
  if (rec >= 3)  strengths.push('Good recovery');
  if (hp >= 12)  strengths.push('High health pool');
  if (hand >= 6) strengths.push('Large hand size');

  if (atk <= 1)  weaknesses.push('Weak attacker');
  if (thw <= 1)  weaknesses.push('Poor thwarter');
  if (def <= 0)  weaknesses.push('Fragile defense');
  if (rec <= 2)  weaknesses.push('Slow recovery');
  if (hp <= 9)   weaknesses.push('Low health pool');

  let pairsSuggestion = 'Flexible — works with any aspect';
  if (atk >= 3 && thw < 3) pairsSuggestion = 'Pairs well with Aggression or Pool';
  else if (thw >= 3 && atk < 3) pairsSuggestion = 'Pairs well with Justice or Leadership';
  else if (def <= 1 || hp <= 10) pairsSuggestion = 'Pairs well with Protection';

  return { strengths, weaknesses, pairsSuggestion };
}

const SUGGESTION_PILLS = [
  { label: 'Suggest swaps', focus: null },
  { label: 'Find combos',   focus: 'combos' },
  { label: 'Optimize curve', focus: 'curve' },
  { label: 'Fill to 40',    focus: 'fill',  showIf: (n: number) => n < 40 },
  { label: 'Cut to 40',     focus: 'cut',   showIf: (n: number) => n > 50 },
] as const;

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
  const [heroIdentityIndex, setHeroIdentityIndex] = useState(0);
  const [editDeckId, setEditDeckId] = useState<string | null>(null);
  const [editOriginalSnapshot, setEditOriginalSnapshot] = useState<string | null>(null);
  const [ownedPacks, setOwnedPacks] = useState<Set<string>>(new Set());
  const [collectionOnly, setCollectionOnly] = useState(false);
  const [mobileTab, setMobileTab] = useState<'cards' | 'deck'>('cards');
  const [sessionContext, setSessionContext] = useState<SessionContext | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [activePromptFocus, setActivePromptFocus] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importInput, setImportInput] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importConfirm, setImportConfirm] = useState<{
    deckName: string;
    heroName: string;
    heroCode: string;
    aspects: string[];
    slots: Record<string, number>;
    mismatch: 'hero' | 'aspect' | 'both' | null;
  } | null>(null);
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
        setHeroIdentityIndex(0);

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

  // Check for pending import after redirect
  useEffect(() => {
    if (step !== 'editor' || allCards.length === 0 || !selectedHero) return;
    
    const pendingImportStr = sessionStorage.getItem('pendingImport');
    if (!pendingImportStr) return;
    
    try {
      const { slots, name } = JSON.parse(pendingImportStr);
      sessionStorage.removeItem('pendingImport');
      
      // Apply the imported deck
      setTimeout(() => {
        applyImportedDeck(slots, name);
      }, 100);
    } catch {
      sessionStorage.removeItem('pendingImport');
    }
  }, [step, allCards, selectedHero, selectedAspects]);

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

  async function requestAiSuggestions(focus: string | null = null) {
    if (!selectedHero || aiLoading) return;

    setAiLoading(true);
    setAiSuggestions('');
    setActivePromptFocus(focus);
    
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
          heroIdentities: selectedHero.identities,
          heroHealth: selectedHero.health,
          aspects: selectedAspects,
          currentDeck,
          cardPool,
          heroCards,
          isMultiAspect: selectedHero.isMultiAspect,
          focus,
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

  // Parse MarvelCDB URL or ID
  function parseMarvelCDBInput(input: string): { type: 'decklist' | 'deck'; id: string } | null {
    const trimmed = input.trim();
    
    // Direct ID (numbers only)
    if (/^\d+$/.test(trimmed)) {
      return { type: 'decklist', id: trimmed };
    }
    
    // URL patterns
    // https://marvelcdb.com/decklist/view/12345/deck-name-1.0
    const decklistMatch = trimmed.match(/marvelcdb\.com\/decklist\/view\/(\d+)/);
    if (decklistMatch) {
      return { type: 'decklist', id: decklistMatch[1] };
    }
    
    // https://marvelcdb.com/deck/view/123456
    const deckMatch = trimmed.match(/marvelcdb\.com\/deck\/view\/(\d+)/);
    if (deckMatch) {
      return { type: 'deck', id: deckMatch[1] };
    }
    
    return null;
  }

  // Map MarvelCDB aspect to our aspect names
  function mapAspect(mcdbAspect: string): string {
    const mapping: Record<string, string> = {
      aggression: 'Aggression',
      justice: 'Justice',
      leadership: 'Leadership',
      protection: 'Protection',
      pool: 'Pool',
    };
    return mapping[mcdbAspect.toLowerCase()] ?? mcdbAspect;
  }

  async function handleImport() {
    if (!importInput.trim()) return;
    
    setImportLoading(true);
    setImportError('');
    
    try {
      const parsed = parseMarvelCDBInput(importInput);
      if (!parsed) {
        setImportError('Invalid MarvelCDB URL or deck ID. Try pasting a deck URL or just the numeric ID.');
        setImportLoading(false);
        return;
      }
      
      // Fetch from MarvelCDB API (only public decklists supported)
      const apiUrl = parsed.type === 'decklist'
        ? `https://marvelcdb.com/api/public/decklist/${parsed.id}`
        : `https://marvelcdb.com/api/public/deck/${parsed.id}`;
      
      const resp = await fetch(apiUrl);
      if (!resp.ok) {
        if (resp.status === 404) {
          setImportError('Deck not found. Make sure it\'s a published decklist.');
        } else {
          setImportError('Failed to fetch deck from MarvelCDB.');
        }
        setImportLoading(false);
        return;
      }
      
      const data = await resp.json();
      
      // Parse aspect from meta field
      let aspects: string[] = [];
      try {
        const meta = JSON.parse(data.meta || '{}');
        if (meta.aspect) {
          // Could be single aspect or comma-separated for multi-aspect
          aspects = meta.aspect.split(',').map((a: string) => mapAspect(a.trim()));
        }
      } catch {
        // meta parsing failed, try to infer from cards later
      }
      
      // Check hero match
      const heroCode = data.hero_code;
      const heroName = data.hero_name;
      
      // The MarvelCDB hero_code should match our hero ID directly
      // Our hero IDs are the MarvelCDB codes (e.g., "01040a" for Black Panther)
      const importedHero = heroes.find(h => h.id === heroCode);
      
      // Determine mismatch type
      let mismatch: 'hero' | 'aspect' | 'both' | null = null;
      const heroMatches = selectedHero?.id === heroCode;
      
      // For Adam Warlock, aspects don't need to match (he uses all 4)
      // For other heroes, check aspects match
      const isImportedHeroWarlock = heroCode === WARLOCK_ID;
      const isCurrentHeroWarlock = selectedHero?.id === WARLOCK_ID;
      
      let aspectsMatch = true;
      if (!isImportedHeroWarlock && !isCurrentHeroWarlock && aspects.length > 0) {
        aspectsMatch = aspects.length === selectedAspects.length &&
          aspects.every(a => selectedAspects.includes(a));
      }
      
      if (!heroMatches && !aspectsMatch && aspects.length > 0) {
        mismatch = 'both';
      } else if (!heroMatches) {
        mismatch = 'hero';
      } else if (!aspectsMatch && aspects.length > 0) {
        mismatch = 'aspect';
      }
      
      // If there's a mismatch, show confirmation dialog
      if (mismatch) {
        setImportConfirm({
          deckName: data.name,
          heroName,
          heroCode,
          aspects,
          slots: data.slots,
          mismatch,
        });
        setImportLoading(false);
        return;
      }
      
      // No mismatch, apply directly
      applyImportedDeck(data.slots, data.name);
      
    } catch (err) {
      setImportError('Failed to import deck. Please try again.');
    } finally {
      setImportLoading(false);
    }
  }

  function applyImportedDeck(slots: Record<string, number>, name?: string) {
    // Build lookup map: any MarvelCDB code -> card (including reprints)
    const cardByAnyId = new Map<string, CardPoolItem>();
    for (const card of allCards) {
      // Primary ID
      cardByAnyId.set(card.id, card);
      // All reprint IDs
      if (card.allIds) {
        for (const altId of card.allIds) {
          cardByAnyId.set(altId, card);
        }
      }
    }

    const newDeck = new Map<string, DeckEntry>();
    const skippedCards: { code: string; reason: string }[] = [];
    const importedCards: { name: string; qty: number }[] = [];

    // First, add hero cards (they're mandatory)
    let heroCardCount = 0;
    if (selectedHero) {
      for (const card of allCards.filter(c => c.heroId === selectedHero.id)) {
        newDeck.set(card.id, { card, quantity: card.deckLimit });
        heroCardCount += card.deckLimit;
      }
    }

    // Build set of hero-specific card IDs to skip (include all reprint IDs)
    const heroCardIds = new Set<string>();
    for (const card of allCards.filter(c => c.heroId === selectedHero?.id)) {
      heroCardIds.add(card.id);
      if (card.allIds) {
        for (const altId of card.allIds) {
          heroCardIds.add(altId);
        }
      }
    }

    // Then add imported cards
    for (const [code, quantity] of Object.entries(slots)) {
      // Skip hero-specific cards (already added above)
      if (heroCardIds.has(code)) {
        continue; // Don't log these, they're handled above
      }

      // Look up card by MarvelCDB code (including reprints)
      const card = cardByAnyId.get(code);

      if (card) {
        // Check if card's aspect is valid for current build
        const validAspects = new Set(['Basic', ...selectedAspects]);
        if (card.aspect && !validAspects.has(card.aspect)) {
          skippedCards.push({ code, reason: `wrong aspect: ${card.aspect} (need ${selectedAspects.join('/')})` });
          continue;
        }

        // Respect deck limits
        const limit = card.isUnique ? 1 : card.deckLimit;
        const qty = Math.min(quantity, limit);

        newDeck.set(card.id, { card, quantity: qty });
        importedCards.push({ name: card.name, qty });
      } else {
        // Card not found - might be hero identity card or not in our DB
        skippedCards.push({ code, reason: 'card not found in database' });
      }
    }

    // Calculate totals
    const totalImported = importedCards.reduce((sum, c) => sum + c.qty, 0);
    const totalDeckSize = heroCardCount + totalImported;

    // Log import summary
    console.group('📦 MarvelCDB Import Summary');
    console.log(`Deck: "${name}"`);
    console.log(`Hero cards (auto-added): ${heroCardCount}`);
    console.log(`Imported cards: ${totalImported} (${importedCards.length} unique)`);
    console.log(`Total deck size: ${totalDeckSize}`);
    if (importedCards.length > 0) {
      console.log('Imported:', importedCards.map(c => `${c.name} x${c.qty}`).join(', '));
    }
    if (skippedCards.length > 0) {
      console.warn('Skipped cards:');
      skippedCards.forEach(s => console.warn(`  - ${s.code}: ${s.reason}`));
    }
    console.groupEnd();

    // Apply the new deck
    setDeck(newDeck);
    if (name) setDeckName(name);
    setImportDialogOpen(false);
    setImportInput('');
    setImportConfirm(null);
  }

  function confirmImportWithSwitch() {
    if (!importConfirm) return;
    
    // Try to find hero by code first, then by name
    const heroForImport = heroes.find(h => h.id === importConfirm.heroCode) ??
      heroes.find(h => 
        importConfirm.heroName.toLowerCase().includes(h.name.toLowerCase()) ||
        h.name.toLowerCase().includes(importConfirm.heroName.toLowerCase())
      );
    
    if (heroForImport) {
      const slug = heroSlug(heroForImport.name, heroForImport.id);
      
      // Handle Adam Warlock specially - always use all 4 aspects
      let aspectsParam: string;
      if (heroForImport.id === WARLOCK_ID) {
        aspectsParam = [...ALL_ASPECTS].map(a => a.toLowerCase()).sort().join(',');
      } else {
        aspectsParam = importConfirm.aspects.map(a => a.toLowerCase()).sort().join(',');
      }
      
      // Store import data in sessionStorage so we can apply it after redirect
      sessionStorage.setItem('pendingImport', JSON.stringify({
        slots: importConfirm.slots,
        name: importConfirm.deckName,
      }));
      window.location.href = `/builder/${slug}/${aspectsParam}`;
    } else {
      setImportError(`Could not find hero "${importConfirm.heroName}" in your collection.`);
      setImportConfirm(null);
    }
  }

  // ── Step 1: Hero selection ────────────────────────────────────────────────

  if (step === 'hero') {
    return (
      <div>
        <h1>Build a Deck</h1>
        <p>Step 1 of 3 — Choose your hero</p>
        <div>
          <Input
            placeholder="Search heroes..."
            value={heroSearch}
            onChange={e => setHeroSearch(e.target.value)}

          />
          <OwnedOnlyButton active={collectionOnly} onClick={() => setCollectionOnly(v => !v)} />
        </div>
        <div>
          {filteredHeroes.map(hero => {
            const primary = getHeroIdentity(hero);
            const alterEgo = hero.identities.find(i => i.identityType === 'alter_ego');
            return (
              <button
                key={hero.id}
                onClick={() => selectHero(hero)}

              >
                <div>
                  {primary?.imageUrl ? (
                    <img
                      src={primary.imageUrl}
                      alt={hero.name}

                    />
                  ) : (
                    <div>
                      No Image
                    </div>
                  )}
                </div>
                <div>
                  <p>{hero.name}</p>
                  {alterEgo && (
                    <p>{alterEgo.name}</p>
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
    const aspectRecs = selectedHero ? getAspectRecommendations(selectedHero) : null;
    const maxRecScore = aspectRecs ? Math.max(...Object.values(aspectRecs).map(r => r.score)) : 0;
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => { window.location.href = '/builder'; }}>
          ← Back
        </Button>
        <h1>Build a Deck</h1>
        <div>
          <p>
            Step 2 of 3 — Choose your aspect{isMultiAspect ? 's' : ''}
          </p>
          <OwnedOnlyButton active={collectionOnly} onClick={() => setCollectionOnly(v => !v)} />
        </div>
        <p>
          Building with <strong>{selectedHero?.name}</strong>.{' '}
          {isMultiAspect
            ? 'Pick 2 aspects — Basic is always included.'
            : 'Pick 1 aspect — Basic is always included.'}
        </p>
        <div>
          {visibleAspects.map(aspect => {
            const isSelected = selectedAspects.includes(aspect);
            const rec = aspectRecs?.[aspect];
            const isRecommended = !!(rec && rec.score >= maxRecScore && maxRecScore > 0);
            return (
              <AspectButton
                key={aspect}
                aspect={aspect}
                isSelected={isSelected}
                isRecommended={isRecommended}
                recommendationReason={rec?.reason}
                onClick={() => toggleAspect(aspect)}
              />
            );
          })}
        </div>
        <p>
          Selected: Basic{selectedAspects.length > 0 ? `, ${selectedAspects.join(', ')}` : ''}
        </p>
        <Button
          onClick={() => {
            if (!selectedHero) return;
            const slug = heroSlug(selectedHero.name, selectedHero.id);
            const aspectsParam = [...selectedAspects].map(a => a.toLowerCase()).sort().join(',');
            window.location.href = `/builder/${slug}/${aspectsParam}`;
          }}
          disabled={selectedAspects.length !== (isMultiAspect ? 2 : 1)}

        >
          Continue to Deck Builder
        </Button>
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
    const b = Math.min(e.card.cost, 4);
    costBreakdown[b] += e.quantity;
  }
  const maxCostCount = Math.max(...COST_BUCKETS.map(b => costBreakdown[b]), 1);
  const curveSummary = getCurveSummary(costBreakdown);
  const heroSummary = selectedHero ? getHeroStrengthsWeaknesses(selectedHero) : null;
  const heroIdentity = selectedHero ? getHeroIdentity(selectedHero) : null;
  const shownIdentityForStats = selectedHero
    ? sortedIdentities(selectedHero)[Math.min(heroIdentityIndex, selectedHero.identities.length - 1)]
    : null;

  const sortedPool = [...filteredPool].sort((a, b) => {
    const aInDeck = (deck.get(a.id)?.quantity ?? 0) > 0;
    const bInDeck = (deck.get(b.id)?.quantity ?? 0) > 0;
    if (aInDeck && !bInDeck) return -1;
    if (!aInDeck && bInDeck) return 1;
    if (a.heroId && !b.heroId) return -1;
    if (!a.heroId && b.heroId) return 1;
    if (a.heroId && b.heroId) return (a.setPosition ?? Infinity) - (b.setPosition ?? Infinity);
    return a.name.localeCompare(b.name);
  });

  return (
    <div>
      {/* Session Header */}
      {sessionContext && (
        <div>
          <a 
            href={`/sessions/${sessionContext.code}`} 

          >
            ← Back to {sessionContext.name}
          </a>
        </div>
      )}
      
      {/* Header */}
      <div>
        <div>
          <h1>{selectedHero?.name}</h1>
          <div>
            <span>Basic</span>
            {selectedAspects.map(a => (
              <AspectBadge key={a} aspect={a} />
            ))}
          </div>
        </div>
        {!sessionContext && (
          <div>
            <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
              Import from MarvelCDB
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                window.location.href = selectedHero?.id === WARLOCK_ID
                  ? '/builder'
                  : `/builder/${heroSlug(selectedHero!.name, selectedHero!.id)}`;
              }}
            >
              {selectedHero?.id === WARLOCK_ID ? '← Change Hero' : '← Change Hero/Aspect'}
            </Button>
          </div>
        )}
      </div>

      {/* Teammates Panel (Session Mode) */}
      {sessionContext && sessionContext.teammates.length > 0 && (
        <div>
          <h3>
            Teammates
          </h3>
          <div>
            {sessionContext.teammates.map((t) => (
              <div key={t.userId}>
                {t.userImage ? (
                  <img src={t.userImage} alt={t.userName ?? ''} />
                ) : (
                  <div>
                    {(t.userName ?? '?')[0]}
                  </div>
                )}
                <div>
                  <div>
                    <span>{t.userName}</span>
                    {t.aspects.map(a => (
                      <span key={a} style={{ backgroundColor: `var(--color-aspect-${a.toLowerCase()})` }}>
                        {a[0]}
                      </span>
                    ))}
                  </div>
                  <div>
                    {t.heroName}
                    {t.deckName && <span>✓</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {sessionContext.collectionMode !== 'single' && (
            <p>
              Collection: {sessionContext.collectionMode === 'combined' ? 'Union of all players' : 'Summed duplicates'}
            </p>
          )}
        </div>
      )}

      <div>
        <button
          onClick={() => setMobileTab('cards')}

        >
          Cards
        </button>
        <button
          onClick={() => setMobileTab('deck')}

        >
          Deck ({totalDeckSize} / 40)
        </button>
      </div>

      <div>
        {/* ── Left: Card Pool ── */}
        <div style={{ flex: '0 1 56rem' }}>
          <div>
            <Input
              placeholder="Search cards..."
              value={cardSearch}
              onChange={e => setCardSearch(e.target.value)}

            />
            <OwnedOnlyButton active={collectionOnly} onClick={() => setCollectionOnly(v => !v)} />
          </div>
          <div>
            <div>
              {TYPE_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setTypeFilter(f.value)}

                >
                  {f.label}
                </button>
              ))}
            </div>
            <span>
              {sortedPool.length} card{sortedPool.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div>
            <div ref={cardPoolRef}>
              {sortedPool.length === 0 ? (
                <p>
                  No cards found
                </p>
              ) : (
                <table>
                  <colgroup>
                    <col />
                    <col />
                    <col />
                    <col />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Card</th>
                      <th>Cost</th>
                      <th>Left</th>
                      <th></th>
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
                        <tr key={card.id}>
                          <td>
                            <div>
                              {card.aspect && (
                                <span

                                  style={{ backgroundColor: `var(--color-aspect-dot-${card.aspect.toLowerCase()})` }}
                                />
                              )}
                              <div>
                                <button
                                  onClick={() => setModalCard(card)}

                                >
                                  {card.name}
                                </button>
                                {card.isUnique && (
                                  <span className="marvel-glyph">S</span>
                                )}
                                <CardTypeBadge type={card.type} />
                                {claimedBy && claimedBy.length > 0 && (
                                  <span title={`Used by ${claimedBy.join(', ')}`}>
                                    ({claimedBy.join(', ')})
                                  </span>
                                )}
                              </div>
                            </div>
                            {card.traits && (
                              <p>
                                {card.traits}
                              </p>
                            )}
                          </td>
                          <td>
                            {card.cost ?? '—'}
                          </td>
                          <td>
                            {(() => {
                              const remaining = effectiveQty - inDeck;
                              const cls = remaining === 0
                                ? 'text-red-400'
                                : remaining < effectiveQty
                                  ? 'text-amber-400'
                                  : 'text-muted-foreground';
                              return <span>{remaining}</span>;
                            })()}
                          </td>
                          <td>
                            <div>
                              {inDeck > 0 && (
                                <button
                                  onClick={() => removeCard(card.id)}

                                >
                                  −
                                </button>
                              )}
                              <span

                              >
                                {inDeck > 0 ? inDeck : ''}
                              </span>
                              <button
                                onClick={() => addCard(card)}
                                disabled={atLimit || atDeckCap || !!isBlocked}
                                title={isBlocked ? `Used by ${claimedBy?.join(', ')}` : undefined}

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
          <div>
            <h2>Composition</h2>

            {/* Segmented type bar */}
            <div>
              {typeBreakdown.map(([type, count]) => (
                <div
                  key={type}

                  style={{ width: `${(count / totalDeckSize) * 100}%` }}
                  title={`${formatType(type)}: ${count}`}
                />
              ))}
            </div>

            {/* Type pills */}
            <div>
              {typeBreakdown.map(([type, count]) => (
                <span key={type}>
                  <span />
                  {formatType(type)} {count}
                </span>
              ))}
            </div>

            {/* Cost curve */}
            <p>Cost Curve</p>
            <div>
              {COST_BUCKETS.map(cost => {
                const count = costBreakdown[cost];
                const barPx = count > 0 ? Math.max(4, Math.round((count / maxCostCount) * 36)) : 0;
                return (
                  <div key={cost}>
                    <span>
                      {count}
                    </span>
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
            {/* Curve label */}
            <div>
              <span>{curveSummary.label}</span>
              {curveSummary.warning && (
                <p>{curveSummary.warning}</p>
              )}
            </div>
          </div>

          {/* AI Analysis */}
          <div>
            <h2>
              <span>✨</span> AI Analysis
            </h2>
            <div>
              {SUGGESTION_PILLS.filter(pill => !('showIf' in pill) || pill.showIf(totalDeckSize)).map(pill => {
                const isActive = activePromptFocus === pill.focus && (aiSuggestions || aiLoading);
                return (
                  <button
                    key={pill.label}
                    onClick={() => requestAiSuggestions(pill.focus)}
                    disabled={aiLoading}

                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>
            <div>
              {aiLoading && !aiSuggestions && (
                <div>
                  <span />
                  Analyzing your deck...
                </div>
              )}
              {aiSuggestions && (
                <div

                  dangerouslySetInnerHTML={{ __html: formatAiResponse(aiSuggestions) }}
                />
              )}
              {!aiLoading && !aiSuggestions && (
                <p>Pick a focus above to get AI-powered deck suggestions.</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: Deck Panel ── */}
        <div>
          {/* Hero card */}
          {selectedHero && (() => {
            const identities = sortedIdentities(selectedHero);
            const idx = Math.min(heroIdentityIndex, identities.length - 1);
            const shownIdentity = identities[idx];
            return (
              <div>
                <div>
                  {shownIdentity?.imageUrl ? (
                    <img src={shownIdentity.imageUrl} alt={shownIdentity.name} />
                  ) : (
                    <div>No Image</div>
                  )}
                </div>
                {identities.length > 1 && (
                  <div>
                    {identities.map((id, i) => (
                      <button
                        key={id.identityType}
                        onClick={() => setHeroIdentityIndex(i)}

                      >
                        {identityLabel(id.identityType)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
          {/* Hero Overview */}
          {heroSummary && selectedHero && shownIdentityForStats && (
            <div>
              <p>
                {identityLabel(shownIdentityForStats.identityType)} Overview
              </p>
              <div>
                {shownIdentityForStats.attack != null && <span>ATK <strong>{shownIdentityForStats.attack}</strong></span>}
                {shownIdentityForStats.thwart != null && <span>THW <strong>{shownIdentityForStats.thwart}</strong></span>}
                {shownIdentityForStats.defense != null && <span>DEF <strong>{shownIdentityForStats.defense}</strong></span>}
                {shownIdentityForStats.recover != null && <span>REC <strong>{shownIdentityForStats.recover}</strong></span>}
                {shownIdentityForStats.handSize != null && <span>HAND <strong>{shownIdentityForStats.handSize}</strong></span>}
                <span>HP <strong>{selectedHero.health}</strong></span>
              </div>
              {(heroSummary.strengths.length > 0 || heroSummary.weaknesses.length > 0) && (
                <div>
                  {heroSummary.strengths.map(s => (
                    <span key={s}>+ {s}</span>
                  ))}
                  {heroSummary.weaknesses.map(w => (
                    <span key={w}>− {w}</span>
                  ))}
                </div>
              )}
              <p>{heroSummary.pairsSuggestion}</p>
            </div>
          )}

          {/* Deck stats */}
          <div>
            <div>
              <h2>Deck</h2>
              <span

              >
                {totalDeckSize}
              </span>
            </div>
            <DeckProgress count={totalDeckSize} />

            <div>
              {deckEntries.length === 0 ? (
                <p>
                  No cards added yet
                </p>
              ) : (
                <div>
                  {TYPE_ORDER.filter(type => deckEntries.some(e => e.card.type === type)).map(type => (
                    <div key={type}>
                      <p>
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
          <div>
            <h2>
              {sessionContext ? 'Save to Session' : editDeckId ? 'Update Deck' : 'Save Deck'}
            </h2>
            <Input
              placeholder={`${selectedHero?.name} — ${selectedAspects.join('/')}`}
              value={deckName}
              onChange={e => setDeckName(e.target.value)}

            />
            <Button
              onClick={() => doSave()}
              disabled={saveStatus === 'saving' || totalDeckSize < 40 || totalDeckSize > 50 || (!sessionContext && !hasChanges)}

            >
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved!' : sessionContext ? 'Save Deck' : saveLabel}
            </Button>
            {editDeckId && !sessionContext && (
              <Button
                variant="outline"
                onClick={() => doSave(true)}
                disabled={saveStatus === 'saving' || totalDeckSize < 40 || totalDeckSize > 50}

              >
                Save as New Deck
              </Button>
            )}
            {saveStatus === 'error' && (
              <p>Failed to save. Please try again.</p>
            )}
            {saveStatus === 'saved' && (
              <p>
                {sessionContext ? 'Deck saved to session!' : editDeckId ? 'Deck updated!' : 'Deck saved!'}
              </p>
            )}
          </div>

        </div>
      </div>
      <CardModal card={modalCard} onClose={() => setModalCard(null)} />

      <Dialog
        open={importDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setImportDialogOpen(false);
            setImportInput('');
            setImportError('');
            setImportConfirm(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import from MarvelCDB</DialogTitle>
          </DialogHeader>
          {!importConfirm ? (
            <div>
              <p>
                Paste a MarvelCDB deck URL or decklist ID to import cards.
              </p>
              <Input
                placeholder="https://marvelcdb.com/decklist/view/12345 or just 12345"
                value={importInput}
                onChange={e => setImportInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleImport()}
                autoFocus
              />
              {importError && <p>{importError}</p>}
              <div>
                <Button
                  variant="outline"
                  onClick={() => { setImportDialogOpen(false); setImportInput(''); setImportError(''); }}

                >
                  Cancel
                </Button>
                <Button onClick={handleImport} disabled={importLoading || !importInput.trim()}>
                  {importLoading ? 'Importing…' : 'Import'}
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <div>
                <p>
                  {importConfirm.mismatch === 'both' && 'Hero and aspect mismatch'}
                  {importConfirm.mismatch === 'hero' && 'Hero mismatch'}
                  {importConfirm.mismatch === 'aspect' && 'Aspect mismatch'}
                </p>
                <p>
                  The deck "{importConfirm.deckName}" is for{' '}
                  <strong>{importConfirm.heroName}</strong>
                  {importConfirm.heroCode !== WARLOCK_ID && importConfirm.aspects.length > 0 && (
                    <> with <strong>{importConfirm.aspects.join('/')}</strong></>
                  )}
                  {importConfirm.heroCode === WARLOCK_ID && <> <span>(uses all aspects)</span></>}.
                </p>
                <p>
                  You're currently building{' '}
                  <strong>{selectedHero?.name}</strong>
                  {selectedHero?.id !== WARLOCK_ID && selectedAspects.length > 0 && (
                    <> with <strong>{selectedAspects.join('/')}</strong></>
                  )}
                  {selectedHero?.id === WARLOCK_ID && <> <span>(uses all aspects)</span></>}.
                </p>
              </div>
              <div>
                <Button onClick={confirmImportWithSwitch}>
                  Switch to {importConfirm.heroName}
                  {importConfirm.heroCode !== WARLOCK_ID && importConfirm.aspects.length > 0 && ` (${importConfirm.aspects.join('/')})`}
                </Button>
                <Button variant="outline" onClick={() => { setImportConfirm(null); setImportError(''); }}>
                  Try Different Deck
                </Button>
                <Button variant="ghost" onClick={() => { setImportDialogOpen(false); setImportInput(''); setImportError(''); setImportConfirm(null); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
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
  const nameStyle = isHero
    ? { color: 'white' }
    : entry.card.aspect
      ? { color: `var(--color-aspect-text-${entry.card.aspect.toLowerCase()})` }
      : undefined;
  return (
    <div>
      <span>
        {entry.quantity}
      </span>
      <button
        onClick={() => onCardClick(entry.card)}

        style={nameStyle}
      >
        {entry.card.name}
      </button>
      {!isHero && (
        <div>
          <button
            onClick={() => onRemove(entry.card.id)}

          >
            −
          </button>
          <button
            onClick={() => onAdd(entry.card)}

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
    <Button variant={active ? 'default' : 'outline'} size="sm" onClick={onClick}>
      Owned only
    </Button>
  );
}
