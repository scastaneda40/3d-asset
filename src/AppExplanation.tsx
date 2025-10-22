/*
================================================================================
App.tsx — Disney Immersive Front‑End Demo (Senior‑Level, Ultra‑Commented)
================================================================================
Goal
----
Demonstrate senior‑level command of React + TypeScript in an immersive/3D UI
context (Three.js via @react-three/fiber + drei). Comments are intentionally
excessive to narrate architectural intent, trade‑offs, performance concerns,
accessibility, testing hooks, and how this maps to a studio pipeline (VFX/Prod).

High‑Level Design
-----------------
- Present a tiny “3D asset pipeline” viewer. Assets can be browsed, filtered,
  previewed in 3D, and “compressed” by LOD to simulate decimation/texture downsizing.
- Keep data local and deterministic so stakeholders can evaluate the UI/UX and
  state updates without backend dependencies.
- Showcase production‑ready patterns: useReducer (predictable transitions),
  Suspense for async GLTF loads, memoized selectors, stable callbacks,
  concurrency (useTransition) for responsiveness, and immutability for clarity.

Why these choices?
- useReducer: Centralizes all state transitions → easier PR review, safer under
  concurrency, trivial to unit test reducers/actions.
- Suspense + drei: Clean async boundaries around GLTF loading with an inline
  fallback overlay so the rest of the UI remains interactive.
- Procedural meshes: Lightweight stand‑ins that render instantly; avoids blocking
  the demo on real model availability. GLTF path proves interoperability.
- LOD concept: Communicates performance budgets to non‑engineer stakeholders
  (artists, producers) while giving a hook for future server jobs / queues.
================================================================================
*/

// -------------------------------- React & Hooks ------------------------------
import React, {
  useMemo, // Derive stable values (e.g. selected asset) w/o re‑scanning arrays.
  useReducer, // Predictable state machine for UI; avoids scattered setState.
  useCallback, // Stable function identities → prevents child re‑renders.
  useTransition, // Concurrency primitive: mark state updates as "not urgent".
  useEffect, // Side effects (subscriptions, DOM listeners).
  useState, // Local component state for simple, ephemeral UI values.
  Suspense, // Declaratively wrap async GLTF loading with fallback UI.
} from "react";

// ------------------------------ 3D / Immersive -------------------------------
import { Canvas, useFrame } from "@react-three/fiber"; // Declarative React renderer over Three.js.
import { OrbitControls, Html, useGLTF } from "@react-three/drei"; // Drei = helpers: camera controls, HTML overlays, GLTF loader, etc.
import * as THREE from "three"; // Direct Three.js API for bounding boxes, vectors, etc.

// Example of structured modularity for 3D primitives (not used below, illustrative).

// ---------------------------------- Types -----------------------------------
// Strong typing makes contracts self‑documenting and reduces miscommunication
// between FE, pipeline tooling, and backend schemas.

type LOD = "HIGH" | "MED" | "LOW"; // Discriminated enum used in actions + UI.

type Category = "film" | "character" | "environment" | "product"; // Filter/search facets.

// Asset metadata mirrors the sort of descriptors Pipelines/VFX track in DBs.
// Optional fields (gltfUrl/color/category) demonstrate progressive enhancement.
// In production, a shared schema (zod/io‑ts) across FE/BE keeps types in sync.

type Asset = {
  id: string; // Stable unique id → keying, updates, analytics.
  name: string; // Human‑readable label for browsers/reviews.
  polyCount: number; // Triangle count — key perf metric for budgets.
  sizeMB: number; // Approx binary footprint — informs streaming/IO.
  tags: string[]; // Quick search facets for producers/artists.
  createdAt: string; // ISO for audit/sorting.
  shape: "box" | "sphere" | "torus" | "cylinder"; // Procedural fallback.
  color?: string; // Visual differentiation for procedurals.
  category?: Category; // Optional for faceted filtering.
  gltfUrl?: string; // If present, prefer real model → Suspense load.
};

