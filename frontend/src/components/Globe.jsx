import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Sphere, Line, useTexture } from '@react-three/drei'
import * as THREE from 'three'

function Earth() {
  const meshRef = useRef()

  // Load a verified local topography map (optimized size to prevent WebGL crashes)
  const colorMap = useTexture('/earth_small.jpg')

  const geometry = useMemo(() => new THREE.SphereGeometry(2, 64, 64), [])

  return (
    <group>
      {/* Earth sphere */}
      <mesh ref={meshRef} geometry={geometry} rotation={[0, -Math.PI / 2, 0]}>
        <meshStandardMaterial
          map={colorMap}
          roughness={0.8}
          metalness={0.1}
          color="#ffffff" // No tint multiplier so the map colors stay bright
        />
      </mesh>
      {/* Atmosphere glow */}
      <Sphere args={[2.05, 64, 64]}>
        <meshBasicMaterial
          color="#00d4ff"
          transparent
          opacity={0.05}
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
      {/* Visible dot */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.9} />
      </mesh>
      {/* Glow ring */}
      <mesh>
        <ringGeometry args={[0.04, 0.06, 32]} />
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* Invisible hitbox for easier clicking */}
      <mesh onClick={(e) => { e.stopPropagation(); onClick(); }} onPointerUp={(e) => { e.stopPropagation(); onClick(); }}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

function ISSMarker({ lat, lng }) {
  const meshRef = useRef()
  const pos = useMemo(() => latLngToVec3(lat, lng, 2.15), [lat, lng])

  // Orient the ISS so its panels face the Earth nicely
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.lookAt(0, 0, 0) // Look at the center of the Earth
    }
  }, [pos])

  return (
    <group position={pos} ref={meshRef}>
      {/* Central module */}
      <mesh>
        <cylinderGeometry args={[0.02, 0.02, 0.1, 16]} />
        <meshStandardMaterial color="#fff" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Solar Panel Left */}
      <mesh position={[0.05, 0, 0]}>
        <boxGeometry args={[0.08, 0.005, 0.06]} />
        <meshStandardMaterial color="#00d4ff" metalness={0.8} roughness={0.1} emissive="#00d4ff" emissiveIntensity={0.2} />
      </mesh>
      {/* Solar Panel Right */}
      <mesh position={[-0.05, 0, 0]}>
        <boxGeometry args={[0.08, 0.005, 0.06]} />
        <meshStandardMaterial color="#00d4ff" metalness={0.8} roughness={0.1} emissive="#00d4ff" emissiveIntensity={0.2} />
      </mesh>
      {/* Outer Glow */}
      <Sphere args={[0.08, 16, 16]}>
        <meshBasicMaterial color="#ff9f43" transparent opacity={0.4} />
      </Sphere>
    </group>
  )
}

function ISSTrack({ track }) {
  const points = useMemo(() => {
    return track.map(([lat, lng]) => {
      const [x, y, z] = latLngToVec3(lat, lng, 2.15)
      return new THREE.Vector3(x, y, z)
    })
  }, [track])

  if (points.length < 2) return null

  return (
    <Line
      points={points}
      color="#ff9f43"
      lineWidth={1.5}
      transparent
      opacity={0.6}
      dashed
      dashSize={0.05}
      gapSize={0.05}
    />
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

function RotatingGroup({ children, enableSpin }) {
  const groupRef = useRef()
  useFrame((state, delta) => {
    if (groupRef.current && enableSpin) {
      groupRef.current.rotation.y += delta * 0.05
    }
  })
  return <group ref={groupRef}>{children}</group>
}

export default function Globe({ pads = [], onPadClick, issPosition = null, issTrack = [], spin = true }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 5.5], fov: 45 }}
      style={{ height: '100%', width: '100%', background: 'transparent' }}
      gl={{ antialias: true }}
    >
      <ambientLight intensity={1.5} />
      <pointLight position={[10, 10, 10]} intensity={2.0} />
      <pointLight position={[-10, -10, -10]} intensity={1.0} color="#7c3aed" />
      <directionalLight position={[0, 5, 5]} intensity={1.5} />

      <RotatingGroup enableSpin={spin}>
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
        {issPosition && <ISSMarker lat={issPosition[0]} lng={issPosition[1]} />}
        {issTrack && issTrack.length > 0 && <ISSTrack track={issTrack} />}
      </RotatingGroup>

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={2.5}
        maxDistance={8}
        autoRotate={false}
        dampingFactor={0.08}
        enableDamping
      />
    </Canvas>
  )
}
