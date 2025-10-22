import React from "react";
import type { Asset } from "../types";
import { fmtMB } from "../lib/format";

export default function DetailsPanel({ asset }: { asset: Asset | null }) {
  if (!asset) return <div style={{ opacity: 0.6 }}>Select an asset</div>;
  return (
    <>
      <h3 style={{ margin: 0 }}>{asset.name}</h3>
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
        Category: {asset.category ?? "—"} • Polys:{" "}
        {asset.polyCount.toLocaleString()} • Size: {fmtMB(asset.sizeMB)}
      </div>
    </>
  );
}
