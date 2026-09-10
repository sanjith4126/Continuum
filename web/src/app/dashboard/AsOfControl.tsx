"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function AsOfControl() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentAsOf = searchParams.get("asOf") ?? "";

  function apply(nextValue: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextValue) {
      params.set("asOf", nextValue);
    } else {
      params.delete("asOf");
    }
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <div className="flex h-8 items-center gap-2 rounded-md border border-(--color-outline-variant) bg-(--color-surface-container-lowest) px-2.5">
      <span className="text-[12px] text-(--color-outline)">As of</span>
      <input
        type="date"
        aria-label="Historical date"
        value={currentAsOf}
        onChange={(e) => apply(e.target.value)}
        className="bg-transparent font-(family-name:--font-data) text-[12px] text-(--color-on-surface) outline-none"
      />
      {currentAsOf && (
        <button
          onClick={() => {
            apply("");
          }}
          className="text-[11px] text-(--color-accent-500) hover:underline"
        >
          Reset
        </button>
      )}
    </div>
  );
}
