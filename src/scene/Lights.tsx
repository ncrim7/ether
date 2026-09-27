import { Environment, Lightformer } from '@react-three/drei';
import { variantById } from '../data/products';
import { useExperience } from '../store/useExperience';

/**
 * A procedural studio: soft boxes baked into an environment map (reflections on glass and metal)
 * plus a key light and two colored rim lights. No HDR download needed.
 */
export function Lights() {
  const variant = variantById(useExperience((s) => s.variant));
  const { key, rim, intensity } = variant.lights;

  return (
    <>
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={3} color="#ffffff" position={[0, 4, 2]} rotation-x={Math.PI / 2} scale={[4, 2, 1]} />
        <Lightformer form="rect" intensity={2} color="#ffffff" position={[-3, 1, 1]} rotation-y={Math.PI / 2} scale={[1, 4, 1]} />
        <Lightformer form="rect" intensity={2} color="#ffffff" position={[3, 1, 1]} rotation-y={-Math.PI / 2} scale={[1, 4, 1]} />
        <Lightformer form="ring" intensity={1} color="#ffffff" position={[0, 1, -4]} scale={2} />
      </Environment>
      <ambientLight intensity={0.15} />
      <directionalLight position={[1.5, 3, 3]} intensity={1.6 * intensity} color={key} />
      <spotLight position={[-2.5, 1.5, -2]} angle={0.5} penumbra={1} intensity={25 * intensity} color={rim} />
      <spotLight position={[2.5, 1.2, -2]} angle={0.5} penumbra={1} intensity={20 * intensity} color={rim} />
    </>
  );
}
