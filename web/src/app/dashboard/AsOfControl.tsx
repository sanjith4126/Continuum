"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function AsOfControl() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentAsOf = searchParams.get("asOf") ?? "";
  const [value, setValue] = useState(currentAsOf);

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
    <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 shadow-sm">
      <span className="text-sm text-neutral-500">As of</span>
      <input
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => apply(value)}
        className="text-sm text-neutral-900 outline-none"
      />
      {currentAsOf && (
        <button
          onClick={() => {
            setValue("");
            apply("");
          }}
          className="text-xs text-neutral-400 hover:text-neutral-900"
        >
          Reset
        </button>
      )}
    </div>
  );
}
