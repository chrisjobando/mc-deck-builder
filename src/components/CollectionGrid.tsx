import { useMemo, useState } from 'react';
import type { PackType } from '../lib/packs';
import { ALL_PACKS, ALWAYS_OWNED_CODES, CYCLES } from '../lib/packs';

interface Props {
  initialOwned: string[];
}

const COLUMN_LABELS: Record<PackType, string> = {
  expansion: 'Expansion',
  hero_pack: 'Hero Packs',
  scenario: 'Scenarios',
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function ProgressPill({ owned, total }: { owned: number; total: number }) {
  const complete = owned === total;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
        complete ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-[var(--color-text-muted)]'
      }`}
    >
      {owned} / {total}
    </span>
  );
}

export default function CollectionGrid({ initialOwned }: Props) {
  const [owned, setOwned] = useState<Set<string>>(new Set(initialOwned));
  const [saved, setSaved] = useState<Set<string>>(new Set(initialOwned));
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const totalPacks = ALL_PACKS.length;
  const totalOwned = useMemo(
    () => ALL_PACKS.filter(p => ALWAYS_OWNED_CODES.has(p.code) || owned.has(p.code)).length,
    [owned]
  );

  const dirty = useMemo(() => {
    if (owned.size !== saved.size) return true;
    for (const code of owned) if (!saved.has(code)) return true;
    return false;
  }, [owned, saved]);

  const toggle = (code: string, checked: boolean) => {
    setOwned(prev => {
      const next = new Set(prev);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
    setSaveState('idle');
  };

  const selectAllInCycle = (cycleNumber: number, select: boolean) => {
    const cycle = CYCLES.find(c => c.number === cycleNumber);
    if (!cycle) return;
    const toggleable = cycle.packs.filter(p => !ALWAYS_OWNED_CODES.has(p.code)).map(p => p.code);
    setOwned(prev => {
      const next = new Set(prev);
      toggleable.forEach(code => (select ? next.add(code) : next.delete(code)));
      return next;
    });
    setSaveState('idle');
  };

  const handleSave = async () => {
    setSaveState('saving');
    try {
      const res = await fetch('/api/user/collection', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([...owned]),
      });
      if (!res.ok) throw new Error();
      setSaved(new Set(owned));
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1500);
    } catch {
      setSaveState('error');
    }
  };

  const saveLabel =
    saveState === 'saving' ? 'Saving…' :
    saveState === 'saved' ? 'Saved!' :
    saveState === 'error' ? 'Error — try again' :
    'Unsaved changes';

  return (
    <>
      {/* Total progress + save button */}
      <div className="mb-8 rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">Total collection</span>
          <span className="text-sm tabular-nums text-[var(--color-text-muted)]">
            {totalOwned} / {totalPacks}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300"
            style={{ width: `${(totalOwned / totalPacks) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-8">
        {CYCLES.map(cycle => {
          const toggleablePacks = cycle.packs.filter(p => !ALWAYS_OWNED_CODES.has(p.code));
          const cycleTotal = cycle.packs.length;
          const cycleOwned = cycle.packs.filter(
            p => ALWAYS_OWNED_CODES.has(p.code) || owned.has(p.code)
          ).length;
          const allSelected = toggleablePacks.every(p => owned.has(p.code));

          const columns = (['expansion', 'hero_pack', 'scenario'] as PackType[])
            .map(type => ({ label: COLUMN_LABELS[type], packs: cycle.packs.filter(p => p.type === type) }))
            .filter(col => col.packs.length > 0);

          return (
            <section key={cycle.number}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-lg font-semibold text-[var(--color-text-muted)]">{cycle.name}</h2>
                <ProgressPill owned={cycleOwned} total={cycleTotal} />
                <button
                  onClick={() => selectAllInCycle(cycle.number, !allSelected)}
                  className="ml-auto text-xs text-[var(--color-text-muted)] underline-offset-2 hover:text-[var(--color-text)] hover:underline"
                >
                  {allSelected ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {columns.map(col => (
                  <div key={col.label} className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                      {col.label}
                    </h3>
                    <ul className="space-y-2">
                      {col.packs.map(pack => {
                        const alwaysOwned = ALWAYS_OWNED_CODES.has(pack.code);
                        const isOwned = alwaysOwned || owned.has(pack.code);
                        return (
                          <li key={pack.code}>
                            <label
                              className={`flex cursor-pointer items-center gap-3 rounded px-1 py-1 transition hover:bg-white/5 ${alwaysOwned ? 'cursor-default opacity-60' : ''}`}
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-[var(--color-primary)]"
                                checked={isOwned}
                                disabled={alwaysOwned}
                                onChange={e => toggle(pack.code, e.target.checked)}
                              />
                              <span className="text-sm">{pack.name}</span>
                              {alwaysOwned && (
                                <span className="ml-auto text-xs text-[var(--color-text-muted)]">always</span>
                              )}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div
        className={`fixed bottom-0 left-0 right-0 flex items-center justify-center p-4 transition-all duration-200 ${dirty ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
      >
        <div className="flex items-center gap-4 rounded-xl border border-white/20 bg-[var(--color-surface,#1e1e2e)] px-6 py-3 shadow-2xl">
          <span className="w-36 text-sm text-[var(--color-text-muted)]">{saveLabel}</span>
          <button
            onClick={handleSave}
            disabled={saveState === 'saving'}
            className="w-16 rounded-lg bg-[var(--color-primary)] py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </>
  );
}
