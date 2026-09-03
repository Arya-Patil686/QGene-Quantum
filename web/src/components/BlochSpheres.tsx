import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { BlochVector } from '../lib/api';
import { reducedMotion } from '../lib/motion';

/**
 * One Bloch sphere per qubit, showing the reduced single-qubit state after the
 * variant has been encoded. A vector that falls short of the surface means the
 * qubit is entangled with the rest of the register rather than holding an
 * independent value.
 *
 * Built from native three.js primitives — no drei Text (which fetches a font
 * at runtime) and no fat lines. Labels are HTML underneath, which keeps them
 * crisp and selectable.
 */

function ringGeometry(axis: 'x' | 'y' | 'z') {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    pts.push(axis === 'y' ? new THREE.Vector3(c, 0, s)
      : axis === 'x' ? new THREE.Vector3(0, c, s)
      : new THREE.Vector3(c, s, 0));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

function Sphere({ v, offset, still }: { v: BlochVector; offset: number; still: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, d) => {
    if (group.current && !still) group.current.rotation.y += d * 0.3;
  });

  const rings = useMemo(() => ({
    eq: ringGeometry('y'), m1: ringGeometry('x'), m2: ringGeometry('z'),
  }), []);

  // Bloch (x, y, z) -> scene (x, z, y), so |0> sits at the top of the sphere
  const tip = useMemo(() => new THREE.Vector3(v.x, v.z, v.y), [v.x, v.y, v.z]);
  const len = tip.length();
  const colour = len > 0.66 ? '#22d3ee' : len > 0.33 ? '#7c5cff' : '#ff4d6d';

  const axisGeom = useMemo(
    () => new THREE.BufferGeometry().setFromPoints(
      [new THREE.Vector3(0, -1.2, 0), new THREE.Vector3(0, 1.2, 0)]), []);
  const vecGeom = useMemo(
    () => new THREE.BufferGeometry().setFromPoints(
      [new THREE.Vector3(0, 0, 0), tip.clone()]), [tip]);

  return (
    <group position={[offset, 0, 0]}>
      <group ref={group}>
        <mesh>
          <sphereGeometry args={[1, 30, 30]} />
          <meshBasicMaterial color="#9c9cd8" wireframe transparent opacity={0.17} />
        </mesh>
        {[rings.eq, rings.m1, rings.m2].map((g, i) => (
          <lineLoop key={i} geometry={g}>
            <lineBasicMaterial color="#ffffff" transparent
                               opacity={i === 0 ? 0.38 : 0.2} />
          </lineLoop>
        ))}
        <lineSegments geometry={axisGeom}>
          <lineBasicMaterial color="#9c9cd8" transparent opacity={0.4} />
        </lineSegments>

        {/* A shell of radius |r|. Encoding drives these qubits close to
            maximally mixed, so the vector alone is too short to read -- the
            shrunken shell is what makes the entanglement legible. */}
        <mesh>
          <sphereGeometry args={[Math.max(len, 0.05), 22, 22]} />
          <meshBasicMaterial color={colour} transparent opacity={0.5} />
        </mesh>

        <lineSegments geometry={vecGeom}>
          <lineBasicMaterial color={colour} />
        </lineSegments>
        <mesh position={tip.toArray()}>
          <sphereGeometry args={[0.075, 16, 16]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Lay the spheres out across the full width of the canvas so each one sits
 * above its label, whatever the qubit count. The viewport width is only known
 * inside the Canvas, hence the inner component.
 */
function Row({ vectors, still }: { vectors: BlochVector[]; still: boolean }) {
  const { viewport } = useThree();
  const n = vectors.length;
  const cell = viewport.width / n;
  const scale = Math.min(1, (cell * 0.82) / 2);   // 2 world units per sphere
  return (
    <>
      {vectors.map((v, i) => (
        <group key={v.qubit} scale={scale}>
          <Sphere v={v} still={still}
                  offset={(i - (n - 1) / 2) * (cell / scale)} />
        </group>
      ))}
    </>
  );
}

export default function BlochSpheres({ vectors }: { vectors: BlochVector[] }) {
  const still = reducedMotion();
  const shown = vectors.slice(0, 8);

  return (
    <div>
      <div style={{ height: 210 }}>
        {/* Orthographic on purpose: the row is very wide, and a perspective
            camera at this aspect gives a ~120 degree horizontal field, which
            visibly stretches the spheres away from centre. */}
        <Canvas orthographic camera={{ position: [0, 0, 12], zoom: 46 }}
                gl={{ alpha: true, antialias: true }} dpr={[1, 1.6]}>
          <ambientLight intensity={1.2} />
          <Row vectors={shown} still={still} />
        </Canvas>
      </div>
      <div style={{ display: 'grid', gap: 6,
                    gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}>
        {shown.map((v) => {
          const len = Math.hypot(v.x, v.y, v.z);
          const colour = len > 0.66 ? '#22d3ee' : len > 0.33 ? '#7c5cff' : '#ff4d6d';
          return (
            <div key={v.qubit} style={{ textAlign: 'center' }}>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-dim)' }}>
                q{v.qubit}
              </div>
              <div className="mono" style={{ fontSize: 10, color: colour }}>
                |r| {len.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
