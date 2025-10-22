import React from "react";
import type { LOD } from "../types";

export default function LODSelect({
  value,
  onChange,
}: {
  value: LOD;
  onChange: (v: LOD) => void;
}) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 14 }}>LOD</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as LOD)}
        style={{
          padding: "4px 8px",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
        }}
      >
        <option value="HIGH">HIGH</option>
        <option value="MED">MED</option>
        <option value="LOW">LOW</option>
      </select>
    </label>
  );
}
