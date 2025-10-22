import React from "react";
export default function ProgressBar({ value }: { value: number }) {
  return (
    <div
      style={{
        width: 120,
        height: 6,
        background: "#eee",
        borderRadius: 999,
        overflow: "hidden",
      }}
    >
      <div
        style={{ width: `${value}%`, height: "100%", background: "#10b981" }}
      />
    </div>
  );
}
