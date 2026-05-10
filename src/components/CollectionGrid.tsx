import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PackType } from '@/lib/packs';
import { ALL_PACKS, ALWAYS_OWNED_CODES, CYCLES } from '@/lib/packs';

interface Props {
  initialOwned: string[];
}

const SAVE_LABELS: Record<SaveState, string> = {
  saving: 'Saving…',
  saved: 'Saved!',
  error: 'Error — try again',
  idle: 'Unsaved changes',
};

const COLUMN_LABELS: Record<PackType, string> = {
  expansion: 'Expansion',
  hero_pack: 'Hero Packs',
  scenario: 'Scenarios',
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function ProgressPill({ owned, total }: { owned: number; total: number }) {
  const complete = owned === total;
  return (
    <Badge
      variant="outline"

    >
      {owned} / {total}
    </Badge>
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

  const saveLabel = SAVE_LABELS[saveState];

  return (
    <>
      {/* Total progress */}
      <div>
        <div>
          <span>Total collection</span>
          <span>
            {totalOwned} / {totalPacks}
          </span>
        </div>
        <div>
          <div

            style={{ width: `${(totalOwned / totalPacks) * 100}%` }}
          />
        </div>
      </div>

      <div>
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
              <div>
                <h2>{cycle.name}</h2>
                <ProgressPill owned={cycleOwned} total={cycleTotal} />
                <Button
                  variant="link"
                  size="sm"

                  onClick={() => selectAllInCycle(cycle.number, !allSelected)}
                >
                  {allSelected ? 'Deselect all' : 'Select all'}
                </Button>
              </div>
              <div>
                {columns.map(col => (
                  <div key={col.label}>
                    <h3>
                      {col.label}
                    </h3>
                    <ul>
                      {col.packs.map(pack => {
                        const alwaysOwned = ALWAYS_OWNED_CODES.has(pack.code);
                        const isOwned = alwaysOwned || owned.has(pack.code);
                        return (
                          <li key={pack.code}>
                            <label

                            >
                              <input
                                type="checkbox"

                                checked={isOwned}
                                disabled={alwaysOwned}
                                onChange={e => toggle(pack.code, e.target.checked)}
                              />
                              <span>{pack.name}</span>
                              {alwaysOwned && (
                                <span>always</span>
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

      {/* Floating save bar */}
      <div

        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div>
          <span>{saveLabel}</span>
          <Button
            onClick={handleSave}
            disabled={saveState === 'saving'}
            size="sm"
          >
            Save
          </Button>
        </div>
      </div>
    </>
  );
}