// ---------------------------------- Data ------------------------------------
// Local seed data: keeps demo portable and deterministic.
// In production, assets would be fetched (SWR/React Query), cached, and
// normalized. This shape intentionally resembles what a Postgres/Prisma table
// might expose so the move to API is straightforward.

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
    gltfUrl: "/models/helmet.glb", // Demonstrates async model ingestion.
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

// --------------------------------- Utils ------------------------------------
// Small helpers are pure & deterministic to keep reducers testable and PR‑friendly.

function fmtMB(n: number) {
  return `${Math.round(n)} MB`;
}

/**
 * simulateCompression
 * -------------------
 * Pure function that models how a server‑side job might decimate geometry and
 * compress textures for different LODs. The function never mutates input (it
 * clones via spread) and clamps to reasonable floors to avoid degenerate models.
 *
 * In production:
 * - This would be a job dispatched to a queue (e.g., SQS/Lambda/AWS Batch).
 * - FE would poll/subscribe (SSE/WebSocket) for progress updates and then
 *   reconcile the final asset snapshot.
 */
function simulateCompression(a: Asset, lod: LOD): Asset {
  // Geometry decimation factors chosen to be visually obvious in demo.
  const lodFactor = lod === "HIGH" ? 0.7 : lod === "MED" ? 0.4 : 0.2;
  // Texture compression proxy; would track texel density/atlas size IRL.
  const textureFactor = lod === "HIGH" ? 0.8 : lod === "MED" ? 0.5 : 0.25;

  return {
    ...a, // immutability: return a new object so React can detect reference change
    polyCount: Math.max(10_000, Math.round(a.polyCount * lodFactor)),
    sizeMB: Math.max(20, Math.round(a.sizeMB * textureFactor)),
  };
}

// ------------------------------- State Model --------------------------------
// Centralize state transitions in a reducer for predictability and testing.
// This enables exhaustive switch checks and keeps event→state logic explicit.

type State = {
  assets: Asset[]; // Source of truth for list + selected details.
  selectedId: string | null; // Active asset id for detail/viewer.
  filter: string; // Free‑text filter across name/tags/category.
  lod: LOD; // Global LOD that drives preview geometry density.
};

type Action =
  | { type: "select"; id: string }
  | { type: "filter"; q: string }
  | { type: "set_lod"; lod: LOD }
  | { type: "compress_selected"; lod: LOD };

/**
 * reducer
 * -------
 * All state transitions are pure (no side effects, no mutation). Returning
 * new object references is non‑negotiable so React can re‑render reliably.
 */
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "select":
      // Update selection; everything else remains stable (structural sharing).
      return { ...state, selectedId: action.id };

    case "filter":
      // Keep filter logic centralized so future facets (polyCount ranges, tags)
      // can be integrated without scattering setState calls across components.
      return { ...state, filter: action.q };

    case "set_lod":
      // The viewer reads this to adjust segment counts/quality.
      return { ...state, lod: action.lod };

    case "compress_selected": {
      // Guard: no-op if nothing is selected.
      if (!state.selectedId) return state;

      // Find index once; O(n) over small lists is fine here. For larger data,
      // a Map<id, index> or normalized entity store would be preferable.
      const i = state.assets.findIndex((a) => a.id === state.selectedId);
      if (i === -1) return state; // Defensive: selection may be stale.

      // Compute updated model (pure), then immutably replace the array slot.
      const updated = simulateCompression(state.assets[i], action.lod);
      const assets = state.assets.slice(); // shallow clone → new ref
      assets[i] = updated; // safe positional write into clone

      return { ...state, assets };
    }

    default:
      // With a discriminated Action union, TS ensures we don’t miss cases.
      // Returning state preserves safety in face of unexpected inputs.
      return state;
  }
}

// --------------------------------- Hooks ------------------------------------
// Example responsive utility; demonstrates effect cleanup and SSR notes.

