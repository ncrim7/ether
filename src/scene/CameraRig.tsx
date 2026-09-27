import { useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/** Width the camera keeps in view, in model units (the bottle is ~0.87 wide). */
const FRAME_WIDTH = 1.5;
/** Height the camera keeps in view on wide screens (the bottle is ~1.38 tall). */
const FRAME_HEIGHT = 1.9;
/** Narrow screens are laid out as bottle on top, copy underneath. */
const NARROW = 760;

/**
 * Frames the bottle for the current viewport. Step 3 layers the scroll choreography on top of
 * this resting position.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);

  useLayoutEffect(() => {
    const aspect = width / height;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const tan = Math.tan(vFov / 2);
    const fitHeight = FRAME_HEIGHT / 2 / tan;
    const fitWidth = FRAME_WIDTH / 2 / (tan * aspect);
    const distance = Math.max(fitHeight, fitWidth);

    // on narrow screens look below the bottle so it sits in the upper half of the screen
    const lookY = width < NARROW ? -distance * tan * 0.42 : 0;
    camera.position.set(0, lookY + 0.15, distance);
    camera.lookAt(0, lookY, 0);
    camera.updateProjectionMatrix();
  }, [camera, width, height]);

  return null;
}
