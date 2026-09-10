const TONE_CLASSES = {
  profit: "bg-(--color-profit-100) text-(--color-profit-600) border-(--color-profit-600)/20",
  loss: "bg-(--color-loss-100) text-(--color-loss-600) border-(--color-loss-600)/20",
  warn: "bg-(--color-warn-100) text-(--color-warn-600) border-(--color-warn-600)/20",
  neutral:
    "bg-(--color-surface-container-low) text-(--color-on-surface-variant) border-(--color-outline-variant)",
} as const;

export function StatusChip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONE_CLASSES;
}) {
  return (
    <span
      className={
        "inline-flex h-5 items-center rounded px-1.5 font-(family-name:--font-data) text-[11px] font-medium border " +
        TONE_CLASSES[tone]
      }
    >
      {children}
    </span>
  );
}
