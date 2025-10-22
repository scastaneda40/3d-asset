import React from "react";
import type { Asset } from "../types";
import { fmtMB } from "../lib/format";

type Props = {
  asset: Asset;
  selected: boolean;
  onSelect: (id: string) => void;
};
export default function AssetCard({ asset, selected, onSelect }: Props) {
  return (
    <button
      onClick={() => onSelect(asset.id)}
      aria-pressed={selected}
      style={{
        textAlign: "left",
        padding: "8px 12px",
        borderRadius: 12,
        border: selected ? "1px solid #111" : "1px solid #e5e7eb",
        background: selected ? "#f3f4f6" : "white",
        width: "100%",
      }}
    >
      <strong>{asset.name}</strong>
      <div style={{ fontSize: 12, opacity: 0.7 }}>
        {asset.polyCount.toLocaleString()} tris • {fmtMB(asset.sizeMB)}
      </div>
      <div style={{ fontSize: 11, opacity: 0.75 }}>
        Category: {asset.category ?? "—"} • {asset.tags.join(", ")}
      </div>
    </button>
  );
}
