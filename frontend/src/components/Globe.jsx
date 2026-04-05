import { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Sphere, Line, useTexture } from '@react-three/drei'
import * as THREE from 'three'

function Earth() {
  const meshRef = useRef()

  const { gl } = useThree()
  const colorMap = useTexture('/earth.jpg')

  useEffect(() => {
    colorMap.anisotropy = gl.capabilities.getMaxAnisotropy()
    colorMap.needsUpdate = true
  }, [colorMap, gl])

  const geometry = useMemo(() => new THREE.SphereGeometry(2, 64, 64), [])

  return (
    <group>
      {/* Earth sphere */}
      <mesh ref={meshRef} geometry={geometry}>
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
  const ringRef = useRef()
  const pos = useMemo(() => latLngToVec3(lat, lng, 2.02), [lat, lng])
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto'
    return () => { document.body.style.cursor = 'auto' }
  }, [hovered])

  useFrame(({ clock }, delta) => {
    if (meshRef.current) {
      const breathing = 1 + Math.sin(clock.elapsedTime * 2 + lat) * 0.15
      const targetScale = hovered ? breathing * 1.8 : breathing
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 10)
    }
    if (ringRef.current) {
      const targetRingScale = hovered ? 1.5 : 1
      ringRef.current.scale.lerp(new THREE.Vector3(targetRingScale, targetRingScale, targetRingScale), delta * 15)
      ringRef.current.material.opacity = THREE.MathUtils.lerp(
        ringRef.current.material.opacity,
        hovered ? 0.7 : 0.3,
        delta * 10
      )
    }
  })

  return (
    <group 
      position={pos}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={(e) => { e.stopPropagation(); setHovered(false) }}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerUp={(e) => { e.stopPropagation(); onClick(); }}
    >
      {/* Visible dot */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshBasicMaterial color={hovered ? "#ffffff" : "#00d4ff"} transparent opacity={0.9} />
      </mesh>
      {/* Glow ring */}
      <mesh ref={ringRef}>
        <ringGeometry args={[0.04, 0.06, 32]} />
        <meshBasicMaterial color={hovered ? "#ffffff" : "#00d4ff"} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* Invisible hitbox for easier clicking */}
      <mesh>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

function ISSMarker({ lat, lng }) {
  const meshRef = useRef()
  const pos = useMemo(() => latLngToVec3(lat, lng, 2.15), [lat, lng])
  const [hovered, setHovered] = useState(false)

  // Hover cursor effect
  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto'
    return () => { document.body.style.cursor = 'auto' }
  }, [hovered])

  // Orient the ISS so its panels face the Earth nicely
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.lookAt(0, 0, 0) // Look at the center of the Earth
    }
  }, [pos])

  useFrame((state, delta) => {
    if (meshRef.current) {
      const scale = hovered ? 1.5 : 1
      meshRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), delta * 10)
    }
  })

  return (
    <group 
      position={pos} 
      ref={meshRef}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={(e) => { e.stopPropagation(); setHovered(false) }}
    >
      {/* Central module */}
      <mesh>
        <cylinderGeometry args={[0.02, 0.02, 0.1, 16]} />
        <meshStandardMaterial color="#fff" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Solar Panel Left */}
      <mesh position={[0.05, 0, 0]}>
        <boxGeometry args={[0.08, 0.005, 0.06]} />
        <meshStandardMaterial color={hovered ? "#ffffff" : "#00d4ff"} metalness={0.8} roughness={0.1} emissive={hovered ? "#ffffff" : "#00d4ff"} emissiveIntensity={0.4} />
      </mesh>
      {/* Solar Panel Right */}
      <mesh position={[-0.05, 0, 0]}>
        <boxGeometry args={[0.08, 0.005, 0.06]} />
        <meshStandardMaterial color={hovered ? "#ffffff" : "#00d4ff"} metalness={0.8} roughness={0.1} emissive={hovered ? "#ffffff" : "#00d4ff"} emissiveIntensity={0.4} />
      </mesh>
      {/* Outer Glow */}
      <Sphere args={[0.08, 16, 16]}>
        <meshBasicMaterial color={hovered ? "#ffffff" : "#ff9f43"} transparent opacity={hovered ? 0.6 : 0.4} />
      </Sphere>
      {/* Invisible larger hitbox */}
      <Sphere args={[0.15, 16, 16]}>
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
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
  const latRad = lat * (Math.PI / 180)
  const lngRad = lng * (Math.PI / 180)
  
  // Matches Three.js default SphereGeometry UV mapping natively
  // Center of texture (Greenwich) maps to +X
  return [
    radius * Math.cos(latRad) * Math.cos(lngRad),
    radius * Math.sin(latRad),
    -radius * Math.cos(latRad) * Math.sin(lngRad),
  ]
}

function RotatingGroup({ children, enableSpin, groupRef }) {
  useFrame((state, delta) => {
    if (groupRef.current && enableSpin) {
      groupRef.current.rotation.y += delta * 0.05
    }
  })
  return <group ref={groupRef}>{children}</group>
}

function ISSController({ lockOnIss, issPosition, controlsRef, groupRef }) {
  const targetQuat = useMemo(() => new THREE.Quaternion(), [])

  useFrame((state, delta) => {
    if (lockOnIss && issPosition && groupRef.current) {
      // Rotate the globe so the ISS position faces the camera
      const issLocal = new THREE.Vector3(...latLngToVec3(issPosition[0], issPosition[1], 1)).normalize()
      const cameraDir = state.camera.position.clone().normalize()
      targetQuat.setFromUnitVectors(issLocal, cameraDir)
      groupRef.current.quaternion.slerp(targetQuat, delta * 2)

      // Keep orbit target centered so camera doesn't pan
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0)
      }
    } else if (!lockOnIss && controlsRef.current) {
      controlsRef.current.target.lerp(new THREE.Vector3(0, 0, 0), delta * 2)
    }
  })
  return null
}

export default function Globe({ pads = [], onPadClick, issPosition = null, issTrack = [], spin = true, lockOnIss = false }) {
  const controlsRef = useRef()
  const groupRef = useRef()
  
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

      <ISSController lockOnIss={lockOnIss} issPosition={issPosition} controlsRef={controlsRef} groupRef={groupRef} />

      <RotatingGroup enableSpin={spin} groupRef={groupRef}>
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
        ref={controlsRef}
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