function useWindowSize() {
  // NOTE: In SSR contexts, guard window access (typeof window !== 'undefined').
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const on = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on); // Cleanup avoids leaks.
  }, []);

  return size;
}

// ------------------------------ 3D Components -------------------------------
// AssetMesh
// ---------
// Procedural geometry as a fast fallback when we don’t have a GLTF. The LOD
// controls segment density — a concrete demonstration that LOD impacts CPU/GPU
// workload and thus frame time. Material is intentionally simple.

function AssetMesh({
  lod,
  shape,
  color,
}: {
  lod: LOD;
  shape: Asset["shape"];
  color?: string;
}) {
  // Segment counts scale with LOD; in larger apps we’d tie this to budget tables.
  const segments = lod === "HIGH" ? 48 : lod === "MED" ? 24 : 12;
  const mat = <meshStandardMaterial color={color} />; // PBR‑ish basic lighting.

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
  // Default: box
  return (
    <mesh>
      <boxGeometry args={[1.5, 1, 0.5, segments, segments, segments]} />
      {mat}
    </mesh>
  );
}

// GLTFAsset
// ---------
// Loads an external GLTF scene and normalizes it so all assets present with
// similar scale/origin. This reduces surprises when assets are exported from
// DCCs (Blender/Maya) with arbitrary transforms.
function GLTFAsset({ url }: { url: string }) {
  // useGLTF caches under the hood; repeated mounts avoid refetch when possible.
  const { scene } = useGLTF(url);

  // Compute axis‑aligned bounding box and center of geometry.
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  // Recenter so models don’t orbit around odd pivots under OrbitControls.
  scene.position.sub(center);

  // Normalize scale so different assets frame similarly in the viewer.
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 1.5 / maxDim; // Fit target box ~1.5 units.

  return <primitive object={scene} scale={scale} />;
}

// LoadingOverlay
// --------------
// Minimal spinner rendered using <Html> to keep it legible in 3D space while
// the GLTF is loading inside a Suspense boundary. Non‑blocking — camera works.
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

