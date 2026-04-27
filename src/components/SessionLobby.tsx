import PusherClient from 'pusher-js';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LobbyParticipant, LobbySession } from '../lib/sessions';
import { heroSlug, WARLOCK_ID } from '../lib/utils';

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
  identities: HeroIdentity[];
}

interface UserDeck {
  id: string;
  name: string;
  heroCardId: string;
  aspects: string[];
  heroCard: { name: string };
}

const ASPECTS = ['Aggression', 'Justice', 'Leadership', 'Protection', 'Pool'] as const;

const ASPECT_BG: Record<string, string> = {
  Aggression: 'bg-red-700',
  Justice: 'bg-yellow-600',
  Leadership: 'bg-blue-700',
  Protection: 'bg-green-700',
  Pool: 'bg-pink-700',
  Basic: 'bg-gray-700',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Lobby',
  drafting: 'Drafting',
  building: 'Building',
  completed: 'Completed',
};

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-white/10 text-gray-400',
  drafting: 'bg-yellow-500/20 text-yellow-300',
  building: 'bg-blue-500/20 text-blue-300',
  completed: 'bg-white/10 text-gray-400',
};

// ── Ghost slot ────────────────────────────────────────────────────────────────

function GhostSlot() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-white/10 p-4 text-sm text-gray-500">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-lg">
        ?
      </div>
      <span>Waiting for player…</span>
    </div>
  );
}

// ── Participant roster card ───────────────────────────────────────────────────

