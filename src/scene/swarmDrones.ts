import * as THREE from 'three';
import { ZONE_METADATA } from '../simulation/financialEngine';
import { SwarmAgentStance, SwarmRunResult, SwarmStatus, ZoneId } from '../types/finance';
import { WorldMaterialLibrary } from './materials';

const _pos = new THREE.Vector3();
const _target = new THREE.Vector3();

type SpecialistZoneId = Exclude<ZoneId, 'overview' | 'center'>;

const AGENT_HOME_ZONES: SpecialistZoneId[] = [
  'department1',
  'department2',
  'department3',
  'department4',
  'department5',
  'lawer1',
  'lawer2',
];

const STANCE_COLORS: Record<SwarmAgentStance, number> = {
  bullish: 0x10b981,
  neutral: 0x38bdf8,
  cautious: 0xf59e0b,
  veto: 0xef4444,
};

export interface SwarmDronesRig {
  group: THREE.Group;
  update: (
    elapsed: number,
    dt: number,
    swarmStatus: SwarmStatus,
    lastRun: SwarmRunResult | null,
  ) => void;
  dispose: () => void;
}

export function createSwarmDrones(mats: WorldMaterialLibrary): SwarmDronesRig {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const localMats: THREE.Material[] = [];

  // Shared composite drone geometries
  const chassisGeo = new THREE.OctahedronGeometry(0.24, 0);
  chassisGeo.scale(1.15, 0.72, 1.35);
  const haloGeo = new THREE.TorusGeometry(0.36, 0.032, 8, 24);
  haloGeo.rotateX(Math.PI / 2);
  const lensGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.16, 12);
  lensGeo.rotateX(Math.PI / 2);
  const coreGeo = new THREE.SphereGeometry(0.11, 12, 12);
  geos.push(chassisGeo, haloGeo, lensGeo, coreGeo);

  const drones: Array<{
    zoneId: SpecialistZoneId;
    root: THREE.Group;
    halo: THREE.Mesh;
    coreMat: THREE.MeshStandardMaterial;
    curve: THREE.CatmullRomCurve3;
    phaseOffset: number;
  }> = [];

  AGENT_HOME_ZONES.forEach((zoneId, idx) => {
    const meta = ZONE_METADATA[zoneId];
    const [hx, , hz] = meta.worldPos;
    const orbitAngle = (idx / AGENT_HOME_ZONES.length) * Math.PI * 2;

    const curve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(hx, 3.8, hz),
        new THREE.Vector3(hx * 0.55 + Math.cos(orbitAngle) * 1.4, 5.2, hz * 0.55 + Math.sin(orbitAngle) * 1.4),
        new THREE.Vector3(Math.cos(orbitAngle) * 3.6, 4.9, Math.sin(orbitAngle) * 3.6),
        new THREE.Vector3(hx * 0.45 - Math.cos(orbitAngle) * 1.1, 4.3, hz * 0.45 - Math.sin(orbitAngle) * 1.1),
      ],
      true,
    );

    const droneRoot = new THREE.Group();
    const chassis = new THREE.Mesh(chassisGeo, mats.slateMid);
    chassis.castShadow = true;
    droneRoot.add(chassis);

    const halo = new THREE.Mesh(haloGeo, mats.brushedBrass);
    droneRoot.add(halo);

    const lens = new THREE.Mesh(lensGeo, mats.brushedPlatinum);
    lens.position.z = 0.28;
    droneRoot.add(lens);

    const coreMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(meta.accentHex),
      emissive: new THREE.Color(meta.accentHex),
      emissiveIntensity: 1.35,
      roughness: 0.2,
      metalness: 0.2,
    });
    localMats.push(coreMat);
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = 0.14;
    droneRoot.add(core);

    droneRoot.position.set(hx, 3.8, hz);
    group.add(droneRoot);

    drones.push({
      zoneId,
      root: droneRoot,
      halo,
      coreMat,
      curve,
      phaseOffset: idx / AGENT_HOME_ZONES.length,
    });
  });

  return {
    group,
    update: (elapsed, dt, swarmStatus, lastRun) => {
      const deliberating = swarmStatus === 'deliberating';

      for (let i = 0; i < drones.length; i++) {
        const d = drones[i];
        d.halo.rotation.y += dt * (deliberating ? 6.5 : 2.2);

        if (deliberating) {
          // Converge to tight orbital swarm ring around Center Citadel
          const angle = elapsed * 1.45 + d.phaseOffset * Math.PI * 2;
          const r = 3.4 + Math.sin(elapsed * 2.5 + i) * 0.35;
          _target.set(
            Math.cos(angle) * r,
            4.6 + Math.sin(elapsed * 3.1 + i * 0.9) * 0.45,
            Math.sin(angle) * r,
          );
          d.root.position.x = THREE.MathUtils.damp(d.root.position.x, _target.x, 4.2, dt);
          d.root.position.y = THREE.MathUtils.damp(d.root.position.y, _target.y, 4.2, dt);
          d.root.position.z = THREE.MathUtils.damp(d.root.position.z, _target.z, 4.2, dt);
          d.root.lookAt(0, 4.2, 0);
        } else {
          // Patrol along department <-> Center data corridor
          const t = (elapsed * 0.085 + d.phaseOffset) % 1;
          const nextT = (t + 0.02) % 1;
          d.curve.getPointAt(t, _pos);
          d.curve.getPointAt(nextT, _target);
          d.root.position.x = THREE.MathUtils.damp(d.root.position.x, _pos.x, 4.5, dt);
          d.root.position.y = THREE.MathUtils.damp(
            d.root.position.y,
            _pos.y + Math.sin(elapsed * 2.2 + i) * 0.16,
            4.5,
            dt,
          );
          d.root.position.z = THREE.MathUtils.damp(d.root.position.z, _pos.z, 4.5, dt);
          d.root.lookAt(_target);
        }

        // Color core based on live Agent stance from last Swarm run
        if (deliberating) {
          d.coreMat.color.setHex(0xf59e0b);
          d.coreMat.emissive.setHex(0xf59e0b);
          d.coreMat.emissiveIntensity = 1.8;
        } else if (lastRun) {
          const report = lastRun.specialistReports.find((r) => r.agentId === d.zoneId);
          if (report) {
            const hex = STANCE_COLORS[report.stance];
            d.coreMat.color.setHex(hex);
            d.coreMat.emissive.setHex(hex);
            d.coreMat.emissiveIntensity = report.stance === 'veto' ? 2.0 : 1.25;
          }
        }
      }
    },
    dispose: () => {
      geos.forEach((g) => g.dispose());
      localMats.forEach((m) => m.dispose());
    },
  };
}
