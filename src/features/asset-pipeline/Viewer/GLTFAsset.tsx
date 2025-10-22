import React, { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";

const TARGET_SIZE = 1.5; // fit largest dimension to ~1.5 world units

export default function GLTFAsset({ url }: { url: string }) {
  // Preload the URL passed in (not a hardcoded path)
  useGLTF.preload(url);

  const { scene } = useGLTF(url);

  const normalized = useMemo(() => {
    // Deep clone (preserves skins/bones correctly)
    const root = skeletonClone(scene) as THREE.Object3D;

    // Reset top-level transforms before measuring
    root.position.set(0, 0, 0);
    root.rotation.set(0, 0, 0);
    root.scale.set(1, 1, 1);
    root.updateMatrixWorld(true);

    // Compute bounds on the clean clone
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Guard against degenerate bounds
    const maxDim = Math.max(size.x, size.y, size.z) || 1;

    // Center and scale to target
    root.position.sub(center); // center at origin
    const s = TARGET_SIZE / maxDim; // uniform scale to fit
    root.scale.setScalar(s);
    root.updateMatrixWorld(true);

    return root;
  }, [scene, url]);

  return <primitive object={normalized} />;
}
