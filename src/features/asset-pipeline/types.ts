export type LOD = "HIGH" | "MED" | "LOW";
export type Category = "film" | "character" | "environment" | "product";

export type Asset = {
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
