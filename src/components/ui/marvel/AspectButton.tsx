interface AspectButtonProps {
  aspect: string;
  isSelected: boolean;
  isRecommended?: boolean;
  recommendationReason?: string;
  onClick: () => void;
  className?: string;
}

export function AspectButton({
  aspect,
  isSelected,
  isRecommended,
  recommendationReason,
  onClick,
  className,
}: AspectButtonProps) {
  const key = aspect.toLowerCase();
  return (
    <button
      onClick={onClick}
      className={className}
      data-selected={isSelected}
      style={{ backgroundColor: `var(--color-aspect-${key})` }}
    >
      <span>{aspect}</span>
      {isRecommended && <span>Recommended</span>}
      {recommendationReason && <p>{recommendationReason}</p>}
    </button>
  );
}
