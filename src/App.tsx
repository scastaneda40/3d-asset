import React, { useMemo, useReducer, useCallback } from "react";
import { INITIAL_ASSETS } from "./features/asset-pipeline/data";
import type { Asset, LOD } from "./features/asset-pipeline/types";
import { simulateCompression } from "./features/asset-pipeline/lib/simulateCompression";

import { useWindowSize } from "./features/asset-pipeline/hooks/useWindowSize";
import { useAssetFilterSort } from "./features/asset-pipeline/hooks/useAssetFilterSort";
import { useCompressionJob } from "./features/asset-pipeline/hooks/useCompressionJob";

import AssetList from "./features/asset-pipeline/components/AssetList";
import DetailsPanel from "./features/asset-pipeline/components/DetailsPanel";
import LODSelect from "./features/asset-pipeline/components/LODSelect";
import ProgressBar from "./features/asset-pipeline/components/ProgressBar";
import Viewer from "./features/asset-pipeline/Viewer/Viewer";

// reducer (kept local to feature for brevity)
type State = {
  assets: Asset[];
  selectedId: string | null;
  filter: string;
  lod: LOD;
};
type Action =
  | { type: "select"; id: string }
  | { type: "filter"; q: string }
  | { type: "set_lod"; lod: LOD }
  | { type: "compress_selected"; lod: LOD };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "select":
      return { ...state, selectedId: action.id };
    case "filter":
      return { ...state, filter: action.q };
    case "set_lod":
      return { ...state, lod: action.lod };
    case "compress_selected": {
      if (!state.selectedId) return state;
      const idx = state.assets.findIndex((a) => a.id === state.selectedId);
      if (idx === -1) return state;
      const next = simulateCompression(state.assets[idx], action.lod);
      const assets = state.assets.slice();
      assets[idx] = next;
      return { ...state, assets };
    }
    default:
      return state;
  }
}

export default function App() {
  const [{ assets, selectedId, filter, lod }, dispatch] = useReducer(reducer, {
    assets: INITIAL_ASSETS,
    selectedId: INITIAL_ASSETS[0].id,
    filter: "",
    lod: "HIGH" as LOD,
  });
  const { width } = useWindowSize();

  const { list } = useAssetFilterSort(assets, filter, "name", "asc");
  const selected = useMemo(
    () => list.find((a) => a.id === selectedId) ?? null,
    [list, selectedId]
  );

  const applyLOD = useCallback((next: LOD) => {
    dispatch({ type: "set_lod", lod: next });
    dispatch({ type: "compress_selected", lod: next });
  }, []);
  const {
    run: runCompression,
    progress,
    isPending,
  } = useCompressionJob(applyLOD);

  return (
    <div
      style={{
        padding: 16,
        maxWidth: 1200,
        margin: "0 auto",
        display: "grid",
        gap: 16,
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ fontWeight: 700 }}>3D Asset Pipeline Demo</h1>
        <div style={{ opacity: 0.7, fontSize: 14 }}>Viewport: {width}px</div>
      </header>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 2fr" }}>
        {/* Left: Browser */}
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 12,
            background: "white",
          }}
        >
          <input
            value={filter}
            onChange={(e) => dispatch({ type: "filter", q: e.target.value })}
            placeholder="Search assets…"
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              marginBottom: 8,
            }}
          />
          <AssetList
            items={list}
            selectedId={selectedId}
            onSelect={(id) => dispatch({ type: "select", id })}
          />
        </div>

        {/* Right: Details + Viewer */}
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 12,
            background: "white",
            display: "grid",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <DetailsPanel asset={selected} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <LODSelect value={lod} onChange={(v) => runCompression(v)} />
              {progress !== null ? (
                <ProgressBar value={progress} />
              ) : isPending ? (
                <span style={{ fontSize: 12, opacity: 0.6 }}>compressing…</span>
              ) : null}
            </div>
          </div>

          <Viewer lod={lod} asset={selected} />

          <div style={{ fontSize: 12, opacity: 0.7 }}>
            * Simulated compression pipeline → would call a backend (e.g.,
            Lambda) to decimate geometry & update artifacts asynchronously.
          </div>
        </div>
      </div>
    </div>
  );
}
