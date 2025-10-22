import React from "react";
import type { Asset } from "../types";
import AssetCard from "./AssetCard";

type Props = {
  items: Asset[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};
export default function AssetList({ items, selectedId, onSelect }: Props) {
  if (items.length === 0) {
    return (
      <div
        style={{ padding: 16, border: "1px dashed #e5e7eb", borderRadius: 12 }}
      >
        No results
      </div>
    );
  }
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))",
        gap: 10,
      }}
    >
      {items.map((a) => (
        <AssetCard
          key={a.id}
          asset={a}
          selected={a.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
