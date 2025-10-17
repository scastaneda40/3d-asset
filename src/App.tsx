import React, {
  useMemo,
  useReducer,
  useCallback,
  useTransition,
  useEffect,
  useState,
  Suspense,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ---- Types
type LOD = "HIGH" | "MED" | "LOW";
type Category = "film" | "character" | "environment" | "product";
type Asset = {
  id: string;
  name: string;
  polyCount: number;
  sizeMB: number;
  tags: string[];
  createdAt: string;
  shape: "box" | "sphere" | "torus" | "cylinder";
  color?: string;
  category?: Category;
  gltfUrl?: string;
};

// ---- Data
const INITIAL_ASSETS: Asset[] = [
  {
    id: "1",
    name: "Hero Shield",
    polyCount: 820_000,
    sizeMB: 180,
    tags: ["prop", "hero"],
    createdAt: "2025-09-01T12:00:00Z",
    shape: "cylinder",
    color: "#e11d48",
    category: "film",
  },
  {
    id: "2",
    name: "Explorer Helmet",
    polyCount: 1_350_000,
    sizeMB: 420,
    tags: ["helmet", "character"],
    createdAt: "2025-08-21T09:00:00Z",
    shape: "sphere",
    color: "#f59e0b",
    category: "character",
    gltfUrl: "/models/helmet.glb",
  },
  {
    id: "3",
    name: "City Billboard",
    polyCount: 240_000,
    sizeMB: 95,
    tags: ["environment", "marketing"],
    createdAt: "2025-07-15T17:30:00Z",
    shape: "box",
    color: "#6366f1",
    category: "environment",
  },
  {
    id: "4",
    name: "Studio Lamp",
    polyCount: 300_000,
    sizeMB: 120,
    tags: ["prop", "lighting"],
    createdAt: "2025-05-25T08:00:00Z",
    shape: "torus",
    color: "#fbbf24",
    category: "product",
  },
];

// ---- Utils
function fmtMB(n: number) {
  return `${Math.round(n)} MB`;
}

function simulateCompression(a: Asset, lod: LOD): Asset {
  const lodFactor = lod === "HIGH" ? 0.7 : lod === "MED" ? 0.4 : 0.2;
  const textureFactor = lod === "HIGH" ? 0.8 : lod === "MED" ? 0.5 : 0.25;
  return {
    ...a,
    polyCount: Math.max(10_000, Math.round(a.polyCount * lodFactor)),
    sizeMB: Math.max(20, Math.round(a.sizeMB * textureFactor)),
  };
}

// ---- Reducer
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
      const i = state.assets.findIndex((a) => a.id === state.selectedId);
      if (i === -1) return state;
      const updated = simulateCompression(state.assets[i], action.lod);
      const assets = state.assets.slice();
      assets[i] = updated;
      return { ...state, assets };
    }
    default:
      return state;
  }
}

