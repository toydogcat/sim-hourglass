/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { 
  SAND_THEMES, 
  GLASS_TINTS, 
  PILLAR_MATERIALS, 
  SandColorId, 
  GlassTintId, 
  PillarMaterialId 
} from '../types';

interface HourglassCanvasProps {
  sandColorId: SandColorId;
  glassTintId: GlassTintId;
  pillarMaterialId: PillarMaterialId;
  sandCount: number;
  flowMultiplier: number;
  gyroEnabled: boolean;
  tiltX: number;
  tiltZ: number;
  onStatsUpdate: (stats: {
    topPercentage: number;
    bottomPercentage: number;
    flowCount: number;
    elapsedSec: number;
    sensorAvailable: boolean;
    sensorReading: string;
  }) => void;
  triggerFlip: boolean;
  onFlipComplete: () => void;
  triggerShake: boolean;
  onShakeComplete: () => void;
  triggerExplode?: boolean;
  onExplodeComplete?: () => void;
}

export default function HourglassCanvas({
  sandColorId,
  glassTintId,
  pillarMaterialId,
  sandCount,
  flowMultiplier,
  gyroEnabled,
  tiltX,
  tiltZ,
  onStatsUpdate,
  triggerFlip,
  onFlipComplete,
  triggerShake,
  onShakeComplete,
  triggerExplode,
  onExplodeComplete,
}: HourglassCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  
  // Physics parameters held in refs for high-speed frame updates without triggers re-renders
  const physicsParamsRef = useRef({
    sandCount,
    flowMultiplier,
    sandColorId,
    glassTintId,
    pillarMaterialId,
    gyroEnabled,
    tiltX,
    tiltZ,
  });

  // Update physics parameters ref whenever props change
  useEffect(() => {
    physicsParamsRef.current = {
      sandCount,
      flowMultiplier,
      sandColorId,
      glassTintId,
      pillarMaterialId,
      gyroEnabled,
      tiltX,
      tiltZ,
    };
  }, [sandCount, flowMultiplier, sandColorId, glassTintId, pillarMaterialId, gyroEnabled, tiltX, tiltZ]);

  // Rotations
  const rotationRef = useRef({
    targetX: 0,
    targetY: 0,
    currentX: 0,
    currentY: 0,
    isDragging: false,
    startX: 0,
    startY: 0,
  });

  // Smooth flip transition
  const flipRef = useRef({
    isFlipping: false,
    flipProgress: 0,
    startRotationX: 0,
    targetRotationX: 0,
  });

  // Shake effect
  const shakeRef = useRef({
    shakeIntensity: 0,
  });

  // Gyroscope measurements (world coords)
  const gyroRef = useRef({
    deviceX: 0,
    deviceY: -9.81,
    deviceZ: 0,
    hasSensor: false,
    calibrated: false,
  });

  // Particle simulation parameters & buffers
  const particlesRef = useRef({
    positions: new Float32Array(12000 * 3), // max 12000 instances
    velocities: new Float32Array(12000 * 3),
    settled: new Uint8Array(12000),         // 1 if inside pile, 0 if active
    scales: new Float32Array(12000),         // individual size scale multiplier
    instancedMesh: null as THREE.InstancedMesh | null,
    glassMesh: null as THREE.Mesh | null,
    capsGroup: null as THREE.Group | null,
    pillarsGroup: null as THREE.Group | null,
    topPercentage: 100,
    bottomPercentage: 0,
    flowCount: 0,
    totalElapsed: 0,
  });

  // Analytical Hourglass profile
  const getGlassRadius = (y: number) => {
    const absY = Math.abs(y);
    if (absY >= 3.25) return 0.0;
    
    // Taper near top/bottom bases
    if (absY > 2.8) {
      const t = (absY - 2.8) / 0.45; // 0 to 1
      // Widen the bottleneck slightly (from 0.16 base to 0.20 base aperture)
      const R_max = 0.20 + 1.40 * (1.0 - Math.cos(2.8 / 2.8 * Math.PI)) / 2.0; // r at 2.8 (~1.6)
      return Math.max(0, R_max * Math.sqrt(Math.max(0, 1.0 - t * t)));
    }
    
    // Smooth cosine bell curve profile for traditional organic hourglass
    const t = absY / 2.8; // 0 to 1
    return 0.20 + 1.40 * (1.0 - Math.cos(t * Math.PI)) / 2.0;
  };

  const getGlassRadiusDerivative = (y: number) => {
    const eps = 0.01;
    return (getGlassRadius(y + eps) - getGlassRadius(y - eps)) / (2 * eps);
  };

  // Reset particles to the top bulb
  const resetParticles = (count: number) => {
    const part = particlesRef.current;
    
    // Reallocate buffers if size exceeds
    if (part.positions.length < count * 3) {
      part.positions = new Float32Array(count * 3);
      part.velocities = new Float32Array(count * 3);
      part.settled = new Uint8Array(count);
    }
    if (part.scales.length < count) {
      part.scales = new Float32Array(count);
    }

    // Assign organic size scale variations to each particle index
    for (let sIdx = 0; sIdx < count; sIdx++) {
      // Dynamic random scale factor. Average around 1.15 to create a fuller, fluffy pile.
      part.scales[sIdx] = 0.85 + Math.random() * 0.55; 
    }

    let i = 0;
    let attempts = 0;
    while (i < count && attempts < count * 10) {
      attempts++;
      // Distribute randomly in a vertical column inside top bulb
      const y = 0.4 + Math.random() * 2.3;
      const t = Math.abs(y) / 2.8;
      const max_r = 0.20 + 1.40 * (1.0 - Math.cos(t * Math.PI)) / 2.0 - 0.09;
      
      const theta = Math.random() * Math.PI * 2;
      const r = Math.random() * max_r;
      
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      
      // Safety boundary verification
      const checkR = Math.sqrt(x*x + z*z);
      if (checkR < getGlassRadius(y) - 0.05) {
        part.positions[i * 3] = x;
        part.positions[i * 3 + 1] = y;
        part.positions[i * 3 + 2] = z;

        part.velocities[i * 3] = (Math.random() - 0.5) * 0.05;
        part.velocities[i * 3 + 1] = -Math.random() * 0.05;
        part.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.05;

        part.settled[i] = 0;
        i++;
      }
    }
    // Fill remaining if constraints failed
    for (let j = i; j < count; j++) {
      part.positions[j * 3] = (Math.random() - 0.5) * 0.05;
      part.positions[j * 3 + 1] = 1.0 + Math.random() * 1.5;
      part.positions[j * 3 + 2] = (Math.random() - 0.5) * 0.05;
      part.velocities[j * 3] = 0;
      part.velocities[j * 3 + 1] = 0;
      part.velocities[j * 3 + 2] = 0;
      part.settled[j] = 0;
    }
  };

  // Gyroscope listeners
  useEffect(() => {
    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      const { beta, gamma } = event;
      if (beta !== null && gamma !== null) {
        gyroRef.current.hasSensor = true;
        
        // Convert Euler angles in degrees to physical screen coordinates gravitational vector
        // beta: tilt front/back (-180 to 180) -> affects gravity Y and Z
        // gamma: tilt left/right (-90 to 90) -> affects gravity X
        const radBeta = (beta * Math.PI) / 180;
        const radGamma = (gamma * Math.PI) / 180;
        
        // Gravity vector on the device face:
        const gx = Math.sin(radGamma) * 9.81;
        const gy = -Math.cos(radGamma) * Math.cos(radBeta) * 9.81;
        const gz = Math.sin(radBeta) * 9.81;
        
        // Update gravity reference smoothly to reduce noise and vibrations
        const filter = 0.15; // smooth weight
        gyroRef.current.deviceX = gyroRef.current.deviceX * (1 - filter) + gx * filter;
        gyroRef.current.deviceY = gyroRef.current.deviceY * (1 - filter) + gy * filter;
        gyroRef.current.deviceZ = gyroRef.current.deviceZ * (1 - filter) + gz * filter;
        gyroRef.current.calibrated = true;
      }
    };

    window.addEventListener('deviceorientation', handleDeviceOrientation);
    return () => {
      window.removeEventListener('deviceorientation', handleDeviceOrientation);
    };
  }, []);

  // Handle Flip trigger from props
  useEffect(() => {
    if (triggerFlip) {
      const rot = rotationRef.current;
      flipRef.current.isFlipping = true;
      flipRef.current.flipProgress = 0;
      flipRef.current.startRotationX = rot.targetX;
      flipRef.current.targetRotationX = rot.targetX + Math.PI; // Flip 180 deg
      onFlipComplete();
    }
  }, [triggerFlip, onFlipComplete]);

  // Handle Shake trigger from props
  useEffect(() => {
    if (triggerShake) {
      shakeRef.current.shakeIntensity = 12.0; // peak force
      onShakeComplete();
    }
  }, [triggerShake, onShakeComplete]);

  // Handle Explode/Burst trigger from props
  useEffect(() => {
    if (triggerExplode && onExplodeComplete) {
      const part = particlesRef.current;
      const count = physicsParamsRef.current.sandCount;
      for (let i = 0; i < count; i++) {
        // Unsettle all grains so they break free
        part.settled[i] = 0;
        
        // Calculate coordinate from bottleneck (0, 0, 0) vertical tube
        const px = part.positions[i * 3];
        const py = part.positions[i * 3 + 1];
        const pz = part.positions[i * 3 + 2];
        
        // Blast outwards radially colored with elegant jitter
        let dx = px;
        let dy = py;
        let dz = pz;
        const len = Math.sqrt(dx*dx + dy*dy + dz*dz) || 0.1;
        dx /= len;
        dy /= len;
        dz /= len;
        
        const force = 2.0 + Math.random() * 4.0;
        part.velocities[i * 3]     = dx * force + (Math.random() - 0.5) * 1.8;
        // Explode upwards/downwards vertically depending on bulb zone
        part.velocities[i * 3 + 1] = dy * force + (Math.random() - 0.5) * 1.8 + (py > 0 ? 1.0 : -1.0);
        part.velocities[i * 3 + 2] = dz * force + (Math.random() - 0.5) * 1.8;
      }
      onExplodeComplete();
    }
  }, [triggerExplode, onExplodeComplete]);

  // Main 3D render & physics initializer
  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    // Extremely robust clearing to prevent duplicate canvas renderings on hot-reload/remounts
    while (currentMount.firstChild) {
      currentMount.removeChild(currentMount.firstChild);
    }

    const width = currentMount.clientWidth || 600;
    const height = currentMount.clientHeight || 550;

    // --- 1. Scene Setup ---
    const scene = new THREE.Scene();
    
    // --- 2. Camera ---
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    
    // Auto-fit camera distance depending on aspect ratio to prevent top/bottom or left/right cuts
    const adjustCameraDistance = (w: number, h: number) => {
      const aspect = w / h;
      const objectHeight = 7.0;
      const objectWidth = 4.2;
      
      const padHeight = objectHeight / 0.72; // object occupies 72% height of screen
      const distY = (padHeight / 2) / Math.tan((camera.fov * Math.PI) / 360);
      
      const padWidth = objectWidth / 0.72; // object occupies 72% width of screen
      const hFov = 2 * Math.atan(Math.tan((camera.fov * Math.PI) / 360) * aspect);
      const distX = (padWidth / 2) / Math.tan(hFov / 2);
      
      const finalZ = Math.max(distY, distX);
      camera.position.set(0, 0, Math.min(Math.max(finalZ, 12.8), 20));
    };

    adjustCameraDistance(width, height);

    // --- 3. WebGL Renderer ---
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Tone mapping for luxurious material reflections
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    
    currentMount.appendChild(renderer.domElement);

    // --- 4. Beautiful Soft Studio Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    // Dynamic key light throwing soft shadows
    const keyLight = new THREE.DirectionalLight(0xfff8f0, 1.3);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.001;
    scene.add(keyLight);

    // High intensity rim back light to highlight silhouettes of the glass curve
    const rimLight = new THREE.DirectionalLight(0xcce6ff, 1.5);
    rimLight.position.set(-6, 4, -4);
    scene.add(rimLight);

    // Floor bounce fill light
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(0, -6, 2);
    scene.add(fillLight);

    // Core central spot focus glow
    const neckSpotLight = new THREE.PointLight(0xfff3d1, 0.8, 5);
    neckSpotLight.position.set(0, 0, 1);
    scene.add(neckSpotLight);

    // --- 5. Custom 3D Models (Hourglass Group) ---
    // Everything is packed in an interactive group that rotates gracefully
    const hourglassGroup = new THREE.Group();
    scene.add(hourglassGroup);

    // (A) Glass Body
    // Using LatheGeometry to create a seamless hollow glass vessel
    const glassPoints: THREE.Vector2[] = [];
    const segments = 64;
    for (let y = -3.25; y <= 3.25; y += 0.05) {
      glassPoints.push(new THREE.Vector2(getGlassRadius(y), y));
    }
    const glassGeo = new THREE.LatheGeometry(glassPoints, segments);
    
    const initialTint = GLASS_TINTS.find(t => t.id === physicsParamsRef.current.glassTintId) || GLASS_TINTS[0];
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(initialTint.color),
      transparent: true,
      opacity: 0.1,
      roughness: initialTint.roughness,
      metalness: 0.02,
      thickness: 0.42,
      transmission: initialTint.transmission,
      ior: initialTint.ior,
      side: THREE.DoubleSide,
      depthWrite: false, // Ensures sand particles show behind curved glass layers
      clearcoat: 1.0,
      clearcoatRoughness: 0.02
    });
    
    const glassMesh = new THREE.Mesh(glassGeo, glassMat);
    hourglassGroup.add(glassMesh);
    particlesRef.current.glassMesh = glassMesh;

    // (B) Top/Bottom Caps (Wooden, chrome or obsidian bases)
    const capsGroup = new THREE.Group();
    hourglassGroup.add(capsGroup);
    particlesRef.current.capsGroup = capsGroup;

    const initialPillar = PILLAR_MATERIALS.find(p => p.id === physicsParamsRef.current.pillarMaterialId) || PILLAR_MATERIALS[0];
    const capMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(initialPillar.capColor),
      roughness: initialPillar.roughness + 0.1,
      metalness: initialPillar.metalness * 0.5,
    });

    const capGeo = new THREE.CylinderGeometry(2.05, 2.05, 0.25, 48);
    const topCap = new THREE.Mesh(capGeo, capMat);
    topCap.position.y = 3.375;
    topCap.castShadow = true;
    topCap.receiveShadow = true;
    capsGroup.add(topCap);

    const bottomCap = new THREE.Mesh(capGeo, capMat);
    bottomCap.position.y = -3.375;
    bottomCap.castShadow = true;
    bottomCap.receiveShadow = true;
    capsGroup.add(bottomCap);

    // Elegant inner felt pads inside cap recesses
    const padGeo = new THREE.CylinderGeometry(1.95, 1.95, 0.05, 32);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const topPad = new THREE.Mesh(padGeo, padMat);
    topPad.position.y = 3.24;
    capsGroup.add(topPad);
    const bottomPad = new THREE.Mesh(padGeo, padMat);
    bottomPad.position.y = -3.24;
    capsGroup.add(bottomPad);

    // (C) Connecting Pillars (Chrome/Golden Pillars spanning around glass body)
    const pillarsGroup = new THREE.Group();
    hourglassGroup.add(pillarsGroup);
    particlesRef.current.pillarsGroup = pillarsGroup;

    const pillarMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(initialPillar.pillarColor),
      roughness: initialPillar.roughness,
      metalness: initialPillar.metalness,
    });

    const pillarGeo = new THREE.CylinderGeometry(0.075, 0.075, 6.5, 16);
    
    // Position 3 pillars in a equilateral triangle arrangement
    const pillarRadius = 1.88;
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      const x = Math.cos(angle) * pillarRadius;
      const z = Math.sin(angle) * pillarRadius;
      
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(x, 0, z);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      pillarsGroup.add(pillar);
    }

    // (D) Metallic Neck Cuff Band at bottleneck center
    const cuffGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.2, 32);
    const cuff = new THREE.Mesh(cuffGeo, pillarMat);
    cuff.position.y = 0;
    cuff.castShadow = true;
    pillarsGroup.add(cuff);

    // --- 6. Sand Particles (THREE.InstancedMesh) ---
    // Using InstancedMesh renders 3000 spheres at 60 FPS under studio shadows!
    const activeTheme = SAND_THEMES.find(t => t.id === physicsParamsRef.current.sandColorId) || SAND_THEMES[0];
    // Slightly smaller physical radius to prevent bottleneck bridges/locking
    const particleRadius = 0.042;
    
    // Smooth, rounded sand grains (subdivision level 1 is highly optimized and looks beautiful!)
    const sandGeo = new THREE.IcosahedronGeometry(particleRadius, 1);
    const sandMat = new THREE.MeshStandardMaterial({
      roughness: 0.75,
      metalness: 0.12,
      shadowSide: THREE.DoubleSide
    });

    const maxParticles = 12000;
    const instancedMesh = new THREE.InstancedMesh(sandGeo, sandMat, maxParticles);
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;
    hourglassGroup.add(instancedMesh);
    particlesRef.current.instancedMesh = instancedMesh;

    // Seed initial particle positions in top bulb
    resetParticles(physicsParamsRef.current.sandCount);

    // --- 7. Sandbox Pile Cellular-Automaton Grid Setup ---
    // The flat occupancy grids representing settled grains to form accurate sand piles
    const gridDimX = 22;
    const gridDimY = 44;
    const gridDimZ = 22;
    const gridSize = gridDimX * gridDimY * gridDimZ;
    
    const gridMinX = -1.75;
    const gridMaxX = 1.75;
    const gridMinY = -3.22;
    const gridMaxY = 3.22;
    const gridMinZ = -1.75;
    const gridMaxZ = 1.75;
    
    const sizeX = gridMaxX - gridMinX;
    const sizeY = gridMaxY - gridMinY;
    const sizeZ = gridMaxZ - gridMinZ;
    
    const cellX = sizeX / gridDimX;
    const cellY = sizeY / gridDimY;
    const cellZ = sizeZ / gridDimZ;

    const grid = new Int32Array(gridSize);

    const getGridX = (x: number) => Math.floor(((x - gridMinX) / sizeX) * gridDimX);
    const getGridY = (y: number) => Math.floor(((y - gridMinY) / sizeY) * gridDimY);
    const getGridZ = (z: number) => Math.floor(((z - gridMinZ) / sizeZ) * gridDimZ);
    
    const getFlatIndex = (ix: number, iy: number, iz: number) => {
      if (ix < 0) ix = 0; else if (ix >= gridDimX) ix = gridDimX - 1;
      if (iy < 0) iy = 0; else if (iy >= gridDimY) iy = gridDimY - 1;
      if (iz < 0) iz = 0; else if (iz >= gridDimZ) iz = gridDimZ - 1;
      return ix + iy * gridDimX + iz * gridDimX * gridDimY;
    };

    // Colorizer helper: assign organic variations to sand instances
    const colorizeGrains = (theme: typeof activeTheme, count: number) => {
      if (!instancedMesh) return;
      const cCore = new THREE.Color(theme.color);
      const cGlitter = new THREE.Color(theme.glitter);
      const cAmbient = new THREE.Color(theme.ambient);
      const tempColor = new THREE.Color();

      for (let i = 0; i < maxParticles; i++) {
        if (i < count) {
          // Shimmer and grain texture
          const rand = Math.random();
          if (rand < 0.68) {
            tempColor.copy(cCore).multiplyScalar(0.95 + Math.random() * 0.1);
          } else if (rand < 0.88) {
            // Sparkles
            tempColor.copy(cGlitter);
          } else {
            // Shadows
            tempColor.copy(cAmbient).multiplyScalar(0.9 + Math.random() * 0.2);
          }
        } else {
          // Clear remaining slots
          tempColor.setHex(0x000000);
        }
        instancedMesh.setColorAt(i, tempColor);
      }
      instancedMesh.instanceColor!.needsUpdate = true;
    };

    colorizeGrains(activeTheme, physicsParamsRef.current.sandCount);

    // Initialize InstancedMesh positions
    const dummy = new THREE.Object3D();
    const updateInstancedMeshVisuals = (count: number) => {
      const part = particlesRef.current;
      for (let i = 0; i < maxParticles; i++) {
        if (i < count) {
          dummy.position.set(part.positions[i * 3], part.positions[i * 3 + 1], part.positions[i * 3 + 2]);
          
          // Apply individual random scale for beautiful volumetric and natural textured appearance!
          const scaleFactor = part.scales[i] || 1.0;
          dummy.scale.set(scaleFactor, scaleFactor, scaleFactor);
        } else {
          // Hide unused instances out of viewport
          dummy.position.set(999, 999, 999);
        }
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
    };

    // --- 8. Drag and Rotation Interaction Implementations ---
    const handlePointerDown = (e: PointerEvent) => {
      const rot = rotationRef.current;
      if (flipRef.current.isFlipping) return; // ignore interactions during system auto flips
      rot.isDragging = true;
      rot.startX = e.clientX;
      rot.startY = e.clientY;
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rot = rotationRef.current;
      if (!rot.isDragging || flipRef.current.isFlipping) return;
      const dx = e.clientX - rot.startX;
      const dy = e.clientY - rot.startY;
      
      // Update targets
      rot.targetY += dx * 0.009;
      rot.targetX += dy * 0.009;
      
      rot.startX = e.clientX;
      rot.startY = e.clientY;
    };

    const handlePointerUp = () => {
      rotationRef.current.isDragging = false;
    };

    // Mouse wheel zoom support
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.position.z = Math.min(Math.max(camera.position.z + e.deltaY * 0.005, 8.0), 22.0);
    };

    // Attach to custom renderer container
    const domEl = renderer.domElement;
    domEl.style.cursor = 'grab';
    domEl.addEventListener('pointerdown', handlePointerDown);
    domEl.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    // --- 9. Pure Physics Solver Inside Frame ticks ---
    let lastTime = performance.now();
    let frameTicker = 0;
    let requestID: number;

    const animateLoop = () => {
      requestID = requestAnimationFrame(animateLoop);
      const currentTime = performance.now();
      const elapsedFrameSec = Math.min((currentTime - lastTime) / 1000, 0.1); // cap latency spikes
      lastTime = currentTime;

      const pRef = physicsParamsRef.current;
      const part = particlesRef.current;
      const rot = rotationRef.current;
      const flip = flipRef.current;
      const shk = shakeRef.current;

      frameTicker++;

      // (A) Smooth Rotation Dampening
      if (flip.isFlipping) {
        flip.flipProgress += elapsedFrameSec * 1.85; // Flip speed
        if (flip.flipProgress >= 1.0) {
          flip.flipProgress = 1.0;
          flip.isFlipping = false;
          rot.targetX = flip.targetRotationX;
        }
        // Quadratic ease-in-out
        const t = flip.flipProgress;
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        rot.currentX = flip.startRotationX + (flip.targetRotationX - flip.startRotationX) * ease;
      } else {
        // Linear damp / spring towards target values on dragging
        rot.currentX += (rot.targetX - rot.currentX) * 0.12;
      }
      rot.currentY += (rot.targetY - rot.currentY) * 0.12;

      // Apply rotations to core Group
      hourglassGroup.rotation.set(0, 0, 0); // Reset Euler
      hourglassGroup.rotateX(rot.currentX);
      hourglassGroup.rotateY(rot.currentY);

      // (B) Materials Synchronizations
      const currentThemeInfo = SAND_THEMES.find(t => t.id === pRef.sandColorId) || SAND_THEMES[0];
      const currentGlassInfo = GLASS_TINTS.find(g => g.id === pRef.glassTintId) || GLASS_TINTS[0];
      const currentPillarInfo = PILLAR_MATERIALS.find(p => p.id === pRef.pillarMaterialId) || PILLAR_MATERIALS[0];

      // Update materials properties incrementally
      glassMat.color.set(currentGlassInfo.color);
      glassMat.roughness = currentGlassInfo.roughness;
      glassMat.ior = currentGlassInfo.ior;
      glassMat.transmission = currentGlassInfo.transmission;
      
      capMat.color.set(currentPillarInfo.capColor);
      capMat.roughness = currentPillarInfo.roughness + 0.1;
      capMat.metalness = currentPillarInfo.metalness * 0.5;

      pillarMat.color.set(currentPillarInfo.pillarColor);
      pillarMat.roughness = currentPillarInfo.roughness;
      pillarMat.metalness = currentPillarInfo.metalness;

      // Update spot light glow properties matching sand colors
      neckSpotLight.color.set(currentThemeInfo.glow);

      // Trigger grain recoloring if Sand Theme changes
      if (instancedMesh) {
        colorizeGrains(currentThemeInfo, pRef.sandCount);
      }

      // Handle Shake Decay
      if (shk.shakeIntensity > 0.05) {
        shk.shakeIntensity *= 0.92; // exponential decay
        const offsetIntensity = shk.shakeIntensity * 0.035;
        // Jitter structural groups
        hourglassGroup.position.set(
          (Math.random() - 0.5) * offsetIntensity,
          (Math.random() - 0.5) * offsetIntensity,
          (Math.random() - 0.5) * offsetIntensity
        );
      } else {
        hourglassGroup.position.set(0, 0, 0);
      }

      // (C) GRAVITY Vector Configurations
      // Calculate local gravity based on world physical down vector [0, -9.81, 0] rotated into hourglass group space
      const gWorld = new THREE.Vector3(0, -9.81, 0);
      
      if (pRef.gyroEnabled && gyroRef.current.calibrated) {
        // Overwrite world gravity with physical device sensor measurements
        gWorld.set(gyroRef.current.deviceX, gyroRef.current.deviceY, gyroRef.current.deviceZ);
      } else {
        // Overwrite world gravity using the manual tilt sliders (tiltX and tiltZ are in degrees)
        const radX = (pRef.tiltX * Math.PI) / 180;
        const radZ = (pRef.tiltZ * Math.PI) / 180;
        
        const rawG = new THREE.Vector3(0, -9.81, 0);
        // Apply Z-tilt rotation (roll)
        rawG.applyAxisAngle(new THREE.Vector3(0, 0, 1), radZ);
        // Apply X-tilt rotation (pitch)
        rawG.applyAxisAngle(new THREE.Vector3(1, 0, 0), radX);
        
        gWorld.copy(rawG);
      }

      // Map gravity from world to rotated hourglass local frame
      const currentHourglassQuat = hourglassGroup.quaternion.clone();
      const localG = gWorld.clone().applyQuaternion(currentHourglassQuat.invert());

      // If user is actively dragging or shaking, add localized inertia forces!
      if (rot.isDragging) {
        // Subtle drift proportional to drag speed
        localG.x += (Math.random() - 0.5) * 1.5;
        localG.z += (Math.random() - 0.5) * 1.5;
      }
      
      if (shk.shakeIntensity > 0.1) {
        // High frequency chaotic energy vectors
        localG.x += (Math.random() - 0.5) * shk.shakeIntensity * 6;
        localG.y += (Math.random() - 0.5) * shk.shakeIntensity * 6;
        localG.z += (Math.random() - 0.5) * shk.shakeIntensity * 6;
      }

      // Only run simulation when flow is non-paused and frames are flowing
      const coreSpeed = pRef.flowMultiplier;
      part.flowCount = 0;

      if (coreSpeed > 0) {
        // Sub-stepping loops ensures high density stacking without pass-through glitches
        const substepsCount = 5;
        const subDt = 0.003 * coreSpeed; // Velocity/force updates are run with high frequency
        
        for (let step = 0; step < substepsCount; step++) {
          // (C1) Clear and populate occupancy grid with all settled sand nodes
          grid.fill(-1);
          for (let i = 0; i < pRef.sandCount; i++) {
            if (part.settled[i] === 1) {
              const ix = getGridX(part.positions[i * 3]);
              const iy = getGridY(part.positions[i * 3 + 1]);
              const iz = getGridZ(part.positions[i * 3 + 2]);
              grid[getFlatIndex(ix, iy, iz)] = i;
            }
          }

          // (C2) Unsettling checks:
          // A particle is unsettled if empty spaces appear direct under it relative to latest local gravity angles
          const gLen = localG.length();
          const ux = gLen > 0.1 ? localG.x / gLen : 0;
          const uy = gLen > 0.1 ? localG.y / gLen : -1;
          const uz = gLen > 0.1 ? localG.z / gLen : 0;

          // Compute gravity step vectors in grid cubes
          const gStepX = Math.round(ux * 1.22);
          const gStepY = Math.round(uy * 1.22);
          const gStepZ = Math.round(uz * 1.22);

          // Liquidate sand joints block-by-block if support collapses
          // We check EVERY particle EVERY step to completely avoid sleeping/hanging-in-air latency!
          for (let i = 0; i < pRef.sandCount; i++) {
            if (part.settled[i] === 1) {
              const px = part.positions[i * 3];
              const py = part.positions[i * 3 + 1];
              const pz = part.positions[i * 3 + 2];

              // Neck area bridge-breaking active micro-jitter
              // Disintegrate stable bridges and arch formations under gravitational tilt or thermal agitation
              if (Math.abs(py) < 0.45) {
                const horizontalTilt = Math.sqrt(localG.x * localG.x + localG.z * localG.z);
                if (Math.random() < 0.008 + horizontalTilt * 0.01) {
                  part.settled[i] = 0;
                  part.velocities[i * 3]     = (Math.random() - 0.5) * 0.15;
                  part.velocities[i * 3 + 1] = -Math.abs(localG.y) * 0.05 + (Math.random() - 0.5) * 0.05;
                  part.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.15;
                  continue;
                }
              }

              const ix = getGridX(px);
              const iy = getGridY(py);
              const iz = getGridZ(pz);

              const downIx = ix + gStepX;
              const downIy = iy + gStepY;
              const downIz = iz + gStepZ;

              // Check if downward cell lies indeed inside glass region
              const phX = gridMinX + (downIx + 0.5) * cellX;
              const phY = gridMinY + (downIy + 0.5) * cellY;
              const phZ = gridMinZ + (downIz + 0.5) * cellZ;

              // Factor in individual particle scales to align exact collision limits
              const pRad = particleRadius * (part.scales[i] || 1.0);
              const boundaryR = getGlassRadius(phY) - pRad;
              const radialD = Math.sqrt(phX*phX + phZ*phZ);

              if (radialD < boundaryR && phY >= -3.22 && phY <= 3.22) {
                const downFlat = getFlatIndex(downIx, downIy, downIz);
                if (grid[downFlat] === -1) {
                  // Support missing - wake up and fall down!
                  part.settled[i] = 0;
                  part.velocities[i * 3] = (Math.random() - 0.5) * 0.1;
                  part.velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.1;
                  part.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
                }
              } else {
                // Out of physical boundaries triggers awakening to slide back inside safely
                part.settled[i] = 0;
              }
            }
          }

          // (C3) Move Active Sand Grains
          for (let i = 0; i < pRef.sandCount; i++) {
            if (part.settled[i] === 1) continue; // Skip static crystals

            let px = part.positions[i * 3];
            let py = part.positions[i * 3 + 1];
            let pz = part.positions[i * 3 + 2];

            let vx = part.velocities[i * 3];
            let vy = part.velocities[i * 3 + 1];
            let vz = part.velocities[i * 3 + 2];

            // Apply relative gravity forces
            vx += localG.x * subDt;
            vy += localG.y * subDt;
            vz += localG.z * subDt;

            // Fluid drag resistance
            vx *= 0.985;
            vy *= 0.985;
            vz *= 0.985;

            // Solve proposed step
            let nx_val = px + vx * subDt;
            let ny_val = py + vy * subDt;
            let nz_val = pz + vz * subDt;

            // [GLASS BOUNDARY REFLECTIONS]
            const pRad = particleRadius * (part.scales[i] || 1.0);
            const checkRadius = getGlassRadius(ny_val) - pRad;
            const curRad = Math.sqrt(nx_val * nx_val + nz_val * nz_val);

            if (curRad > checkRadius) {
              // Push inside limits
              const penetrate = curRad - checkRadius;
              const radX = curRad > 0 ? nx_val / curRad : 1;
              const radZ = curRad > 0 ? nz_val / curRad : 0;

              const slope = getGlassRadiusDerivative(ny_val);
              
              // Surface normal vectors calculation
              const rawNx = -radX;
              const rawNy = slope; // Points upward if vessel bounds contract
              const rawNz = -radZ;
              const surfLen = Math.sqrt(rawNx*rawNx + rawNy*rawNy + rawNz*rawNz);
              
              const normX = rawNx / (surfLen + 0.0001);
              const normY = rawNy / (surfLen + 0.0001);
              const normZ = rawNz / (surfLen + 0.0001);

              nx_val += normX * penetrate * 1.05;
              ny_val += normY * penetrate * 1.05;
              nz_val += normZ * penetrate * 1.05;

              // Damp velocity on wall impact to simulate sliding sand friction
              const vNormal = vx * normX + vy * normY + vz * normZ;
              if (vNormal < 0) {
                // Tweak 4: Inelastic bounce (restitution coefficient e ~ 0.02)
                vx -= 1.02 * vNormal * normX;
                vy -= 1.02 * vNormal * normY;
                vz -= 1.02 * vNormal * normZ;

                // Tweak 1: Make glass sliding extremely slippery (low sliding friction!)
                vx *= 0.85; 
                vy *= 0.85;
                vz *= 0.85;
              }
            }

            // [BASE LAYER BOUNDARY WRAPS]
            if (ny_val > 3.21) {
              ny_val = 3.21;
              vy = -Math.abs(vy) * 0.1;
              vx *= 0.6;
              vz *= 0.6;
            } else if (ny_val < -3.21) {
              ny_val = -3.21;
              vy = Math.abs(vy) * 0.1;
              vx *= 0.6;
              vz *= 0.6;
            }

            // Tweak 5: Inject subtle micro-jitter / horizontal thermal dispersion breaking early arches around bottleneck neck
            if (Math.abs(ny_val) < 0.45) {
              vx += (Math.random() - 0.5) * 0.05;
              vz += (Math.random() - 0.5) * 0.05;
            }

            // [BOTTLENECK FLOW OPTIMIZATIONS]
            // Bypass high-friction self-grid heap collisions right inside neck constricted pipe |y| < 0.3
            // This grants a super realistic fluid streaming look and prevents choking!
            const bypassSettleIndexCheck = Math.abs(ny_val) < 0.30 && curRad < 0.22 && localG.y < -3.0;

            if (bypassSettleIndexCheck) {
              // Accelerate streams straight down with fine dispersion
              vy -= 0.85;
              vx += (Math.random() - 0.5) * 0.07;
              vz += (Math.random() - 0.5) * 0.07;
              part.flowCount++;
            } else {
              // Standard grid pile collisions check
              const nG_x = getGridX(nx_val);
              const nG_y = getGridY(ny_val);
              const nG_z = getGridZ(nz_val);
              const cellFlat = getFlatIndex(nG_x, nG_y, nG_z);

              if (grid[cellFlat] !== -1) {
                // Collided with sand heap! Run sand-pile rolling slide paths
                let targetX = 0;
                let targetY = 0;
                let targetZ = 0;
                // Tweak 2: Align "Angle of Repose" to find any positive downwards slope
                let maxSlideVal = 0.001;

                // Scan nearest surroundings for downslope gaps
                for (let dx = -1; dx <= 1; dx++) {
                  for (let dy = -1; dy <= 1; dy++) {
                    for (let dz = -1; dz <= 1; dz++) {
                      if (dx === 0 && dy === 0 && dz === 0) continue;

                      const checkIx = nG_x + dx;
                      const checkIy = nG_y + dy;
                      const checkIz = nG_z + dz;
                      const checkFlat = getFlatIndex(checkIx, checkIy, checkIz);

                      if (grid[checkFlat] === -1) {
                        const cellPhyX = gridMinX + (checkIx + 0.5) * cellX;
                        const cellPhyY = gridMinY + (checkIy + 0.5) * cellY;
                        const cellPhyZ = gridMinZ + (checkIz + 0.5) * cellZ;

                        const curRadC = Math.sqrt(cellPhyX*cellPhyX + cellPhyZ*cellPhyZ);
                        const curLimit = getGlassRadius(cellPhyY) - pRad;

                        if (curRadC < curLimit && cellPhyY >= -3.24 && cellPhyY <= 3.24) {
                          // Potential dots product
                          const dotPot = dx * cellX * ux + dy * cellY * uy + dz * cellZ * uz;
                          if (dotPot > maxSlideVal) {
                            maxSlideVal = dotPot;
                            targetX = dx;
                            targetY = dy;
                            targetZ = dz;
                          }
                        }
                      }
                    }
                  }
                }

                if (maxSlideVal > 0.001) {
                  // Tweak 1: Make rolling slide extremely slippery with high momentum retention (vx *= 0.78)
                  nx_val += targetX * cellX * 0.75;
                  ny_val += targetY * cellY * 0.75;
                  nz_val += targetZ * cellZ * 0.75;

                  vx += targetX * cellX * 8.5;
                  vy += targetY * cellY * 8.5;
                  vz += targetZ * cellZ * 8.5;
                  
                  vx *= 0.78;
                  vy *= 0.78;
                  vz *= 0.78;
                } else {
                  // No steeper paths - freeze and settle
                  part.settled[i] = 1;
                  vx = 0;
                  vy = 0;
                  vz = 0;
                  grid[cellFlat] = i;

                  // Slightly snap towards cell boundaries with jitter to prevent structured grid rows look!
                  const targetCenter_x = gridMinX + (nG_x + 0.5) * cellX;
                  const targetCenter_y = gridMinY + (nG_y + 0.5) * cellY;
                  const targetCenter_z = gridMinZ + (nG_z + 0.5) * cellZ;
                  
                  // Wrap settled coordinates inside the grid cell with organic fluffy spatial noise
                  nx_val = targetCenter_x + (Math.random() - 0.5) * cellX * 0.55;
                  ny_val = targetCenter_y + (Math.random() - 0.5) * cellY * 0.40;
                  nz_val = targetCenter_z + (Math.random() - 0.5) * cellZ * 0.55;

                  // Keep strict physical constraints inside the double-curved glass walls upon settling
                  const finalLimit = getGlassRadius(ny_val) - pRad - 0.01;
                  const finalRadialD = Math.sqrt(nx_val * nx_val + nz_val * nz_val);
                  if (finalRadialD > finalLimit && finalLimit > 0) {
                    const ratio = finalLimit / finalRadialD;
                    nx_val *= ratio;
                    nz_val *= ratio;
                  }
                }
              }
            }

            // Save variables back
            part.positions[i * 3] = nx_val;
            part.positions[i * 3 + 1] = ny_val;
            part.positions[i * 3 + 2] = nz_val;

            part.velocities[i * 3] = vx;
            part.velocities[i * 3 + 1] = vy;
            part.velocities[i * 3 + 2] = vz;
          }
        }
      }

      // Record running timers
      part.totalElapsed += elapsedFrameSec * (coreSpeed > 0 ? 1 : 0);

      // (D) Synchronize graphics buffer elements
      updateInstancedMeshVisuals(pRef.sandCount);

      // (E) Trigger panel reports periodically to throttle React rendering thread
      if (frameTicker % 10 === 0) {
        let topCount = 0;
        let bottomCount = 0;
        for (let i = 0; i < pRef.sandCount; i++) {
          if (part.positions[i * 3 + 1] > 0.0) {
            topCount++;
          } else {
            bottomCount++;
          }
        }
        
        part.topPercentage = Math.round((topCount / pRef.sandCount) * 100);
        part.bottomPercentage = Math.round((bottomCount / pRef.sandCount) * 100);

        const currentGx = Math.round(localG.x * 10) / 10;
        const currentGy = Math.round(localG.y * 10) / 10;
        const currentGz = Math.round(localG.z * 10) / 10;

        onStatsUpdate({
          topPercentage: part.topPercentage,
          bottomPercentage: part.bottomPercentage,
          flowCount: part.flowCount,
          elapsedSec: Math.round(part.totalElapsed),
          sensorAvailable: gyroRef.current.hasSensor,
          sensorReading: `X:${currentGx}, Y:${currentGy}, Z:${currentGz} m/s²`,
        });
      }

      // Run renderer frame
      renderer.render(scene, camera);
    };

    animateLoop();

    // Use ResizeObserver to dynamically update canvas dimension changes beautifully
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const entry = entries[0];
      const w = entry.contentRect.width;
      const h = entry.contentRect.height;
      if (w <= 0 || h <= 0) return;
      
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      adjustCameraDistance(w, h);
    });
    
    resizeObserver.observe(currentMount);

    // Cleanups
    return () => {
      cancelAnimationFrame(requestID);
      resizeObserver.disconnect();
      domEl.removeEventListener('pointerdown', handlePointerDown);
      domEl.removeEventListener('wheel', handleWheel);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      if (currentMount && domEl.parentNode === currentMount) {
        currentMount.removeChild(domEl);
      }
      scene.clear();
      renderer.dispose();
    };
  }, []);

  // Soft updates to reposition existing particles dynamically when reset occurs
  const handleResetTrigger = () => {
    resetParticles(physicsParamsRef.current.sandCount);
    particlesRef.current.totalElapsed = 0;
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center select-none">
      <div 
        ref={mountRef} 
        className="w-full h-full active:cursor-grabbing flex items-center justify-center transition-all duration-300"
        style={{ touchAction: 'none' }} // Disable native scrolls on mobile touch devices
        id="aistudio_hourglass_canvas_viewport"
      />
      
      {/* Floating Interactive Quick Reset Trigger */}
      <div className="absolute right-4 bottom-4 flex flex-col gap-2 pointer-events-auto">
        <button
          onClick={handleResetTrigger}
          className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-full border border-white/20 backdrop-blur-md shadow-lg transition-all"
          title="Reset Sand"
          id="btn_canvas_reset_sand"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
        </button>
      </div>
    </div>
  );
}
