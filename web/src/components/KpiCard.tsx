export function KpiCard({
  label,
  value,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
  icon?: React.ReactNode;
}) {
  const toneClass =
    tone === "positive"
      ? "text-(--color-profit-600)"
      : tone === "negative"
        ? "text-(--color-loss-600)"
        : "text-(--color-on-surface)";

  const borderClass =
    tone === "positive"
      ? "border-(--color-profit-600)/30"
      : "border-(--color-outline-variant)";

  return (
    <div
      className={`rounded-lg border bg-(--color-surface-container-lowest) p-4 ${borderClass}`}
    >
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-medium uppercase tracking-wide text-(--color-outline)">
          {label}
        </div>
        {icon}
      </div>
      <div
        className={`mt-2 font-(family-name:--font-data) text-[20px] font-semibold ${toneClass}`}
      >
        {value}
      </div>
    </div>
  );
}
