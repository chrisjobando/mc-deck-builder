import { BorderBeam } from 'border-beam';

export default function BorderBeamDemo() {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <BorderBeam colorVariant="colorful" theme="dark">
        <div className="rounded-xl bg-card p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Colorful
          </div>
          <div className="mt-2 text-lg font-semibold">Featured deck</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Animated rainbow border for hero callouts.
          </p>
        </div>
      </BorderBeam>

      <BorderBeam colorVariant="ocean" theme="dark">
        <div className="rounded-xl bg-card p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Ocean
          </div>
          <div className="mt-2 text-lg font-semibold">Cool palette</div>
          <p className="mt-1 text-sm text-muted-foreground">Blue / purple beam variant.</p>
        </div>
      </BorderBeam>
    </div>
  );
}
