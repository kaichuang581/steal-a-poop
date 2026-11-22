import { AdditiveBlending, ShaderMaterial } from 'three';
import type { Texture } from 'three';

/**
 * Many small pictures in one draw (the sky's lanterns, the trophy's sparkles): points, each with its own size in metres
 * (`size`, the side of its square, as a sprite's scale) and its own strength (`alpha`), a square picture on each, its light
 * added to what is behind. `scale` is half the drawing buffer's height, set each frame.
 */
export function spritePoints(map: Texture): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { map: { value: map }, scale: { value: 450 } },
    vertexShader: `
      attribute float size; attribute float alpha;
      uniform float scale;
      varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        // As big on screen as a sprite of that size would be: the projection's own vertical scale (1 / tan of half the
        // view) is the part three's own points leave out, and with a 28 degree lens it is four times.
        gl_PointSize = size * scale * projectionMatrix[1][1] / -mv.z;
        vA = alpha;
      }`,
    fragmentShader: `
      uniform sampler2D map;
      varying float vA;
      void main() {
        vec4 c = texture2D(map, vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y));
        gl_FragColor = vec4(c.rgb, c.a * vA);   // the blend multiplies by alpha once (source alpha, one)
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  });
}
