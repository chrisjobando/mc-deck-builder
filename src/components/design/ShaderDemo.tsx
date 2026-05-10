import { MeshGradient, meshGradientPresets } from '@paper-design/shaders-react';

export default function ShaderDemo() {
  const preset = meshGradientPresets[0]?.params ?? {};

  return (
    <div className="overflow-hidden rounded-xl border border-border/60">
      <MeshGradient {...preset} style={{ width: '100%', height: 220 }} />
    </div>
  );
}
