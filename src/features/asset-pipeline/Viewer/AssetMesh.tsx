import React from "react";
import type { LOD, Asset } from "../types";

export default function AssetMesh({
  lod,
  shape,
  color,
}: {
  lod: LOD;
  shape: Asset["shape"];
  color?: string;
}) {
  const seg = lod === "HIGH" ? 48 : lod === "MED" ? 24 : 12;
  const mat = <meshStandardMaterial color={color} />;
  switch (shape) {
    case "sphere":
      return (
        <mesh>
          <sphereGeometry args={[0.9, seg, seg]} />
          {mat}
        </mesh>
      );
    case "torus":
      return (
        <mesh>
          <torusGeometry args={[0.8, 0.25, seg, seg]} />
          {mat}
        </mesh>
      );
    case "cylinder":
      return (
        <mesh>
          <cylinderGeometry args={[0.5, 0.5, 1.5, seg]} />
          {mat}
        </mesh>
      );
    default:
      return (
        <mesh>
          <boxGeometry args={[1.5, 1, 0.5, seg]} />
          {mat}
        </mesh>
      );
  }
}
