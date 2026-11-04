import { CanvasTexture, Color, LinearMipmapLinearFilter, MeshLambertMaterial, NearestFilter, SRGBColorSpace } from 'three';

let edge: CanvasTexture | null = null;

/**
 * A small tile drawn on every voxel face: a darker rim and a lighter centre, so each cube reads as a cube even on
 * flat runs of the same colour. Lambert multiplies it with the baked vertex colour. Nearest when magnified keeps
 * the rim crisp up close; mipmaps let it fade to a faint grid at a distance.
 */
export function edgeTexture(): CanvasTexture {
  if (edge) return edge;
  const n = 16;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  const img = g.createImageData(n, n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const d = Math.min(x, y, n - 1 - x, n - 1 - y); // distance to the tile's rim in texels
      const v = d === 0 ? 0.8 : d === 1 ? 0.93 : 1;
      const i = (y * n + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(v * 255);
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  edge = new CanvasTexture(c);
  edge.magFilter = NearestFilter;
  edge.minFilter = LinearMipmapLinearFilter;
  edge.anisotropy = 4;
  edge.colorSpace = SRGBColorSpace;
  return edge;
}

/** The one material every voxel mesh uses (plan V3 Part 4.2): Lambert, vertex colours, the edge tile on top. */
export function voxelMaterial(opts: { emissive?: string; emissiveIntensity?: number; transparent?: boolean; opacity?: number; color?: string } = {}) {
  return new MeshLambertMaterial({
    vertexColors: true,
    map: edgeTexture(),
    emissive: opts.emissive ? new Color(opts.emissive) : undefined,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    color: opts.color,
  });
}
