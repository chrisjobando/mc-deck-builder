import { useState } from 'react';

function formatCardText(text: string): string {
  return text
    .replace(/\[\[([^\]]+)\]\]/g, '<strong class="uppercase">$1</strong>')
    .replace(/\[star\]/g, '★')
    .replace(/\[wild\]/g, '🍃')
    .replace(/\[energy\]/g, '⚡')
    .replace(/\[mental\]/g, '🧪')
    .replace(/\[physical\]/g, '👊')
    .replace(/\n/g, '<br>');
}

interface PreviewCard {
  id: string;
  name: string;
  type: string;
  aspect: string | null;
  cost: number | null;
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
  alterEgoName: string | null;
  alterEgoImageUrl: string | null;
  alterEgoText: string | null;
  alterEgoTraits: string | null;
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

function formatType(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function heroSlug(name: string, id: string): string {
  const nameSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${nameSlug}-${id}`;
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

      {/* Modal */}
      {openDeck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={closeModal} />
          <div className="relative z-10 flex w-full max-w-2xl overflow-hidden rounded-xl border border-white/10 bg-[var(--color-surface)] shadow-2xl" style={{ maxHeight: '85vh' }}>

            {/* Left: image panel */}
            <div className="flex w-80 flex-shrink-0 flex-col bg-black/20">
              <div className="relative aspect-[63/88] w-full overflow-hidden">
                {leftImageUrl ? (
                  <img src={leftImageUrl} alt={selectedCard?.name ?? openDeck.heroName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-[var(--color-text-muted)]">No Image</div>
                )}
              </div>
              {/* Info below image */}
              <div className="flex-1 overflow-y-auto p-3 text-xs">
                {selectedCard ? (
                  <>
                    <p className="font-semibold leading-tight">{selectedCard.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="text-[var(--color-text-muted)]">{formatType(selectedCard.type)}</span>
                      {selectedCard.cost !== null && (
                        <span className="text-[var(--color-text-muted)]">· Cost {selectedCard.cost}</span>
                      )}
                    </div>
                    {selectedCard.traits && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {selectedCard.traits.split('. ').map(t => t.replace(/\.$/, '').trim()).filter(Boolean).map(t => (
                          <span key={t} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]">{t}</span>
                        ))}
                      </div>
                    )}
                    {selectedCard.text && (
                      <p
                        className="mt-2 leading-relaxed text-[var(--color-text-muted)]"
                        style={{ fontSize: '10px' }}
                        dangerouslySetInnerHTML={{ __html: formatCardText(selectedCard.text) }}
                      />
                    )}
                    {(() => {
                      const icons = [
                        ...Array(selectedCard.resourceEnergy ?? 0).fill('⚡'),
                        ...Array(selectedCard.resourceMental ?? 0).fill('🧪'),
                        ...Array(selectedCard.resourcePhysical ?? 0).fill('👊'),
                        ...Array(selectedCard.resourceWild ?? 0).fill('🍃'),
                      ];
                      return icons.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-0.5">
                          {icons.map((icon, i) => (
                            <span key={i} className="text-xs">{icon}</span>
                          ))}
                        </div>
                      ) : null;
                    })()}
                  </>
                ) : (
                  <>
                    <p className="font-semibold leading-tight">{heroSide === 'alter_ego' ? openDeck.alterEgoName : openDeck.heroName}</p>
                    <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">♥ {openDeck.heroHealth} HP</p>
                    {(() => {
                      const traits = heroSide === 'alter_ego' ? openDeck.alterEgoTraits : openDeck.heroTraits;
                      const text = heroSide === 'alter_ego' ? openDeck.alterEgoText : openDeck.heroText;
                      const traitList = traits ? traits.split('. ').map(t => t.replace(/\.$/, '').trim()).filter(Boolean) : [];
                      return (
                        <>
                          {traitList.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {traitList.map(t => (
                                <span key={t} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]">{t}</span>
                              ))}
                            </div>
                          )}
                          {text && (
                            <p
                              className="mt-2 leading-relaxed text-[var(--color-text-muted)]"
                              style={{ fontSize: '10px' }}
                              dangerouslySetInnerHTML={{ __html: formatCardText(text) }}
                            />
                          )}
                        </>
                      );
                    })()}
                  </>
                )}
              </div>

              {/* Flip / back button */}
              {!selectedCard && openDeck.alterEgoImageUrl && (
                <button
                  onClick={() => setHeroSide(s => s === 'hero' ? 'alter_ego' : 'hero')}
                  className="border-t border-white/10 px-3 py-2 text-[10px] text-[var(--color-text-muted)] transition hover:bg-white/5 hover:text-[var(--color-text)]"
                >
                  {heroSide === 'hero' ? 'Alter Ego →' : '← Hero'}
                </button>
              )}
              {selectedCard && (
                <button
                  onClick={() => setSelectedCard(null)}
                  className="border-t border-white/10 px-3 py-2 text-[10px] text-[var(--color-text-muted)] transition hover:bg-white/5 hover:text-[var(--color-text)]"
                >
                  ← Hero Card
                </button>
              )}
            </div>

            {/* Right: deck info */}
            <div className="flex min-w-0 flex-1 flex-col">
              {/* Header */}
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
                <div className="ml-3 flex flex-shrink-0 items-center gap-2">
                  <a
                    href={`/builder/${heroSlug(openDeck.heroName, openDeck.heroId)}/${openDeck.aspects.map(a => a.toLowerCase()).sort().join(',')}?deck=${openDeck.id}`}
                    className="rounded p-1.5 text-[var(--color-text-muted)] transition hover:bg-white/10 hover:text-[var(--color-text)]"
                    aria-label="Edit deck"
                    title="Edit deck"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </a>
                  <button
                    onClick={copyDeck}
                    disabled={copying}
                    className="rounded p-1.5 text-[var(--color-text-muted)] transition hover:bg-white/10 hover:text-[var(--color-text)] disabled:opacity-50"
                    aria-label="Copy deck"
                    title="Copy deck"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
                      <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" />
                    </svg>
                  </button>
                  <button
                    onClick={deleteDeck}
                    disabled={deleting}
                    className="rounded p-1.5 text-[var(--color-text-muted)] transition hover:bg-red-900/40 hover:text-red-400 disabled:opacity-50"
                    aria-label="Delete deck"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button onClick={closeModal} className="rounded p-1.5 hover:bg-white/10" aria-label="Close">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Card list */}
              <div className="flex-1 overflow-y-auto px-4 py-3 pr-3">
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

              {/* Footer */}
              <div className="border-t border-white/10 px-4 py-2 text-xs text-[var(--color-text-muted)]">
                {openDeck.total} cards · updated {openDeck.updatedAt}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
