import * as THREE from 'three';

/**
 * The liquid's material. On a variant change the new color rises from the bottom through a noisy,
 * glowing edge — the texture-transition technique from Codrops' "noise transition" demo
 * (github.com/mohAmineBrs/codrops-noise-transition, MIT), rewritten for a liquid fill.
 *
 * Drive it with `uniforms.uProgress` 0 → 1 after setting `uFrom` and `uTo`.
 */
export function createLiquidMaterial(bounds: THREE.Box3) {
  const uniforms = {
    uFrom: { value: new THREE.Color() },
    uTo: { value: new THREE.Color() },
    uProgress: { value: 0 },
    uTime: { value: 0 },
    uGlow: { value: new THREE.Color('#ffffff') },
    uMinY: { value: bounds.min.y },
    uMaxY: { value: bounds.max.y },
  };

  const material = new THREE.MeshPhysicalMaterial({ roughness: 0.22, clearcoat: 0.2, envMapIntensity: 0.35 });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vFillPos;
        uniform float uMinY;
        uniform float uMaxY;
        varying float vFillH;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vFillPos = position;
        vFillH = (position.y - uMinY) / (uMaxY - uMinY);`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uFrom;
        uniform vec3 uTo;
        uniform vec3 uGlow;
        uniform float uProgress;
        uniform float uTime;
        varying vec3 vFillPos;
        varying float vFillH;

        float fillHash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        float fillNoise(vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(fillHash(i), fillHash(i + vec3(1, 0, 0)), f.x),
                mix(fillHash(i + vec3(0, 1, 0)), fillHash(i + vec3(1, 1, 0)), f.x), f.y),
            mix(mix(fillHash(i + vec3(0, 0, 1)), fillHash(i + vec3(1, 0, 1)), f.x),
                mix(fillHash(i + vec3(0, 1, 1)), fillHash(i + vec3(1, 1, 1)), f.x), f.y),
            f.z);
        }

        float fillEdgeDistance() {
          vec3 p = vFillPos * 5.0 + vec3(0.0, uTime * 0.35, uTime * 0.2);
          float n = fillNoise(p) * 0.65 + fillNoise(p * 2.3) * 0.35;
          // the edge travels from just below the bottom to just above the top
          float edge = mix(-0.15, 1.15, uProgress);
          return vFillH + (n - 0.5) * 0.22 - edge;
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float fillD = fillEdgeDistance();
        diffuseColor.rgb = mix(uTo, uFrom, smoothstep(-0.015, 0.015, fillD));`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float fillActive = step(0.001, uProgress) * step(uProgress, 0.999);
        totalEmissiveRadiance += uGlow * (1.0 - smoothstep(0.0, 0.05, abs(fillD))) * 1.6 * fillActive;`,
      );
  };

  // one shader program for every liquid, whatever its uniforms
  material.customProgramCacheKey = () => 'ether-liquid-fill';

  return { material, uniforms };
}
