import PusherClient from 'pusher-js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AspectButton, StatusBadge } from '@/components/ui/marvel';
import type { LobbyParticipant, LobbySession } from '@/lib/sessions';
import { heroSlug, WARLOCK_ID } from '@/lib/utils';
import { showAlert, showConfirm } from '@/lib/dialog';

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
            <span className="truncate text-xs text-muted-foreground">
              {participant.heroName}
            </span>
            {participant.aspects.map((a) => (
              <span
                key={a}
                className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                style={{ backgroundColor: `var(--color-aspect-${a.toLowerCase()})` }}
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
      <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Choose Hero</h3>
      <Input
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search heroes…"
        className="mb-3"
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
                    ? 'border-primary bg-primary/20 ring-1 ring-primary'
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
      <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
        Aspects {isMultiAspect ? '(pick 2)' : '(pick 1)'}
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {ASPECTS.map((aspect) => (
          <AspectButton
            key={aspect}
            aspect={aspect}
            isSelected={selectedAspects.includes(aspect)}
            onClick={() => onToggle(aspect)}
          />
        ))}
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
    const confirmed = await showConfirm('This cannot be undone.', { title: 'Delete session?', confirmLabel: 'Delete', danger: true });
    if (!confirmed) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/sessions/${meta.code}`, { method: 'DELETE' });
      if (res.ok) {
        window.location.href = '/sessions';
      } else {
        await showAlert('Failed to delete session.');
        setDeleting(false);
      }
    } catch {
      await showAlert('Failed to delete session.');
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
        <a href="/sessions" className="text-sm text-muted-foreground hover:text-white">
          ← Sessions
        </a>
        <h1 className="text-2xl font-bold">{session.name}</h1>
        <StatusBadge status={session.status} />
      </div>

      {/* ── Phase 1: Lobby ── */}
      {session.status === 'draft' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
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
            <p className="mb-4 text-sm text-muted-foreground">
              Share your invite code so others can join. Once everyone's in, start the draft.
            </p>
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2">
              <span className="font-mono text-xl font-bold tracking-widest text-primary">
                {session.inviteCode}
              </span>
              <button
                onClick={copyInviteCode}
                className="ml-auto text-xs text-muted-foreground hover:text-white"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            {isHost && (
              <Button onClick={() => handleStatusChange('drafting')} className="w-full">
                Start Draft →
              </Button>
            )}
            {isHost && (
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={deleting}
                className="mt-2 w-full border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
              >
                {deleting ? 'Deleting…' : 'Delete Session'}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Phase 2: Draft ── */}
      {session.status === 'drafting' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Roster */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
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
                <Button variant="outline" onClick={() => handleStatusChange('draft')}>
                  ← Back to Lobby
                </Button>
                <Button
                  onClick={() => handleStatusChange('building')}
                  disabled={!allLocked}
                  title={!allLocked ? 'All players must lock in first' : undefined}
                >
                  Start Building →
                </Button>
              </div>
            )}
          </div>

          {/* My pick panel — hidden once locked */}
          {!myLocked ? (
            <div className="space-y-5 rounded-xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
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
              <Button
                onClick={handleLockIn}
                disabled={!myHeroId || myAspects.length === 0 || locking}
                className="w-full bg-green-600 hover:bg-green-500"
              >
                {locking ? 'Locking in…' : 'Lock In'}
              </Button>
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
              <Button variant="outline" onClick={handleUnlock} disabled={unlocking} className="mt-2">
                {unlocking ? 'Unlocking…' : 'Change Selection'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Phase 3: Build ── */}
      {session.status === 'building' && (
        <div className="space-y-6">
          <p className="text-muted-foreground">
            Everyone's locked in — time to build! Open the builder with your hero pre-loaded.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {session.participants.map((p) => {
              const isYou = p.userId === meta.userId;
              const url = builderUrl(p);
              return (
                <div
                  key={p.id}
                  className={`rounded-xl border p-5 ${isYou ? 'border-primary/40 bg-primary/5' : 'border-white/10 bg-white/5'}`}
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
                        className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                        style={{ backgroundColor: `var(--color-aspect-${a.toLowerCase()})` }}
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                  {isYou && url && (
                    <Button asChild className="w-full">
                      <a href={url}>Build Deck →</a>
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {isHost && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleStatusChange('drafting')}>
                ← Back to Draft
              </Button>
              <Button variant="outline" onClick={() => handleStatusChange('completed')}>
                End Session
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Completed ── */}
      {session.status === 'completed' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
            <div className="mb-2 text-lg font-semibold">Session Complete</div>
            <p className="text-sm text-muted-foreground">Good luck out there!</p>
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
                    <span
                      key={a}
                      className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                      style={{ backgroundColor: `var(--color-aspect-${a.toLowerCase()})` }}
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {isHost && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleStatusChange('building')}>
                ← Reopen Session
              </Button>
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={deleting}
                className="border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
              >
                {deleting ? 'Deleting…' : 'Delete Session'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
