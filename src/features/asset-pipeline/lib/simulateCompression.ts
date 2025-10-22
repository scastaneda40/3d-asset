import type { Asset, LOD } from "../types";

export function simulateCompression(a: Asset, lod: LOD): Asset {
  const lodFactor = lod === "HIGH" ? 0.7 : lod === "MED" ? 0.4 : 0.2;
  const texFactor = lod === "HIGH" ? 0.8 : lod === "MED" ? 0.5 : 0.25;
  return {
    ...a,
    polyCount: Math.max(10_000, Math.round(a.polyCount * lodFactor)),
    sizeMB: Math.max(20, Math.round(a.sizeMB * texFactor)),
  };
}
