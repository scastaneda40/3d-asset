import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import type { LOD, Asset } from "../types";
import AssetMesh from "./AssetMesh";
import GLTFAsset from "./GLTFAsset";

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
          animation: "spin .8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </Html>
  );
}

export default function Viewer({
  lod,
  asset,
}: {
  lod: LOD;
  asset: Asset | null;
}) {
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
