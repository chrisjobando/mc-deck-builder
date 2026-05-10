interface StatBoxProps {
  value: string | number | null;
  label: string;
  color?: string;
  size?: 'xs' | 'md';
}

export function StatBox({ value, label }: StatBoxProps) {
  return (
    <div>
      <div>{value ?? '—'}</div>
      <div>{label}</div>
    </div>
  );
}
