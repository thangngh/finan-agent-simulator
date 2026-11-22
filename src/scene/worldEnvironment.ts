import * as THREE from 'three';
import { SimulationState, ZoneId } from '../types/finance';
import { ZONE_METADATA } from '../simulation/financialEngine';
import { WorldMaterialLibrary } from './materials';

const _vec3 = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _mat4 = new THREE.Matrix4();
const _color = new THREE.Color();

export interface WorldEnvironmentRig {
  group: THREE.Group;
  update: (elapsed: number, dt: number, state: SimulationState) => void;
  dispose: () => void;
}

const CONDUIT_SOURCES: ZoneId[] = [
  'department1',
  'department2',
  'department3',
  'department4',
  'department5',
  'lawer1',
  'lawer2',
];

export function createWorldEnvironment(mats: WorldMaterialLibrary): WorldEnvironmentRig {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const localMats: THREE.Material[] = [];

  // 1. Main circular plaza deck (y = 0 top surface)
  const plazaGeo = new THREE.CylinderGeometry(16.8, 17.5, 0.8, 64);
  geos.push(plazaGeo);
  const plaza = new THREE.Mesh(plazaGeo, mats.plazaSurface);
  plaza.position.y = -0.4;
  plaza.receiveShadow = true;
  group.add(plaza);

  // Brass rim curb around plaza
  const curbGeo = new THREE.TorusGeometry(16.85, 0.12, 10, 84);
  curbGeo.rotateX(Math.PI / 2);
  geos.push(curbGeo);
  const curb = new THREE.Mesh(curbGeo, mats.brushedBrass);
  curb.position.y = 0.02;
  group.add(curb);

  // 2. Reflective surrounding moat water plane (offset downward so no Z-fighting)
  const moatGeo = new THREE.RingGeometry(17.2, 42, 64);
  moatGeo.rotateX(-Math.PI / 2);
  geos.push(moatGeo);
  const moat = new THREE.Mesh(moatGeo, mats.moatWater);
  moat.position.y = -0.58;
  moat.receiveShadow = true;
  group.add(moat);

  // 3. Natural terraced perimeter island terrain fading into horizon fog
  const outerRingGeo = new THREE.RingGeometry(30, 110, 64, 4);
  outerRingGeo.rotateX(-Math.PI / 2);
  // Gently undulate outer terrain vertices
  const posAttr = outerRingGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const dist = Math.hypot(vx, vz);
    const angle = Math.atan2(vz, vx);
    const ridge =
      dist > 31
        ? (Math.sin(angle * 7) * 1.4 + Math.cos(angle * 11) * 0.9 + 1.8) *
          Math.min(1, (dist - 30) / 22)
        : -0.9;
    posAttr.setY(i, ridge - 0.65);
  }
  outerRingGeo.computeVertexNormals();
  geos.push(outerRingGeo);
  const outerTerrain = new THREE.Mesh(outerRingGeo, mats.terrainHill);
  outerTerrain.receiveShadow = true;
  group.add(outerTerrain);

  // 4. Instanced Architectural Trees & Rock Outcrops on outer island perimeter (44 instances)
  const treeCount = 44;
  const trunkGeo = new THREE.CylinderGeometry(0.11, 0.18, 1.35, 8);
  trunkGeo.translate(0, 0.675, 0);
  const canopyGeo = new THREE.ConeGeometry(0.75, 2.25, 7);
  canopyGeo.translate(0, 2.1, 0);
  geos.push(trunkGeo, canopyGeo);

  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x3b2f2f,
    roughness: 0.9,
    metalness: 0.02,
  });
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.78,
    metalness: 0.05,
  });
  localMats.push(trunkMat, canopyMat);

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const canopyInst = new THREE.InstancedMesh(canopyGeo, canopyMat, treeCount);
  trunkInst.castShadow = true;
  canopyInst.castShadow = true;

  for (let i = 0; i < treeCount; i++) {
    const angle = (i / treeCount) * Math.PI * 2 + (i % 3) * 0.07;
    const radius = 32.5 + ((i * 17) % 14);
    const tx = Math.cos(angle) * radius;
    const tz = Math.sin(angle) * radius;
    const ty = 0.6 + Math.sin(angle * 7) * 0.6;
    const sc = 0.85 + ((i * 29) % 30) / 100; // ±15% variation

    _vec3.set(tx, ty, tz);
    _quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    _scale.setScalar(sc);
    _mat4.compose(_vec3, _quat, _scale);

    trunkInst.setMatrixAt(i, _mat4);
    canopyInst.setMatrixAt(i, _mat4);

    // Subtle botanical green-teal slate variations
    _color.setHSL(0.43 + (i % 5) * 0.015, 0.32, 0.22 + (i % 4) * 0.03);
    canopyInst.setColorAt(i, _color);
  }
  trunkInst.instanceMatrix.needsUpdate = true;
  canopyInst.instanceMatrix.needsUpdate = true;
  if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  canopyInst.computeBoundingSphere();
  group.add(trunkInst, canopyInst);

  // 5. Data Conduit Tubes linking every department & legal wing to Center
  const curves: THREE.CatmullRomCurve3[] = [];
  const conduitColors: THREE.Color[] = [];

  CONDUIT_SOURCES.forEach((zoneId) => {
    const meta = ZONE_METADATA[zoneId];
    const [sx, , sz] = meta.worldPos;
    const midX = sx * 0.52;
    const midZ = sz * 0.52;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx, 0.18, sz),
      new THREE.Vector3(midX, 0.42, midZ),
      new THREE.Vector3(sx * 0.2, 0.25, sz * 0.2),
      new THREE.Vector3(0, 0.55, 0),
    ]);
    curves.push(curve);
    conduitColors.push(new THREE.Color(meta.accentHex));

    const tubeGeo = new THREE.TubeGeometry(curve, 36, 0.08, 8, false);
    geos.push(tubeGeo);
    const tube = new THREE.Mesh(tubeGeo, mats.conduitPipe);
    tube.receiveShadow = true;
    group.add(tube);
  });

  // 6. Instanced Animated Data Flow Packets (20 per conduit = 140 packets)
  const packetsPerCurve = 20;
  const totalPackets = curves.length * packetsPerCurve;
  const packetGeo = new THREE.SphereGeometry(0.11, 10, 10);
  geos.push(packetGeo);
  const packetMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  localMats.push(packetMat);

  const packetInst = new THREE.InstancedMesh(packetGeo, packetMat, totalPackets);
  packetInst.frustumCulled = false; // dynamic instances
  let idx = 0;
  for (let c = 0; c < curves.length; c++) {
    for (let p = 0; p < packetsPerCurve; p++) {
      packetInst.setColorAt(idx, conduitColors[c]);
      idx++;
    }
  }
  if (packetInst.instanceColor) packetInst.instanceColor.needsUpdate = true;
  group.add(packetInst);

  return {
    group,
    update: (elapsed, _dt, state) => {
      const baseSpeed = 0.14 + Math.min(0.32, state.annualVolatilityPct * 0.009);
      let k = 0;
      for (let c = 0; c < curves.length; c++) {
        const curve = curves[c];
        // War & Legal wings pulse faster when their risk scores elevate
        let speedMult = 1.0;
        if (c === 1) speedMult = 1 + state.geopoliticalRiskIndex / 90;
        if (c === 5) speedMult = 1 + state.legalRiskScore / 100;
        if (c === 6) speedMult = 1 + state.investmentRiskScore / 100;

        for (let p = 0; p < packetsPerCurve; p++) {
          const t = (elapsed * baseSpeed * speedMult + p / packetsPerCurve + c * 0.11) % 1;
          curve.getPointAt(t, _vec3);
          const pulse = 0.85 + Math.sin(elapsed * 5 + p) * 0.25;
          _scale.setScalar(pulse);
          _quat.identity();
          _mat4.compose(_vec3, _quat, _scale);
          packetInst.setMatrixAt(k, _mat4);
          k++;
        }
      }
      packetInst.instanceMatrix.needsUpdate = true;
    },
    dispose: () => {
      geos.forEach((g) => g.dispose());
      localMats.forEach((m) => m.dispose());
    },
  };
}