// Viewer
// ------
// Encapsulates the 3D scene. The camera/lighting are intentionally simple;
// the aim is to keep cognitive load low so the focus remains on data flow and
// async asset handling. OrbitControls damping is enabled for a polished feel.
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
        {/* Lighting: ambient for base visibility + directional for simple shading. */}
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 3, 3]} intensity={0.9} />

        {/* Interaction: OrbitControls gives predictable review‑room UX. */}
        <OrbitControls enableDamping makeDefault />

        {asset?.gltfUrl ? (
          // Async path — use Suspense to avoid blocking the whole tree.
          <Suspense fallback={<LoadingOverlay />}>
            <GLTFAsset url={asset.gltfUrl} />
          </Suspense>
        ) : (
          // Procedural fallback — fast and reliable when no GLTF is present.
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

// ----------------------------------- App ------------------------------------
// Top‑level wiring: reducer, concurrency, selectors, and UI composition.
// The progress bar simulates a long‑running pipeline task; in production we’d
// stream real progress and handle retry/cancel semantics.

export default function App() {
  // useReducer state: colocated, explicit, and easy to test.
  const [{ assets, selectedId, filter, lod }, dispatch] = useReducer(reducer, {
    assets: INITIAL_ASSETS,
    selectedId: INITIAL_ASSETS[0].id, // Deterministic initial selection.
    filter: "",
    lod: "HIGH" as LOD,
  });

  // Concurrency: deprioritize non‑urgent updates for smoother UX under load.
  const [isPending, startTransition] = useTransition();

  // Local UI signal for fake job progress; null = idle.
  const [progress, setProgress] = useState<number | null>(null);

  // Responsive measurement (note SSR caveat in hook).
  const { width } = useWindowSize();

  // Stable handlers prevent extra list item renders and keep React DevTools
  // flamegraph clean. They also make good targets for unit tests.
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

  // Derived selection; memoized to avoid O(n) scan on every render.
  const selected = useMemo(
    () => assets.find((a) => a.id === selectedId) ?? null,
    [assets, selectedId]
  );

  // compress
  // --------
  // Simulates a server‑side job by animating a progress bar and then dispatching
  // two actions: (1) set LOD for the viewer and (2) immutably update the selected
  // asset’s polyCount/sizeMB. The work itself is wrapped in startTransition so we
  // don’t block user interactions.
  const compress = useCallback(
    (next: LOD) => {
      setProgress(0);

      // Timer drives the fake progress bar. In production, we’d subscribe to
      // real progress events and derive this from the stream.
      const timer = setInterval(() => {
        setProgress((p) => {
          const step = (p ?? 0) + 12; // coarse increments for visual feedback
          return step >= 100 ? 100 : step;
        });
      }, 120);

      startTransition(() => {
        // Simulate job latency; this is where we’d await the server finalization.
        setTimeout(() => {
          dispatch({ type: "set_lod", lod: next });
          dispatch({ type: "compress_selected", lod: next });
          clearInterval(timer);
          setProgress(null); // reset signal
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
      {/* Header: includes a responsive measurement to demonstrate layout awareness. */}
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
        {/* Left: Asset Browser — filterable list that mirrors a review tool. */}
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
            aria-label="Search assets"
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              marginBottom: 8,
            }}
          />

          {/* Rendering lists as <button> makes them keyboard‑accessible by default. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {assets
              .filter((a) => {
                // NOTE: For large lists, we’d precompute search indices or
                // offload to web workers; here we keep it simple and readable.
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

        {/* Right: Details + Viewer — shows derived selection + async 3D preview. */}
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

            {/* Controls: LOD select kicks off the simulated compression job. */}
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

              {/* Progress/Transition feedback: communicates background activity. */}
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

          {/* Callout explains pipeline intent for interviewers and teammates. */}
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            * Simulated pipeline: the UI triggers a compression job, surfaces
            progress, then applies a deterministic LOD transform. In production,
            this would POST to a job queue and subscribe to server‑sent events;
            these shapes/colors act as fast proxies for real GLTF models.
          </div>
        </div>
      </div>
    </div>
  );
}

/*
  Testing & Observability Notes
  -----------------------------
  - Unit test the reducer with table‑driven cases (Jest/Vitest) to validate all
    Action paths and immutability guarantees.
  - Component tests can assert:
    - Filter behavior for tags/name/category (case‑insensitive).
    - Progress bar semantics (appears, increments, hides on completion).
    - LOD select dispatches both set_lod and compress_selected.
    - GLTF path renders Suspense fallback and then the primitive.
  - Add a lightweight logger around dispatch in dev mode to aid debugging, or use
    Redux DevTools integration for time‑travel on the reducer (easy with a wrapper).
  
  Performance Considerations
  --------------------------
  - For large asset lists, consider virtualization (react‑window) and precomputed
    search indices; move heavy filtering to a web worker if needed.
  - Memoize expensive derived data; avoid creating new handler identities.
  - In Viewer, progressively enhance lighting/materials (e.g., baked lightmaps) to
    keep frame times predictable on lower‑end GPUs.
  
  Accessibility
  -------------
  - Use semantic controls (<button>, <select>), labels, and aria‑ attributes for
    inputs. Ensure focus states are visible. Consider keyboard shortcuts for LOD.
  
  Future Extensions
  -----------------
  - Persist user prefs (LOD, last selected) to localStorage or user profile.
  - Replace simulateCompression with real API and SSE/WebSocket progress.
  - Add upload/ingest flow; validate GLTFs and generate thumbnails server‑side.
  - Integrate with Postgres via REST/GraphQL; enforce schema with zod.
  - WebXR: swap OrbitControls with XRControls; manage hit‑tests/anchors for spatial
    placement and leverage foveated rendering on supported devices.
  */
