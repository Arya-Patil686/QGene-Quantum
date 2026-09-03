import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import { reducedMotion } from '../lib/motion';

const TURNS = 3.1;
const RUNGS = 46;
const PER_STRAND = 210;
const RADIUS = 1.72;
const HEIGHT = 11.5;

type Node = { pos: [number, number, number]; strand: 0 | 1; t: number };

function buildHelix(): { nodes: Node[]; rungs: Float32Array } {
  const nodes: Node[] = [];
  for (let s = 0 as 0 | 1; s <= 1; s = (s + 1) as 0 | 1) {
    for (let i = 0; i < PER_STRAND; i++) {
      const t = i / (PER_STRAND - 1);
      const a = t * TURNS * Math.PI * 2 + (s === 1 ? Math.PI : 0);
      nodes.push({
        pos: [Math.cos(a) * RADIUS, (t - 0.5) * HEIGHT, Math.sin(a) * RADIUS],
        strand: s,
        t,
      });
    }
    if (s === 1) break;
  }

  const seg: number[] = [];
  for (let i = 0; i < RUNGS; i++) {
    const t = i / (RUNGS - 1);
    const a = t * TURNS * Math.PI * 2;
    const y = (t - 0.5) * HEIGHT;
    seg.push(Math.cos(a) * RADIUS, y, Math.sin(a) * RADIUS);
    seg.push(Math.cos(a + Math.PI) * RADIUS, y, Math.sin(a + Math.PI) * RADIUS);
  }
  return { nodes, rungs: new Float32Array(seg) };
}

function Strands({ still }: { still: boolean }) {
  const group = useRef<THREE.Group>(null);
  const { nodes, rungs } = useMemo(buildHelix, []);
  const { pointer } = useThree();

  const rungGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(rungs, 3));
    return g;
  }, [rungs]);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    if (!still) g.rotation.y += delta * 0.16;
    // gentle parallax toward the cursor
    const tx = pointer.y * 0.16;
    const tz = pointer.x * 0.13;
    g.rotation.x += (tx - g.rotation.x) * 0.045;
    g.rotation.z += (tz - g.rotation.z) * 0.045;
    if (!still) {
      g.position.y = Math.sin(state.clock.elapsedTime * 0.42) * 0.16;
    }
  });

  const strandA = nodes.filter((n) => n.strand === 0);
  const strandB = nodes.filter((n) => n.strand === 1);

  return (
    <group ref={group}>
      <lineSegments geometry={rungGeom}>
        <lineBasicMaterial
          color="#8f8fc4"
          transparent
          opacity={0.26}
          depthWrite={false}
        />
      </lineSegments>

      <Instances limit={PER_STRAND} range={PER_STRAND}>
        <sphereGeometry args={[0.088, 14, 14]} />
        <meshStandardMaterial
          color="#7c5cff"
          emissive="#5b3dff"
          emissiveIntensity={1.5}
          roughness={0.28}
          metalness={0.1}
        />
        {strandA.map((n, i) => (
          <Instance key={i} position={n.pos} scale={1 + Math.sin(n.t * 12) * 0.12} />
        ))}
      </Instances>

      <Instances limit={PER_STRAND} range={PER_STRAND}>
        <sphereGeometry args={[0.088, 14, 14]} />
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#0aa6c4"
          emissiveIntensity={1.4}
          roughness={0.28}
          metalness={0.1}
        />
        {strandB.map((n, i) => (
          <Instance key={i} position={n.pos} scale={1 + Math.cos(n.t * 12) * 0.12} />
        ))}
      </Instances>
    </group>
  );
}

function Motes() {
  const ref = useRef<THREE.Points>(null);
  const geom = useMemo(() => {
    const n = 340;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 4 + Math.random() * 7;
      const th = Math.random() * Math.PI * 2;
      arr[i * 3] = Math.cos(th) * r;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 16;
      arr[i * 3 + 2] = Math.sin(th) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y -= delta * 0.026;
  });

  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial
        size={0.045}
        color="#b9b9e8"
        transparent
        opacity={0.5}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

export default function HelixScene({ className }: { className?: string }) {
  const still = reducedMotion();
  return (
    <div className={className} aria-hidden="true">
      <Canvas
        dpr={[1, 1.7]}
        camera={{ position: [0, 0, 8.6], fov: 46 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[6, 5, 6]} intensity={90} color="#a78bfa" />
        <pointLight position={[-6, -4, 4]} intensity={70} color="#22d3ee" />
        <Strands still={still} />
        <Motes />
      </Canvas>
    </div>
  );
}
