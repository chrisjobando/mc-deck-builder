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
    <div>
      <div>
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

    >
      {participant.userImage ? (
        <img
          src={participant.userImage}
          alt={participant.userName ?? ''}

        />
      ) : (
        <div>
          {(participant.userName ?? '?')[0]}
        </div>
      )}
      <div>
        <div>
          <span>{participant.userName ?? 'Unknown'}</span>
          {isYou && (
            <span>
              you
            </span>
          )}
        </div>
        {showPick && participant.heroCardId ? (
          <div>
            {participant.heroImageUrl && (
              <img
                src={participant.heroImageUrl}
                alt={participant.heroName ?? ''}

              />
            )}
            <span>
              {participant.heroName}
            </span>
            {participant.aspects.map((a) => (
              <span
                key={a}

                style={{ backgroundColor: `var(--color-aspect-${a.toLowerCase()})` }}
              >
                {a[0]}
              </span>
            ))}
          </div>
        ) : showPick ? (
          <div>Choosing…</div>
        ) : null}
      </div>
      {participant.isLocked && (
        <div title="Locked in">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
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
      <h3>Choose Hero</h3>
      <Input
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search heroes…"

      />
      <div>
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

            >
              {heroIdentity?.imageUrl && (
                <img
                  src={heroIdentity.imageUrl}
                  alt={hero.name}

                />
              )}
              <div>
                <div>{hero.name}</div>
                <div>{hero.health} HP</div>
              </div>
              {isDisabled && (
                <div>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p>No heroes found</p>
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
      <h3>
        Aspects {isMultiAspect ? '(pick 2)' : '(pick 1)'}
      </h3>
      <div>
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
      <div>
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
      <div>
        <a href="/sessions">
          ← Sessions
        </a>
        <h1>{session.name}</h1>
        <StatusBadge status={session.status} />
      </div>

      {/* ── Phase 1: Lobby ── */}
      {session.status === 'draft' && (
        <div>
          <div>
            <h2>
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

          <div>
            <h2>Waiting for players</h2>
            <p>
              Share your invite code so others can join. Once everyone's in, start the draft.
            </p>
            <div>
              <span>
                {session.inviteCode}
              </span>
              <button
                onClick={copyInviteCode}

              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            {isHost && (
              <Button onClick={() => handleStatusChange('drafting')}>
                Start Draft →
              </Button>
            )}
            {isHost && (
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={deleting}

              >
                {deleting ? 'Deleting…' : 'Delete Session'}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Phase 2: Draft ── */}
      {session.status === 'drafting' && (
        <div>
          {/* Roster */}
          <div>
            <h2>
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
              <div>
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
            <div>
              <h2>
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

              >
                {locking ? 'Locking in…' : 'Lock In'}
              </Button>
            </div>
          ) : (
            <div>
              <div>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <div>Locked in!</div>
                <div>
                  {myHero?.name}
                  {myAspects.length > 0 && ` · ${myAspects.join(', ')}`}
                </div>
              </div>
              <p>Waiting for others…</p>
              <Button variant="outline" onClick={handleUnlock} disabled={unlocking}>
                {unlocking ? 'Unlocking…' : 'Change Selection'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Phase 3: Build ── */}
      {session.status === 'building' && (
        <div>
          <p>
            Everyone's locked in — time to build! Open the builder with your hero pre-loaded.
          </p>
          <div>
            {session.participants.map((p) => {
              const isYou = p.userId === meta.userId;
              const url = builderUrl(p);
              return (
                <div
                  key={p.id}

                >
                  <div>
                    {p.userImage ? (
                      <img src={p.userImage} alt={p.userName ?? ''} />
                    ) : (
                      <div>
                        {(p.userName ?? '?')[0]}
                      </div>
                    )}
                    <span>
                      {p.userName ?? 'Unknown'}
                      {isYou && <span>(you)</span>}
                    </span>
                  </div>
                  {p.heroImageUrl && (
                    <img
                      src={p.heroImageUrl}
                      alt={p.heroName ?? ''}

                    />
                  )}
                  <div>{p.heroName}</div>
                  <div>
                    {p.aspects.map((a) => (
                      <span
                        key={a}

                        style={{ backgroundColor: `var(--color-aspect-${a.toLowerCase()})` }}
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                  {isYou && url && (
                    <Button asChild>
                      <a href={url}>Build Deck →</a>
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {isHost && (
            <div>
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
        <div>
          <div>
            <div>Session Complete</div>
            <p>Good luck out there!</p>
          </div>
          <div>
            {session.participants.map((p) => (
              <div key={p.id}>
                <div>
                  {p.userImage ? (
                    <img src={p.userImage} alt={p.userName ?? ''} />
                  ) : (
                    <div>
                      {(p.userName ?? '?')[0]}
                    </div>
                  )}
                  <span>{p.userName}</span>
                </div>
                {p.heroImageUrl && (
                  <img src={p.heroImageUrl} alt={p.heroName ?? ''} />
                )}
                <div>{p.heroName}</div>
                <div>
                  {p.aspects.map((a) => (
                    <span
                      key={a}

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
            <div>
              <Button variant="outline" onClick={() => handleStatusChange('building')}>
                ← Reopen Session
              </Button>
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={deleting}

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
