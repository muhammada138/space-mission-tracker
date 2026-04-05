import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Sphere } from '@react-three/drei'
import * as THREE from 'three'

function Earth() {
  const meshRef = useRef()

  // Create a simple dark earth with grid lines
  const geometry = useMemo(() => new THREE.SphereGeometry(2, 64, 64), [])

  return (
    <group>
      {/* Earth sphere */}
      <mesh ref={meshRef} geometry={geometry}>
        <meshStandardMaterial
          color="#0a1428"
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>
      {/* Wireframe overlay for land feel */}
      <mesh geometry={geometry}>
        <meshBasicMaterial
          color="#1a2744"
          wireframe
          transparent
          opacity={0.15}
        />
      </mesh>
      {/* Atmosphere glow */}
      <Sphere args={[2.05, 64, 64]}>
        <meshBasicMaterial
          color="#00d4ff"
          transparent
          opacity={0.03}
          side={THREE.BackSide}
        />
      </Sphere>
    </group>
  )
}

function LaunchPadDot({ lat, lng, name, count, onClick }) {
  const meshRef = useRef()
  const pos = useMemo(() => latLngToVec3(lat, lng, 2.02), [lat, lng])

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 2 + lat) * 0.15
      meshRef.current.scale.setScalar(s)
    }
  })

  return (
    <group position={pos}>
      <mesh ref={meshRef} onClick={onClick}>
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.9} />
      </mesh>
      {/* Glow ring */}
      <mesh>
        <ringGeometry args={[0.04, 0.06, 32]} />
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function latLngToVec3(lat, lng, radius) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return [
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ]
}

function RotatingGroup({ children }) {
  const groupRef = useRef()
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.001
    }
  })
  return <group ref={groupRef}>{children}</group>
}

export default function Globe({ pads = [], onPadClick }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 5.5], fov: 45 }}
      style={{ height: '100%', width: '100%', background: 'transparent' }}
      gl={{ antialias: true }}
    >
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <pointLight position={[-10, -10, -10]} intensity={0.3} color="#7c3aed" />

      <RotatingGroup>
        <Earth />
        {pads.map((pad, i) => (
          <LaunchPadDot
            key={pad.name || i}
            lat={pad.lat}
            lng={pad.lng}
            name={pad.name}
            count={pad.count}
            onClick={() => onPadClick?.(pad)}
          />
        ))}
      </RotatingGroup>

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={3.5}
        maxDistance={8}
        autoRotate={false}
        dampingFactor={0.08}
        enableDamping
      />
    </Canvas>
  )
}
