import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { reducedMotion } from '../lib/motion';

export interface KernelPoint {
  x: number; y: number; z: number; label: number; p: number;
}

const PATH = new THREE.Color('#ff4d6d');
const BENIGN = new THREE.Color('#34d399');

function Cloud({ points, query, still }: {
  points: KernelPoint[];
  query?: number[] | null;
  still: boolean;
}) {
  const group = useRef<THREE.Group>(null);

  const { geometry, colors } = useMemo(() => {
    const pos = new Float32Array(points.length * 3);
    const col = new Float32Array(points.length * 3);
    points.forEach((p, i) => {
      // angles live in [0, pi]; centre them on the origin for display
      pos[i * 3] = (p.x - Math.PI / 2) * 1.7;
      pos[i * 3 + 1] = (p.y - Math.PI / 2) * 1.7;
      pos[i * 3 + 2] = (p.z - Math.PI / 2) * 1.7;
      const c = p.label === 1 ? PATH : BENIGN;
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return { geometry: g, colors: col };
  }, [points]);
  void colors;

  useFrame((_, d) => {
    if (group.current && !still) group.current.rotation.y += d * 0.12;
  });

  const q = query && query.length >= 3
    ? new THREE.Vector3(
        (query[0] - Math.PI / 2) * 1.7,
        (query[1] - Math.PI / 2) * 1.7,
        (query[2] - Math.PI / 2) * 1.7)
    : null;

  return (
    <group ref={group}>
      <points geometry={geometry}>
        <pointsMaterial size={0.085} vertexColors transparent opacity={0.72}
                        sizeAttenuation depthWrite={false} />
      </points>
      {q && (
        <>
          <mesh position={q.toArray()}>
            <sphereGeometry args={[0.16, 20, 20]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={q.toArray()}>
            <sphereGeometry args={[0.42, 20, 20]} />
            <meshBasicMaterial color="#7c5cff" transparent opacity={0.2} />
          </mesh>
        </>
      )}
      <gridHelper args={[10, 10, '#2a2b40', '#191a2a']} position={[0, -3.2, 0]} />
    </group>
  );
}

export default function KernelSpace({ points, query, height = 340 }: {
  points: KernelPoint[];
  query?: number[] | null;
  height?: number;
}) {
  const still = reducedMotion();
  return (
    <div style={{ height }}>
      <Canvas camera={{ position: [4.6, 3.1, 5.4], fov: 45 }} gl={{ alpha: true }} dpr={[1, 1.6]}>
        <ambientLight intensity={1.2} />
        <Cloud points={points} query={query} still={still} />
        <OrbitControls enablePan={false} enableZoom={false} enableDamping
                       autoRotate={false} />
      </Canvas>
    </div>
  );
}
