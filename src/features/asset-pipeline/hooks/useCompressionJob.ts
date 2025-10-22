import { useCallback, useState, useTransition } from "react";
import type { LOD } from "../types";

export function useCompressionJob(onApply: (lod: LOD) => void) {
  const [progress, setProgress] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = useCallback(
    (next: LOD) => {
      setProgress(0);
      const timer = setInterval(
        () => setProgress((p) => Math.min((p ?? 0) + 12, 100)),
        120
      );
      startTransition(() => {
        setTimeout(() => {
          onApply(next);
          clearInterval(timer);
          setProgress(null);
        }, 1200);
      });
    },
    [onApply, startTransition]
  );

  return { run, progress, isPending };
}