function ParticipantSlot({
  participant,
  isYou,
  showPick,
}: {
  participant: LobbyParticipant;
  isYou: boolean;
  showPick: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-4 transition ${
        participant.isLocked
          ? 'border-green-500/30 bg-green-500/5'
          : 'border-white/10 bg-white/5'
      }`}
    >
      {participant.userImage ? (
        <img
          src={participant.userImage}
          alt={participant.userName ?? ''}
          className="h-10 w-10 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold uppercase">
          {(participant.userName ?? '?')[0]}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <span className="truncate">{participant.userName ?? 'Unknown'}</span>
          {isYou && (
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-400">
              you
            </span>
          )}
        </div>
        {showPick && participant.heroCardId ? (
          <div className="mt-0.5 flex items-center gap-2">
            {participant.heroImageUrl && (
              <img
                src={participant.heroImageUrl}
                alt={participant.heroName ?? ''}
                className="h-6 w-6 rounded-full object-cover object-top"
              />
            )}
            <span className="truncate text-xs text-[var(--color-text-muted)]">
              {participant.heroName}
            </span>
            {participant.aspects.map((a) => (
              <span
                key={a}
                className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium text-white ${ASPECT_BG[a] ?? 'bg-gray-700'}`}
              >
                {a[0]}
              </span>
            ))}
          </div>
        ) : showPick ? (
          <div className="mt-0.5 text-xs text-gray-500">Choosing…</div>
        ) : null}
      </div>
      {participant.isLocked && (
        <div className="shrink-0 text-green-400" title="Locked in">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ── Hero picker ───────────────────────────────────────────────────────────────

function HeroPicker({
  heroes,
  selectedId,
  disabledIds,
  onSelect,
}: {
  heroes: HeroOption[];
  selectedId: string | null;
  disabledIds: Set<string>;
  onSelect: (hero: HeroOption) => void;
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearch(val: string) {
    setSearch(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedSearch(val), 300);
  }

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return q ? heroes.filter((h) => h.name.toLowerCase().includes(q)) : heroes;
  }, [heroes, debouncedSearch]);

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-muted)]">Choose Hero</h3>
      <input
        type="search"
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search heroes…"
        className="mb-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
      />
      <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1">
        {filtered.map((hero) => {
          const heroIdentity =
            hero.identities.find((i) => i.identityType === 'hero') ?? hero.identities[0];
          const isSelected = hero.id === selectedId;
          const isDisabled = disabledIds.has(hero.id);
          return (
            <button
              key={hero.id}
              onClick={() => !isDisabled && onSelect(hero)}
              disabled={isDisabled}
              title={isDisabled ? 'Taken by another player' : undefined}
              className={`group relative overflow-hidden rounded-lg border text-left transition ${
                isDisabled
                  ? 'cursor-not-allowed border-white/5 opacity-30'
                  : isSelected
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/20 ring-1 ring-[var(--color-primary)]'
                    : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
              }`}
            >
              {heroIdentity?.imageUrl && (
                <img
                  src={heroIdentity.imageUrl}
                  alt={hero.name}
                  className="h-24 w-full object-cover object-top"
                />
              )}
              <div className="p-2">
                <div className="truncate text-xs font-semibold">{hero.name}</div>
                <div className="text-[10px] text-gray-500">{hero.health} HP</div>
              </div>
              {isDisabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-2 py-4 text-center text-sm text-gray-500">No heroes found</p>
        )}
      </div>
    </div>
  );
}

// ── Aspect picker ─────────────────────────────────────────────────────────────

function AspectPicker({
  selectedAspects,
  isMultiAspect,
  onToggle,
}: {
  selectedAspects: string[];
  isMultiAspect: boolean;
  onToggle: (aspect: string) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-muted)]">
        Aspects {isMultiAspect ? '(pick 2)' : '(pick 1)'}
      </h3>
      <div className="flex flex-wrap gap-2">
        {ASPECTS.map((aspect) => {
          const selected = selectedAspects.includes(aspect);
          return (
            <button
              key={aspect}
              onClick={() => onToggle(aspect)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                selected
                  ? `${ASPECT_BG[aspect]} text-white ring-2 ring-white/30`
                  : 'bg-white/10 text-gray-400 hover:bg-white/20'
              }`}
            >
              {aspect}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SessionLobby() {
  const [session, setSession] = useState<LobbySession | null>(null);
  const [heroes, setHeroes] = useState<HeroOption[]>([]);
  const [meta, setMeta] = useState({ code: '', userId: '', hostId: '' });
  const [copied, setCopied] = useState(false);
  const [locking, setLocking] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Optimistic local state for my draft pick
  const [myHeroId, setMyHeroId] = useState<string | null>(null);
  const [myAspects, setMyAspects] = useState<string[]>([]);
  const [myLocked, setMyLocked] = useState(false);

  // Bootstrap from DOM + connect Pusher
  useEffect(() => {
    const sessionEl = document.getElementById('session-data');
    const metaEl = document.getElementById('session-meta');
    const heroesEl = document.getElementById('heroes-data');

    const initialSession: LobbySession = sessionEl?.dataset.session
      ? JSON.parse(sessionEl.dataset.session)
      : null;
    const heroesData: HeroOption[] = heroesEl?.dataset.heroes
      ? JSON.parse(heroesEl.dataset.heroes)
      : [];
    const code = metaEl?.dataset.code ?? '';
    const userId = metaEl?.dataset.userId ?? '';
    const hostId = metaEl?.dataset.hostId ?? '';

    setSession(initialSession);
    setHeroes(heroesData);
    setMeta({ code, userId, hostId });

    if (initialSession) {
      const me = initialSession.participants.find((p) => p.userId === userId);
      if (me) {
        setMyHeroId(me.heroCardId);
        setMyAspects(me.aspects);
        setMyLocked(me.isLocked);
      }
    }

    const pusherKey = (import.meta as { env: Record<string, string> }).env.PUBLIC_PUSHER_KEY;
    const pusherCluster = (import.meta as { env: Record<string, string> }).env
      .PUBLIC_PUSHER_CLUSTER;
    if (!pusherKey || !code) return;

    const client = new PusherClient(pusherKey, { cluster: pusherCluster });
    const channel = client.subscribe(`session-${code}`);

    const syncSession = (data: LobbySession) => {
      setSession(data);
      const me = data.participants.find((p) => p.userId === userId);
      if (me) {
        setMyHeroId(me.heroCardId);
        setMyAspects(me.aspects);
        setMyLocked(me.isLocked);
      }
    };

    channel.bind('participant-joined', syncSession);
    channel.bind('participant-updated', syncSession);
    channel.bind('participant-locked', syncSession);
    channel.bind('status-changed', (data: LobbySession) => {
      setSession(data);
      if (data.status === 'completed') {
        channel.unbind_all();
        client.disconnect();
      }
    });

    return () => {
      channel.unbind_all();
      client.disconnect();
    };
  }, []);

  const myHero = useMemo(
    () => heroes.find((h) => h.id === myHeroId) ?? null,
    [heroes, myHeroId]
  );

  // Heroes locked by other players — disabled in picker
  const lockedHeroIds = useMemo(() => {
    if (!session) return new Set<string>();
    return new Set(
      session.participants
        .filter((p) => p.isLocked && p.userId !== meta.userId)
        .map((p) => p.heroCardId)
        .filter((id): id is string => id !== null)
    );
  }, [session, meta.userId]);

  async function patchParticipant(patch: {
    heroCardId?: string | null;
    aspects?: string[];
    isLocked?: boolean;
  }) {
    if (!meta.code) return;
    await fetch(`/api/sessions/${meta.code}/participant`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  }

  function handleHeroSelect(hero: HeroOption) {
    const aspects =
      hero.id === WARLOCK_ID ? ['Aggression', 'Justice', 'Leadership', 'Protection'] : [];
    setMyHeroId(hero.id);
    setMyAspects(aspects);
    patchParticipant({ heroCardId: hero.id, aspects });
  }

  function handleAspectToggle(aspect: string) {
    const isMulti = myHero?.isMultiAspect ?? false;
    let next: string[];
    if (myAspects.includes(aspect)) {
      next = myAspects.filter((a) => a !== aspect);
    } else if (isMulti) {
      next = myAspects.length < 2 ? [...myAspects, aspect] : [myAspects[1], aspect];
    } else {
      next = [aspect];
    }
    setMyAspects(next);
    patchParticipant({ aspects: next });
  }

  async function handleLockIn() {
    if (!myHeroId || myAspects.length === 0 || locking) return;
    setLocking(true);
    setMyLocked(true); // optimistic
    try {
      await patchParticipant({ isLocked: true });
    } catch {
      setMyLocked(false); // revert on error
    } finally {
      setLocking(false);
    }
  }

  async function handleUnlock() {
    if (unlocking) return;
    setUnlocking(true);
    setMyLocked(false); // optimistic
    try {
      await patchParticipant({ isLocked: false });
    } catch {
      setMyLocked(true); // revert on error
    } finally {
      setUnlocking(false);
    }
  }

  async function handleStatusChange(status: 'draft' | 'drafting' | 'building' | 'completed') {
    if (!meta.code) return;
    await fetch(`/api/sessions/${meta.code}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }

  async function handleDelete() {
    if (!meta.code || deleting) return;
    if (!confirm('Delete this session? This cannot be undone.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/sessions/${meta.code}`, { method: 'DELETE' });
      if (res.ok) {
        window.location.href = '/sessions';
      } else {
        alert('Failed to delete session');
        setDeleting(false);
      }
    } catch {
      alert('Failed to delete session');
      setDeleting(false);
    }
  }

  function copyInviteCode() {
    if (!session) return;
    navigator.clipboard.writeText(session.inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!session) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        Loading session…
      </div>
    );
  }

  const isHost = meta.userId === meta.hostId;
  const allLocked =
    session.participants.length > 0 && session.participants.every((p) => p.isLocked);
  const slots = Array.from({ length: 4 });
  const showPick = session.status === 'drafting' || session.status === 'building' || session.status === 'completed';

  // Build phase: compute each player's builder URL within session context
  function builderUrl(participant: LobbyParticipant) {
    if (!participant.heroCardId || !participant.heroName) return null;
    const slug = heroSlug(participant.heroName, participant.heroCardId);
    if (participant.aspects.length === 0) return `/sessions/${meta.code}/${slug}`;
    const aspectsParam = [...participant.aspects].map((a) => a.toLowerCase()).sort().join(',');
    return `/sessions/${meta.code}/${slug}/${aspectsParam}`;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <a href="/sessions" className="text-sm text-[var(--color-text-muted)] hover:text-white">
          ← Sessions
        </a>
        <h1 className="text-2xl font-bold">{session.name}</h1>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[session.status]}`}
        >
          {STATUS_LABEL[session.status]}
        </span>
      </div>

      {/* ── Phase 1: Lobby ── */}
      {session.status === 'draft' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Players ({session.participants.length}/4)
            </h2>
            {slots.map((_, i) => {
              const p = session.participants[i];
              if (!p) return <GhostSlot key={i} />;
              return (
                <ParticipantSlot key={p.id} participant={p} isYou={p.userId === meta.userId} showPick={false} />
              );
            })}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-2 text-base font-semibold">Waiting for players</h2>
            <p className="mb-4 text-sm text-[var(--color-text-muted)]">
              Share your invite code so others can join. Once everyone's in, start the draft.
            </p>
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2">
              <span className="font-mono text-xl font-bold tracking-widest text-[var(--color-primary)]">
                {session.inviteCode}
              </span>
              <button
                onClick={copyInviteCode}
                className="ml-auto text-xs text-[var(--color-text-muted)] hover:text-white"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            {isHost && (
              <button
                onClick={() => handleStatusChange('drafting')}
                className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold hover:opacity-90"
              >
                Start Draft →
              </button>
            )}
            {isHost && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="mt-2 w-full rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete Session'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Phase 2: Draft ── */}
      {session.status === 'drafting' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Roster */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Players ({session.participants.filter((p) => p.isLocked).length}/{session.participants.length} locked)
            </h2>
            {slots.map((_, i) => {
              const p = session.participants[i];
              if (!p) return <GhostSlot key={i} />;
              return (
                <ParticipantSlot key={p.id} participant={p} isYou={p.userId === meta.userId} showPick={true} />
              );
            })}

            {isHost && (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => handleStatusChange('draft')}
                  className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20"
                >
                  ← Back to Lobby
                </button>
                <button
                  onClick={() => handleStatusChange('building')}
                  disabled={!allLocked}
                  title={!allLocked ? 'All players must lock in first' : undefined}
                  className="rounded-lg bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Start Building →
                </button>
              </div>
            )}
          </div>

          {/* My pick panel — hidden once locked */}
          {!myLocked ? (
            <div className="space-y-5 rounded-xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Your Pick
              </h2>
              <HeroPicker
                heroes={heroes}
                selectedId={myHeroId}
                disabledIds={lockedHeroIds}
                onSelect={handleHeroSelect}
              />
              {myHeroId && myHeroId !== WARLOCK_ID && (
                <AspectPicker
                  selectedAspects={myAspects}
                  isMultiAspect={myHero?.isMultiAspect ?? false}
                  onToggle={handleAspectToggle}
                />
              )}
              <button
                onClick={handleLockIn}
                disabled={!myHeroId || myAspects.length === 0 || locking}
                className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {locking ? 'Locking in…' : 'Lock In'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-green-500/30 bg-green-500/5 p-8 text-center">
              <div className="text-3xl text-green-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-green-300">Locked in!</div>
                <div className="mt-1 text-sm text-gray-500">
                  {myHero?.name}
                  {myAspects.length > 0 && ` · ${myAspects.join(', ')}`}
                </div>
              </div>
              <p className="text-xs text-gray-600">Waiting for others…</p>
              <button
                onClick={handleUnlock}
                disabled={unlocking}
                className="mt-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/20 disabled:opacity-50"
              >
                {unlocking ? 'Unlocking…' : 'Change Selection'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Phase 3: Build ── */}
      {session.status === 'building' && (
        <div className="space-y-6">
          <p className="text-[var(--color-text-muted)]">
            Everyone's locked in — time to build! Open the builder with your hero pre-loaded.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {session.participants.map((p) => {
              const isYou = p.userId === meta.userId;
              const url = builderUrl(p);
              return (
                <div
                  key={p.id}
                  className={`rounded-xl border p-5 ${isYou ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5' : 'border-white/10 bg-white/5'}`}
                >
                  <div className="mb-3 flex items-center gap-2">
                    {p.userImage ? (
                      <img src={p.userImage} alt={p.userName ?? ''} className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold uppercase">
                        {(p.userName ?? '?')[0]}
                      </div>
                    )}
                    <span className="truncate text-sm font-medium">
                      {p.userName ?? 'Unknown'}
                      {isYou && <span className="ml-1 text-xs text-gray-500">(you)</span>}
                    </span>
                  </div>
                  {p.heroImageUrl && (
                    <img
                      src={p.heroImageUrl}
                      alt={p.heroName ?? ''}
                      className="mb-3 h-32 w-full rounded-lg object-cover object-top"
                    />
                  )}
                  <div className="mb-1 font-semibold">{p.heroName}</div>
                  <div className="mb-3 flex flex-wrap gap-1">
                    {p.aspects.map((a) => (
                      <span
                        key={a}
                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium text-white ${ASPECT_BG[a] ?? 'bg-gray-700'}`}
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                  {isYou && url && (
                    <a
                      href={url}
                      className="block rounded-lg bg-[var(--color-primary)] px-4 py-2 text-center text-sm font-semibold hover:opacity-90"
                    >
                      Build Deck →
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          {isHost && (
            <div className="flex gap-2">
              <button
                onClick={() => handleStatusChange('drafting')}
                className="rounded-lg border border-white/20 bg-white/10 px-5 py-2 text-sm font-medium hover:bg-white/20"
              >
                ← Back to Draft
              </button>
              <button
                onClick={() => handleStatusChange('completed')}
                className="rounded-lg border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold hover:bg-white/20"
              >
                End Session
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Completed ── */}
      {session.status === 'completed' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
            <div className="mb-2 text-lg font-semibold">Session Complete</div>
            <p className="text-sm text-[var(--color-text-muted)]">Good luck out there!</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {session.participants.map((p) => (
              <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  {p.userImage ? (
                    <img src={p.userImage} alt={p.userName ?? ''} className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-bold uppercase">
                      {(p.userName ?? '?')[0]}
                    </div>
                  )}
                  <span className="truncate text-sm font-medium">{p.userName}</span>
                </div>
                {p.heroImageUrl && (
                  <img src={p.heroImageUrl} alt={p.heroName ?? ''} className="mb-2 h-24 w-full rounded object-cover object-top" />
                )}
                <div className="text-sm font-semibold">{p.heroName}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.aspects.map((a) => (
                    <span key={a} className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium text-white ${ASPECT_BG[a] ?? 'bg-gray-700'}`}>
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {isHost && (
            <div className="flex gap-2">
              <button
                onClick={() => handleStatusChange('building')}
                className="rounded-lg border border-white/20 bg-white/10 px-5 py-2 text-sm font-medium hover:bg-white/20"
              >
                ← Reopen Session
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-5 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete Session'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
