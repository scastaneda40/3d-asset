import { useMemo } from "react";
import type { Asset } from "../types";

export function useAssetFilterSort(
  assets: Asset[],
  query: string,
  sortKey: "name" | "polyCount" | "createdAt",
  dir: "asc" | "desc"
) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q)) ||
        (a.category && a.category.toLowerCase().includes(q))
    );
  }, [assets, query]);

  const list = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const byName = () =>
        dir === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      const byPoly = () =>
        dir === "asc" ? a.polyCount - b.polyCount : b.polyCount - a.polyCount;
      const byDate = () => {
        const ta = Date.parse(a.createdAt),
          tb = Date.parse(b.createdAt);
        return dir === "asc" ? ta - tb : tb - ta;
      };
      if (sortKey === "name") return byName();
      if (sortKey === "polyCount") return byPoly();
      return byDate();
    });
    return arr;
  }, [filtered, sortKey, dir]);

  return { filtered, list };
}