// ---- Hooks
function useWindowSize() {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  useEffect(() => {
    const on = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return size;
}

// ---- Components
function AssetMesh({
  lod,
  shape,
  color,
}: {
  lod: LOD;
  shape: Asset["shape"];
  color?: string;
}) {
  const segments = lod === "HIGH" ? 48 : lod === "MED" ? 24 : 12;
  const mat = <meshStandardMaterial color={color} />;

  if (shape === "sphere") {
    return (
      <mesh>
        <sphereGeometry args={[0.9, segments, segments]} />
        {mat}
      </mesh>
    );
  }
  if (shape === "torus") {
    return (
      <mesh>
        <torusGeometry args={[0.8, 0.25, segments, segments]} />
        {mat}
      </mesh>
    );
  }
  if (shape === "cylinder") {
    return (
      <mesh>
        <cylinderGeometry args={[0.5, 0.5, 1.5, segments]} />
        {mat}
      </mesh>
    );
  }
  return (
    <mesh>
      <boxGeometry args={[1.5, 1, 0.5, segments, segments, segments]} />
      {mat}
    </mesh>
  );
}

function GLTFAsset({ url }: { url: string }) {
  const { scene } = useGLTF(url);

  // Compute bounding box to normalize scale
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  // Center model so it's not offset in space
  scene.position.sub(center);

  // Normalize to similar size as other procedural assets
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 1.5 / maxDim;

  return <primitive object={scene} scale={scale} />;
}
// ---- Spinner overlay
function LoadingOverlay() {
  return (
    <Html center>
      <div
        style={{
          width: 32,
          height: 32,
          border: "3px solid #e5e7eb",
          borderTopColor: "#6b7280",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Html>
  );
}

// ---- Viewer
function Viewer({ lod, asset }: { lod: LOD; asset: Asset | null }) {
  return (
    <div
      style={{
        width: "100%",
        height: 360,
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <Canvas camera={{ position: [2.5, 1.5, 3.5] }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 3, 3]} intensity={0.9} />
        <OrbitControls enableDamping makeDefault />

        {asset?.gltfUrl ? (
          <Suspense fallback={<LoadingOverlay />}>
            <GLTFAsset url={asset.gltfUrl} />
          </Suspense>
        ) : (
          asset && (
            <AssetMesh
              lod={lod}
              shape={asset.shape}
              color={asset.color ?? "#9ca3af"}
            />
          )
        )}
      </Canvas>
    </div>
  );
}

// ---- App
export default function App() {
  const [{ assets, selectedId, filter, lod }, dispatch] = useReducer(reducer, {
    assets: INITIAL_ASSETS,
    selectedId: INITIAL_ASSETS[0].id,
    filter: "",
    lod: "HIGH" as LOD,
  });

  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState<number | null>(null);
  const { width } = useWindowSize();

  const onSelect = useCallback(
    (id: string) => dispatch({ type: "select", id }),
    []
  );

  const onFilter: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    (e) => {
      dispatch({ type: "filter", q: e.target.value });
    },
    []
  );

  const selected = useMemo(
    () => assets.find((a) => a.id === selectedId) ?? null,
    [assets, selectedId]
  );

  const compress = useCallback(
    (next: LOD) => {
      setProgress(0);
      const timer = setInterval(() => {
        setProgress((p) => {
          const step = (p ?? 0) + 12;
          return step >= 100 ? 100 : step;
        });
      }, 120);

      startTransition(() => {
        setTimeout(() => {
          dispatch({ type: "set_lod", lod: next });
          dispatch({ type: "compress_selected", lod: next });
          clearInterval(timer);
          setProgress(null);
        }, 1200);
      });
    },
    [startTransition]
  );

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
        {/* Left: Asset Browser */}
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
            onChange={onFilter}
            placeholder="Search assets…"
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              marginBottom: 8,
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {assets
              .filter((a) => {
                const q = filter.trim().toLowerCase();
                return (
                  !q ||
                  a.name.toLowerCase().includes(q) ||
                  a.tags.some((t) => t.includes(q)) ||
                  (a.category && a.category.includes(q as Category))
                );
              })
              .map((a) => (
                <button
                  key={a.id}
                  onClick={() => onSelect(a.id)}
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    borderRadius: 12,
                    border:
                      a.id === selectedId
                        ? "1px solid #111"
                        : "1px solid #e5e7eb",
                    background: a.id === selectedId ? "#f3f4f6" : "white",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{a.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {a.polyCount.toLocaleString()} tris • {fmtMB(a.sizeMB)}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.75 }}>
                    Category: {a.category ?? "—"} • {a.tags.join(", ")}
                  </div>
                </button>
              ))}
          </div>
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
            <div>
              <div style={{ fontWeight: 600 }}>
                {selected?.name ?? "Select an asset"}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Category: {selected?.category ?? "—"} • Polys:{" "}
                {selected?.polyCount.toLocaleString()} • Size:{" "}
                {selected ? fmtMB(selected.sizeMB) : "—"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 14 }}>LOD</label>
              <select
                value={lod}
                onChange={(e) => compress(e.target.value as LOD)}
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

              {progress !== null ? (
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
                    style={{
                      width: `${progress}%`,
                      height: "100%",
                      background: "#10b981",
                    }}
                  />
                </div>
              ) : isPending ? (
                <span style={{ fontSize: 12, opacity: 0.6 }}>compressing…</span>
              ) : null}
            </div>
          </div>

          <Viewer lod={lod} asset={selected} />

          <div style={{ fontSize: 12, opacity: 0.7 }}>
            * Simulated pipeline: UI triggers a compression job, shows progress,
            then updates LOD (poly/size). In production this would call a
            backend queue (e.g., Lambda) and stream status; shapes/colors act as
            lightweight proxies for real GLTF models and categories.
          </div>
        </div>
      </div>
    </div>
  );
}
