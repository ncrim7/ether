import * as THREE from 'three';

/**
 * Perfume inside the bottle, with a real fill level.
 *
 * The liquid mesh is the full volume; the shader discards everything above a plane (the fill
 * level). Through the cut we see the mesh's inner back faces, which are shaded as the liquid's
 * top surface — the usual real-time "liquid in a container" technique (MinionsArt's liquid
 * shader and its many ports). The plane tilts with a spring (sloshing) and ripples while the
 * bottle is being filled.
 *
 * All positions are in bottle space: base at y = 0, glass body 1 unit tall.
 */
export interface LiquidUniforms {
  uColor: { value: THREE.Color };
  /** fill height in bottle units */
  uLevel: { value: number };
  /** surface normal in bottle space (tilts while sloshing) */
  uPlaneNormal: { value: THREE.Vector3 };
  /** the same normal in world space, for lighting the surface */
  uPlaneNormalWorld: { value: THREE.Vector3 };
  /** 0..1 ripples and foam while a stream is pouring in */
  uAgitation: { value: number };
  uTime: { value: number };
  uNodeScale: { value: THREE.Vector3 };
  uNodeOffset: { value: THREE.Vector3 };
  uMinY: { value: number };
  uMaxY: { value: number };
}

export function createLiquidMaterial(node: THREE.Mesh) {
  const geometry = node.geometry;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  // the GLB is quantized: the node's scale/offset turn attribute values into bottle units
  const minY = box.min.y * node.scale.y + node.position.y;
  const maxY = box.max.y * node.scale.y + node.position.y;

  const uniforms: LiquidUniforms = {
    uColor: { value: new THREE.Color() },
    uLevel: { value: maxY },
    uPlaneNormal: { value: new THREE.Vector3(0, 1, 0) },
    uPlaneNormalWorld: { value: new THREE.Vector3(0, 1, 0) },
    uAgitation: { value: 0 },
    uTime: { value: 0 },
    uNodeScale: { value: node.scale.clone() },
    uNodeOffset: { value: node.position.clone() },
    uMinY: { value: minY },
    uMaxY: { value: maxY },
  };

  const material = new THREE.MeshPhysicalMaterial({
    roughness: 0.22,
    clearcoat: 0.2,
    envMapIntensity: 0.35,
    // back faces become the liquid's surface
    side: THREE.DoubleSide,
  });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uNodeScale;
        uniform vec3 uNodeOffset;
        varying vec3 vBottlePos;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vBottlePos = position * uNodeScale + uNodeOffset;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uColor;
        uniform float uLevel;
        uniform vec3 uPlaneNormal;
        uniform vec3 uPlaneNormalWorld;
        uniform float uAgitation;
        uniform float uTime;
        uniform float uMinY;
        uniform float uMaxY;
        varying vec3 vBottlePos;

        // signed height above the (tilted, rippling) surface; > 0 means air
        float surfaceDistance(vec3 p) {
          vec3 n = normalize(uPlaneNormal);
          float d = dot(p - vec3(0.0, uLevel, 0.0), n);
          // rings spreading from where the stream lands (the neck, at x = z = 0)
          float r = length(p.xz);
          float rings = sin(r * 70.0 - uTime * 16.0) * exp(-r * 5.0);
          // a slower, choppier swell across the whole surface
          float chop = sin(p.x * 23.0 + uTime * 5.3) * sin(p.z * 31.0 - uTime * 4.1);
          return d - (rings * 0.006 + chop * 0.003) * uAgitation;
        }`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        float surfaceD = surfaceDistance(vBottlePos);
        if (surfaceD > 0.0) discard;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float fillH = clamp((vBottlePos.y - uMinY) / (uMaxY - uMinY), 0.0, 1.0);
        // deeper liquid is denser: darker toward the base
        vec3 body = uColor * mix(0.62, 1.08, fillH);
        // a bright meniscus line where the liquid meets the glass, foamier while pouring
        float meniscus = 1.0 - smoothstep(0.0, 0.006 + 0.01 * uAgitation, -surfaceD);
        body = mix(body, mix(uColor, vec3(1.0), 0.55), meniscus * (0.35 + 0.4 * uAgitation));
        if (!gl_FrontFacing) {
          // the top surface: lighter, and milky with micro-bubbles while being filled
          body = mix(uColor * 1.25, vec3(1.0), 0.08 + 0.14 * uAgitation);
        }
        diffuseColor.rgb = body;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        if (!gl_FrontFacing) normal = normalize((viewMatrix * vec4(uPlaneNormalWorld, 0.0)).xyz);`,
      );
  };

  material.customProgramCacheKey = () => 'ether-liquid-level';

  return { material, uniforms, minY, maxY };
}
