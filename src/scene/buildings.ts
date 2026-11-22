import * as THREE from 'three';
import { SimulationState, ZoneId } from '../types/finance';
import { ZONE_METADATA } from '../simulation/financialEngine';
import { WorldMaterialLibrary } from './materials';

export interface BuildingRig {
  group: THREE.Group;
  hitProxy: THREE.Mesh;
  update: (elapsed: number, dt: number, state: SimulationState, isSelected: boolean) => void;
  dispose: () => void;
}

function addContactShadow(
  parent: THREE.Group,
  mats: WorldMaterialLibrary,
  radius: number,
  disposables: THREE.BufferGeometry[],
) {
  const geo = new THREE.PlaneGeometry(radius * 2.2, radius * 2.2);
  geo.rotateX(-Math.PI / 2);
  disposables.push(geo);
  const shadow = new THREE.Mesh(geo, mats.contactShadow);
  shadow.position.y = 0.025;
  shadow.renderOrder = 1;
  parent.add(shadow);
}

function createHitProxy(
  parent: THREE.Group,
  zoneId: ZoneId,
  width: number,
  height: number,
  depth: number,
  disposables: THREE.BufferGeometry[],
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(width, height, depth);
  disposables.push(geo);
  const mat = new THREE.MeshBasicMaterial({ visible: false });
  const proxy = new THREE.Mesh(geo, mat);
  proxy.position.y = height * 0.5;
  proxy.layers.set(1);
  proxy.userData.zoneId = zoneId;
  parent.add(proxy);
  return proxy;
}

function createSelectionRing(
  parent: THREE.Group,
  radius: number,
  accentHex: string,
  disposables: THREE.BufferGeometry[],
): THREE.Mesh {
  const geo = new THREE.RingGeometry(radius, radius + 0.16, 48);
  geo.rotateX(-Math.PI / 2);
  disposables.push(geo);
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(accentHex),
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.04;
  parent.add(mesh);
  return mesh;
}

function makeOctagonShape(radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

// 1. CENTER: Investment Decision Citadel
export function createCenterCitadel(mats: WorldMaterialLibrary): BuildingRig {
  const meta = ZONE_METADATA.center;
  const group = new THREE.Group();
  group.position.set(...meta.worldPos);
  const geos: THREE.BufferGeometry[] = [];
  const localMats: THREE.Material[] = [];

  addContactShadow(group, mats, 4.2, geos);
  const selRing = createSelectionRing(group, 4.15, meta.accentHex, geos);

  // Part 1: Stepped beveled octagonal plinth (ExtrudeGeometry)
  const baseGeo = new THREE.ExtrudeGeometry(makeOctagonShape(3.6), {
    depth: 0.55,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.12,
    bevelSegments: 2,
  });
  baseGeo.rotateX(-Math.PI / 2);
  geos.push(baseGeo);
  const base = new THREE.Mesh(baseGeo, mats.basaltDark);
  base.position.y = 0.1;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Part 2: Upper limestone terrace
  const upperGeo = new THREE.CylinderGeometry(2.75, 3.0, 0.45, 8);
  geos.push(upperGeo);
  const upper = new THREE.Mesh(upperGeo, mats.limestone);
  upper.position.y = 0.85;
  upper.castShadow = true;
  upper.receiveShadow = true;
  group.add(upper);

  // Part 3: 8 perimeter architectural pillars + brass capitals
  const colGeo = new THREE.CylinderGeometry(0.14, 0.17, 2.35, 12);
  const capGeo = new THREE.BoxGeometry(0.42, 0.14, 0.42);
  geos.push(colGeo, capGeo);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const col = new THREE.Mesh(colGeo, mats.limestone);
    col.position.set(Math.cos(angle) * 2.3, 2.25, Math.sin(angle) * 2.3);
    col.castShadow = true;
    group.add(col);

    const cap = new THREE.Mesh(capGeo, mats.brushedBrass);
    cap.position.set(Math.cos(angle) * 2.3, 3.45, Math.sin(angle) * 2.3);
    cap.rotation.y = -angle;
    group.add(cap);
  }

  // Part 4: Glass rotunda enclosure (depthWrite: false)
  const glassGeo = new THREE.CylinderGeometry(1.9, 1.9, 2.1, 24, 1, true);
  geos.push(glassGeo);
  const glass = new THREE.Mesh(glassGeo, mats.opticalGlass);
  glass.position.y = 2.15;
  glass.renderOrder = 3;
  group.add(glass);

  // Part 5: Sweeping LatheGeometry roof canopy & spire
  const roofPts = [
    new THREE.Vector2(2.65, 0),
    new THREE.Vector2(2.35, 0.35),
    new THREE.Vector2(1.45, 0.65),
    new THREE.Vector2(0.45, 1.05),
    new THREE.Vector2(0.08, 2.25),
    new THREE.Vector2(0.0, 2.55),
  ];
  const roofGeo = new THREE.LatheGeometry(roofPts, 16);
  geos.push(roofGeo);
  const roof = new THREE.Mesh(roofGeo, mats.slateMid);
  roof.position.y = 3.5;
  roof.castShadow = true;
  group.add(roof);

  // Part 6: Dual Rotating Gyroscope Rings
  const ring1Geo = new THREE.TorusGeometry(1.25, 0.055, 12, 48);
  const ring2Geo = new THREE.TorusGeometry(0.95, 0.045, 12, 48);
  geos.push(ring1Geo, ring2Geo);
  const gyroOuter = new THREE.Mesh(ring1Geo, mats.brushedBrass);
  gyroOuter.position.y = 2.25;
  group.add(gyroOuter);

  const gyroInner = new THREE.Mesh(ring2Geo, mats.brushedPlatinum);
  gyroInner.position.y = 2.25;
  group.add(gyroInner);

  // Part 7: Reactive Decision Conviction Core
  const coreGeo = new THREE.OctahedronGeometry(0.55, 1);
  geos.push(coreGeo);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.35,
    roughness: 0.18,
    metalness: 0.4,
  });
  localMats.push(coreMat);
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.y = 2.25;
  group.add(core);

  const hitProxy = createHitProxy(group, 'center', 6.5, 6.0, 6.5, geos);

  return {
    group,
    hitProxy,
    update: (elapsed, dt, state, isSelected) => {
      const volFactor = 0.6 + state.annualVolatilityPct * 0.05;
      gyroOuter.rotation.y += dt * 0.65 * volFactor;
      gyroOuter.rotation.x = Math.sin(elapsed * 0.7) * 0.35;
      gyroInner.rotation.z -= dt * 0.9 * volFactor;
      gyroInner.rotation.y += dt * 0.4;

      const targetCoreY = 1.9 + (state.convictionScore / 100) * 0.75;
      core.position.y = THREE.MathUtils.damp(core.position.y, targetCoreY, 4, dt);
      core.rotation.y += dt * 1.1;

      if (state.covenantBreaches.length >= 2) {
        coreMat.color.setHex(0xef4444);
        coreMat.emissive.setHex(0xef4444);
      } else if (state.convictionScore >= 65) {
        coreMat.color.setHex(0x10b981);
        coreMat.emissive.setHex(0x10b981);
      } else {
        coreMat.color.setHex(0xf59e0b);
        coreMat.emissive.setHex(0xf59e0b);
      }

      const selMat = selRing.material as THREE.MeshBasicMaterial;
      selMat.opacity = THREE.MathUtils.damp(selMat.opacity, isSelected ? 0.95 : 0.22, 8, dt);
    },
    dispose: () => {
      geos.forEach((g) => g.dispose());
      localMats.forEach((m) => m.dispose());
      (selRing.material as THREE.Material).dispose();
      (hitProxy.material as THREE.Material).dispose();
    },
  };
}

// 2. DEPARTMENT 1: Cash Flow Hydraulic Vault
export function createDept1CashFlow(mats: WorldMaterialLibrary): BuildingRig {
  const meta = ZONE_METADATA.department1;
  const group = new THREE.Group();
  group.position.set(...meta.worldPos);
  const geos: THREE.BufferGeometry[] = [];
  const localMats: THREE.Material[] = [];

  addContactShadow(group, mats, 2.9, geos);
  const selRing = createSelectionRing(group, 2.9, meta.accentHex, geos);

  // Stepped foundation
  const baseGeo = new THREE.BoxGeometry(4.4, 0.45, 3.2);
  geos.push(baseGeo);
  const base = new THREE.Mesh(baseGeo, mats.basaltDark);
  base.position.y = 0.225;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Rear vault wall + candlestick screen facade
  const rearGeo = new THREE.BoxGeometry(3.8, 2.3, 1.0);
  geos.push(rearGeo);
  const rear = new THREE.Mesh(rearGeo, mats.slateMid);
  rear.position.set(0, 1.55, -0.75);
  rear.castShadow = true;
  group.add(rear);

  const screenGeo = new THREE.PlaneGeometry(3.1, 1.45);
  geos.push(screenGeo);
  const screen = new THREE.Mesh(screenGeo, mats.chartScreen);
  screen.position.set(0, 1.65, -0.23);
  group.add(screen);

  // 3 Hydraulic Cash Flow Barometer Cylinders (OCF, CapEx, FCF)
  const glassCylGeo = new THREE.CylinderGeometry(0.42, 0.42, 2.6, 20, 1, true);
  const capRingGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.14, 20);
  const liquidGeo = new THREE.CylinderGeometry(0.34, 0.34, 1.0, 20);
  liquidGeo.translate(0, 0.5, 0); // bottom-anchored for clean scale.y!
  geos.push(glassCylGeo, capRingGeo, liquidGeo);

  const liquidColors = [0x10b981, 0xf59e0b, 0x38bdf8];
  const liquidMeshes: THREE.Mesh[] = [];
  [-1.25, 0, 1.25].forEach((x, idx) => {
    const shell = new THREE.Mesh(glassCylGeo, mats.opticalGlass);
    shell.position.set(x, 1.75, 0.65);
    shell.renderOrder = 3;
    group.add(shell);

    const botCap = new THREE.Mesh(capRingGeo, mats.brushedBrass);
    botCap.position.set(x, 0.48, 0.65);
    group.add(botCap);

    const topCap = new THREE.Mesh(capRingGeo, mats.brushedBrass);
    topCap.position.set(x, 3.05, 0.65);
    group.add(topCap);

    const liqMat = new THREE.MeshStandardMaterial({
      color: liquidColors[idx],
      emissive: liquidColors[idx],
      emissiveIntensity: 0.75,
      roughness: 0.2,
      metalness: 0.1,
    });
    localMats.push(liqMat);
    const liq = new THREE.Mesh(liquidGeo, liqMat);
    liq.position.set(x, 0.52, 0.65);
    group.add(liq);
    liquidMeshes.push(liq);
  });

  // Rooftop manifold pipe (TubeGeometry) + spinning flow turbine
  const pipeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.25, 3.12, 0.65),
    new THREE.Vector3(-1.25, 3.6, 0.2),
    new THREE.Vector3(0, 3.7, -0.35),
    new THREE.Vector3(1.25, 3.6, 0.2),
    new THREE.Vector3(1.25, 3.12, 0.65),
  ]);
  const pipeGeo = new THREE.TubeGeometry(pipeCurve, 28, 0.1, 8, false);
  geos.push(pipeGeo);
  const pipe = new THREE.Mesh(pipeGeo, mats.brushedPlatinum);
  group.add(pipe);

  const turbineGroup = new THREE.Group();
  turbineGroup.position.set(0, 3.9, -0.35);
  const hubGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.25, 16);
  const bladeGeo = new THREE.BoxGeometry(1.1, 0.05, 0.22);
  geos.push(hubGeo, bladeGeo);
  turbineGroup.add(new THREE.Mesh(hubGeo, mats.brushedBrass));
  const b1 = new THREE.Mesh(bladeGeo, mats.brushedPlatinum);
  const b2 = new THREE.Mesh(bladeGeo, mats.brushedPlatinum);
  b2.rotation.y = Math.PI / 2;
  turbineGroup.add(b1, b2);
  group.add(turbineGroup);

  const hitProxy = createHitProxy(group, 'department1', 4.6, 4.4, 3.6, geos);

  return {
    group,
    hitProxy,
    update: (_elapsed, dt, state, isSelected) => {
      const ocfScale = THREE.MathUtils.clamp(state.operatingCashFlow / 140, 0.25, 2.35);
      const capexScale = THREE.MathUtils.clamp(state.capex / 100, 0.2, 2.3);
      const fcfScale = THREE.MathUtils.clamp((state.freeCashFlow + 60) / 110, 0.15, 2.35);
      const targets = [ocfScale, capexScale, fcfScale];

      liquidMeshes.forEach((m, i) => {
        m.scale.y = THREE.MathUtils.damp(m.scale.y, targets[i], 5, dt);
      });
      const fcfMat = liquidMeshes[2].material as THREE.MeshStandardMaterial;
      if (state.freeCashFlow < 0) {
        fcfMat.color.setHex(0xef4444);
        fcfMat.emissive.setHex(0xef4444);
      } else {
        fcfMat.color.setHex(0x10b981);
        fcfMat.emissive.setHex(0x10b981);
      }

      turbineGroup.rotation.y += dt * (1.2 + Math.max(0, state.freeCashFlow) * 0.025);
      const selMat = selRing.material as THREE.MeshBasicMaterial;
      selMat.opacity = THREE.MathUtils.damp(selMat.opacity, isSelected ? 0.95 : 0.22, 8, dt);
    },
    dispose: () => {
      geos.forEach((g) => g.dispose());
      localMats.forEach((m) => m.dispose());
      (selRing.material as THREE.Material).dispose();
      (hitProxy.material as THREE.Material).dispose();
    },
  };
}

// 3. DEPARTMENT 2: War & Geopolitical Volatility Observatory
export function createDept2WarVolatility(mats: WorldMaterialLibrary): BuildingRig {
  const meta = ZONE_METADATA.department2;
  const group = new THREE.Group();
  group.position.set(...meta.worldPos);
  const geos: THREE.BufferGeometry[] = [];
  const localMats: THREE.Material[] = [];

  addContactShadow(group, mats, 2.9, geos);
  const selRing = createSelectionRing(group, 2.9, meta.accentHex, geos);

  // Hexagonal bunker plinth
  const baseGeo = new THREE.CylinderGeometry(2.35, 2.65, 0.6, 6);
  geos.push(baseGeo);
  const base = new THREE.Mesh(baseGeo, mats.basaltDark);
  base.position.y = 0.3;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Armored angled turret body
  const bodyGeo = new THREE.CylinderGeometry(1.45, 1.85, 1.85, 6);
  geos.push(bodyGeo);
  const body = new THREE.Mesh(bodyGeo, mats.slateMid);
  body.position.y = 1.5;
  body.castShadow = true;
  group.add(body);

  // 4 Tactical armor fins
  const finGeo = new THREE.BoxGeometry(0.18, 1.5, 0.75);
  geos.push(finGeo);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const fin = new THREE.Mesh(finGeo, mats.basaltDark);
    fin.position.set(Math.cos(a) * 1.75, 1.35, Math.sin(a) * 1.75);
    fin.rotation.y = -a + Math.PI / 2;
    fin.castShadow = true;
    group.add(fin);
  }

  // Rotating Radar Assembly (LatheGeometry parabolic dish)
  const radarMount = new THREE.Group();
  radarMount.position.y = 2.65;
  const mastGeo = new THREE.CylinderGeometry(0.2, 0.28, 0.65, 12);
  const dishPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.5, 0.08),
    new THREE.Vector2(0.95, 0.32),
    new THREE.Vector2(1.15, 0.58),
  ];
  const dishGeo = new THREE.LatheGeometry(dishPts, 24);
  dishGeo.rotateX(Math.PI / 3);
  const feedGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.85, 8);
  feedGeo.rotateX(Math.PI / 3);
  geos.push(mastGeo, dishGeo, feedGeo);

  radarMount.add(new THREE.Mesh(mastGeo, mats.brushedPlatinum));
  const dish = new THREE.Mesh(dishGeo, mats.limestone);
  dish.position.y = 0.55;
  dish.castShadow = true;
  radarMount.add(dish);
  const feed = new THREE.Mesh(feedGeo, mats.brushedBrass);
  feed.position.set(0, 0.75, 0.35);
  radarMount.add(feed);
  group.add(radarMount);

  // Reactive Geopolitical Shockwave Ring
  const waveGeo = new THREE.TorusGeometry(2.15, 0.06, 10, 48);
  waveGeo.rotateX(Math.PI / 2);
  geos.push(waveGeo);
  const waveMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 1.2,
    transparent: true,
    opacity: 0.75,
  });
  localMats.push(waveMat);
  const waveRing = new THREE.Mesh(waveGeo, waveMat);
  waveRing.position.y = 0.75;
  group.add(waveRing);

  const hitProxy = createHitProxy(group, 'department2', 4.6, 4.4, 4.6, geos);

  return {
    group,
    hitProxy,
    update: (elapsed, dt, state, isSelected) => {
      const scanSpeed = 0.45 + (state.geopoliticalRiskIndex / 100) * 1.9;
      radarMount.rotation.y += dt * scanSpeed;

      const wavePhase = (elapsed * (0.4 + state.geopoliticalRiskIndex / 90)) % 1;
      const maxScale = 0.9 + (state.geopoliticalRiskIndex / 100) * 0.65;
      const curScale = 0.72 + wavePhase * (maxScale - 0.72);
      waveRing.scale.set(curScale, 1, curScale);
      waveMat.opacity = (1 - wavePhase) * (0.25 + (state.geopoliticalRiskIndex / 100) * 0.7);

      const selMat = selRing.material as THREE.MeshBasicMaterial;
      selMat.opacity = THREE.MathUtils.damp(selMat.opacity, isSelected ? 0.95 : 0.22, 8, dt);
    },
    dispose: () => {
      geos.forEach((g) => g.dispose());
      localMats.forEach((m) => m.dispose());
      (selRing.material as THREE.Material).dispose();
      (hitProxy.material as THREE.Material).dispose();
    },
  };
}

// 4. DEPARTMENT 3: Historical Volatility Archive
export function createDept3HistoricalArchive(mats: WorldMaterialLibrary): BuildingRig {
  const meta = ZONE_METADATA.department3;
  const group = new THREE.Group();
  group.position.set(...meta.worldPos);
  const geos: THREE.BufferGeometry[] = [];
  const localMats: THREE.Material[] = [];

  addContactShadow(group, mats, 2.9, geos);
  const selRing = createSelectionRing(group, 2.9, meta.accentHex, geos);

  // Classical stepped stylobate
  const step1Geo = new THREE.BoxGeometry(4.4, 0.28, 3.4);
  const step2Geo = new THREE.BoxGeometry(3.9, 0.26, 2.9);
  geos.push(step1Geo, step2Geo);
  const s1 = new THREE.Mesh(step1Geo, mats.basaltDark);
  s1.position.y = 0.14;
  s1.receiveShadow = true;
  const s2 = new THREE.Mesh(step2Geo, mats.limestone);
  s2.position.y = 0.41;
  s2.castShadow = true;
  group.add(s1, s2);

  // 4 flanking columns + pedimented roof canopy
  const colGeo = new THREE.CylinderGeometry(0.14, 0.17, 2.15, 14);
  geos.push(colGeo);
  [
    [-1.6, -1.1],
    [1.6, -1.1],
    [-1.6, 1.1],
    [1.6, 1.1],
  ].forEach(([cx, cz]) => {
    const col = new THREE.Mesh(colGeo, mats.limestone);
    col.position.set(cx, 1.6, cz);
    col.castShadow = true;
    group.add(col);
  });

  // Beveled pediment roof
  const pedShape = new THREE.Shape();
  pedShape.moveTo(-2.0, 0);
  pedShape.lineTo(2.0, 0);
  pedShape.lineTo(0, 0.72);
  pedShape.closePath();
  const pedGeo = new THREE.ExtrudeGeometry(pedShape, {
    depth: 2.6,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.06,
    bevelSegments: 2,
  });
  pedGeo.translate(0, 0, -1.3);
  geos.push(pedGeo);
  const pediment = new THREE.Mesh(pedGeo, mats.slateMid);
  pediment.position.y = 2.7;
  pediment.castShadow = true;
  group.add(pediment);

  // 5 Historical Cycle Monolith Bars inside the colonnade
  const barGeo = new THREE.BoxGeometry(0.42, 1.0, 0.9);
  barGeo.translate(0, 0.5, 0);
  geos.push(barGeo);
  const bars: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const bMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.65,
      roughness: 0.3,
      metalness: 0.5,
    });
    localMats.push(bMat);
    const bar = new THREE.Mesh(barGeo, bMat);
    bar.position.set(-1.1 + i * 0.55, 0.55, 0);
    bar.scale.y = 0.8 + (i % 3) * 0.45;
    group.add(bar);
    bars.push(bar);
  }

  const hitProxy = createHitProxy(group, 'department3', 4.6, 4.0, 3.6, geos);

  return {
    group,
    hitProxy,
    update: (_elapsed, dt, state, isSelected) => {
      const dd = Math.abs(state.currentDrawdownPct);
      bars.forEach((bar, idx) => {
        const baseH = 0.7 + ((idx * 3 + Math.round(state.historicalMatchSimilarity / 12)) % 5) * 0.28;
        const target = THREE.MathUtils.clamp(baseH + dd * 0.03, 0.4, 2.0);
        bar.scale.y = THREE.MathUtils.damp(bar.scale.y, target, 4, dt);
      });
      const selMat = selRing.material as THREE.MeshBasicMaterial;
      selMat.opacity = THREE.MathUtils.damp(selMat.opacity, isSelected ? 0.95 : 0.22, 8, dt);
    },
    dispose: () => {
      geos.forEach((g) => g.dispose());
      localMats.forEach((m) => m.dispose());
      (selRing.material as THREE.Material).dispose();
      (hitProxy.material as THREE.Material).dispose();
    },
  };
}

// 5. DEPARTMENT 4: Macro Regulation & 3D Economic Graph Sculpture
export function createDept4RegulationGraph(mats: WorldMaterialLibrary): BuildingRig {
  const meta = ZONE_METADATA.department4;
  const group = new THREE.Group();
  group.position.set(...meta.worldPos);
  const geos: THREE.BufferGeometry[] = [];
  const localMats: THREE.Material[] = [];

  addContactShadow(group, mats, 2.9, geos);
  const selRing = createSelectionRing(group, 2.9, meta.accentHex, geos);

  // Modernist stepped podium
  const baseGeo = new THREE.CylinderGeometry(2.3, 2.5, 0.45, 8);
  const deckGeo = new THREE.BoxGeometry(3.8, 0.28, 3.2);
  geos.push(baseGeo, deckGeo);
  const base = new THREE.Mesh(baseGeo, mats.basaltDark);
  base.position.y = 0.225;
  base.receiveShadow = true;
  const deck = new THREE.Mesh(deckGeo, mats.limestone);
  deck.position.y = 1.65;
  deck.castShadow = true;
  group.add(base, deck);

  // Cantilevered support fins
  const finGeo = new THREE.BoxGeometry(0.28, 1.25, 2.2);
  geos.push(finGeo);
  [-1.2, 1.2].forEach((x) => {
    const fin = new THREE.Mesh(finGeo, mats.slateMid);
    fin.position.set(x, 1.0, 0);
    fin.castShadow = true;
    group.add(fin);
  });

  // 3D Economic Causal Node-Link Graph perched atop the deck
  const graphGroup = new THREE.Group();
  graphGroup.position.y = 1.85;
  group.add(graphGroup);

  const nodeGeo = new THREE.IcosahedronGeometry(0.24, 1);
  geos.push(nodeGeo);
  const nodePositions: [number, number][] = [
    [-1.1, -0.7],
    [0.0, -0.9],
    [1.1, -0.7],
    [-0.9, 0.7],
    [0.0, 0.85],
    [0.9, 0.7],
  ];
  const nodeColors = [0x818cf8, 0x38bdf8, 0xf43f5e, 0x10b981, 0xf59e0b, 0x2dd4bf];
  const nodeMeshes: THREE.Mesh[] = [];
  const stemMeshes: THREE.Mesh[] = [];
  const stemGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 8);
  stemGeo.translate(0, 0.5, 0);
  geos.push(stemGeo);

  nodePositions.forEach(([nx, nz], idx) => {
    const nMat = new THREE.MeshStandardMaterial({
      color: nodeColors[idx],
      emissive: nodeColors[idx],
      emissiveIntensity: 0.9,
      roughness: 0.25,
      metalness: 0.3,
    });
    localMats.push(nMat);
    const node = new THREE.Mesh(nodeGeo, nMat);
    node.position.set(nx, 1.0, nz);
    graphGroup.add(node);
    nodeMeshes.push(node);

    const stem = new THREE.Mesh(stemGeo, mats.brushedPlatinum);
    stem.position.set(nx, 0, nz);
    graphGroup.add(stem);
    stemMeshes.push(stem);
  });

  // Connecting lattice ring
  const latticeCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-1.1, 1.0, -0.7),
      new THREE.Vector3(0, 1.2, -0.9),
      new THREE.Vector3(1.1, 1.0, -0.7),
      new THREE.Vector3(0.9, 1.1, 0.7),
      new THREE.Vector3(0, 1.25, 0.85),
      new THREE.Vector3(-0.9, 1.1, 0.7),
    ],
    true,
  );
  const latticeGeo = new THREE.TubeGeometry(latticeCurve, 40, 0.04, 8, true);
  geos.push(latticeGeo);
  const lattice = new THREE.Mesh(latticeGeo, mats.brushedBrass);
  graphGroup.add(lattice);

  const hitProxy = createHitProxy(group, 'department4', 4.6, 4.2, 4.0, geos);

  return {
    group,
    hitProxy,
    update: (elapsed, dt, state, isSelected) => {
      state.economicNodes.forEach((n, idx) => {
        if (!nodeMeshes[idx]) return;
        const targetY = 0.55 + (n.value / 100) * 1.45 + Math.sin(elapsed * 1.8 + idx) * 0.08;
        nodeMeshes[idx].position.y = THREE.MathUtils.damp(nodeMeshes[idx].position.y, targetY, 5, dt);
        stemMeshes[idx].scale.y = nodeMeshes[idx].position.y;
      });
      const selMat = selRing.material as THREE.MeshBasicMaterial;
      selMat.opacity = THREE.MathUtils.damp(selMat.opacity, isSelected ? 0.95 : 0.22, 8, dt);
    },
    dispose: () => {
      geos.forEach((g) => g.dispose());
      localMats.forEach((m) => m.dispose());
      (selRing.material as THREE.Material).dispose();
      (hitProxy.material as THREE.Material).dispose();
    },
  };
}

// 6. DEPARTMENT 5: Portfolio Risk & Forecast Dome
export function createDept5RiskForecast(mats: WorldMaterialLibrary): BuildingRig {
  const meta = ZONE_METADATA.department5;
  const group = new THREE.Group();
  group.position.set(...meta.worldPos);
  const geos: THREE.BufferGeometry[] = [];
  const localMats: THREE.Material[] = [];

  addContactShadow(group, mats, 2.9, geos);
  const selRing = createSelectionRing(group, 2.9, meta.accentHex, geos);

  // Circular terraced podium
  const baseGeo = new THREE.CylinderGeometry(2.35, 2.6, 0.5, 24);
  const collarGeo = new THREE.CylinderGeometry(1.75, 1.95, 0.95, 24);
  geos.push(baseGeo, collarGeo);
  const base = new THREE.Mesh(baseGeo, mats.basaltDark);
  base.position.y = 0.25;
  base.receiveShadow = true;
  const collar = new THREE.Mesh(collarGeo, mats.limestone);
  collar.position.y = 0.95;
  collar.castShadow = true;
  group.add(base, collar);

  // Glass geodesic hemisphere dome + metallic meridian ribs
  const domeGeo = new THREE.SphereGeometry(1.65, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52);
  geos.push(domeGeo);
  const dome = new THREE.Mesh(domeGeo, mats.opticalGlass);
  dome.position.y = 1.4;
  dome.renderOrder = 3;
  group.add(dome);

  const ribGeo = new THREE.TorusGeometry(1.68, 0.04, 8, 36, Math.PI);
  geos.push(ribGeo);
  for (let i = 0; i < 4; i++) {
    const rib = new THREE.Mesh(ribGeo, mats.brushedPlatinum);
    rib.position.y = 1.4;
    rib.rotation.y = (i / 4) * Math.PI;
    group.add(rib);
  }

  // Inner Forecast Equilibrium Sphere
  const innerGeo = new THREE.SphereGeometry(0.55, 20, 20);
  geos.push(innerGeo);
  const innerMat = new THREE.MeshStandardMaterial({
    color: 0x2dd4bf,
    emissive: 0x0d9488,
    emissiveIntensity: 1.0,
    roughness: 0.2,
    metalness: 0.3,
  });
  localMats.push(innerMat);
  const innerSphere = new THREE.Mesh(innerGeo, innerMat);
  innerSphere.position.y = 1.95;
  group.add(innerSphere);

  // Dual Orbiting Risk Satellite Rings
  const satRing1Geo = new THREE.TorusGeometry(2.15, 0.045, 10, 48);
  const satRing2Geo = new THREE.TorusGeometry(2.4, 0.035, 10, 48);
  geos.push(satRing1Geo, satRing2Geo);
  const satRing1 = new THREE.Mesh(satRing1Geo, mats.brushedBrass);
  satRing1.position.y = 2.0;
  const satRing2 = new THREE.Mesh(satRing2Geo, mats.brushedPlatinum);
  satRing2.position.y = 2.0;
  group.add(satRing1, satRing2);

  const hitProxy = createHitProxy(group, 'department5', 4.6, 4.0, 4.6, geos);

  return {
    group,
    hitProxy,
    update: (elapsed, dt, state, isSelected) => {
      const riskTilt = THREE.MathUtils.clamp(state.var95Pct / 20, 0.15, 0.85);
      satRing1.rotation.x = THREE.MathUtils.damp(satRing1.rotation.x, riskTilt, 4, dt);
      satRing1.rotation.y += dt * 0.85;
      satRing2.rotation.z = -riskTilt * 0.8;
      satRing2.rotation.y -= dt * 0.55;

      innerSphere.position.y = 1.9 + Math.sin(elapsed * 1.5) * 0.09;
      if (state.covenantBreaches.length > 0) {
        innerMat.color.setHex(0xf59e0b);
        innerMat.emissive.setHex(0xd97706);
      } else {
        innerMat.color.setHex(0x2dd4bf);
        innerMat.emissive.setHex(0x0d9488);
      }
      const selMat = selRing.material as THREE.MeshBasicMaterial;
      selMat.opacity = THREE.MathUtils.damp(selMat.opacity, isSelected ? 0.95 : 0.22, 8, dt);
    },
    dispose: () => {
      geos.forEach((g) => g.dispose());
      localMats.forEach((m) => m.dispose());
      (selRing.material as THREE.Material).dispose();
      (hitProxy.material as THREE.Material).dispose();
    },
  };
}

// 7. LAW-ER-1: Corporate Legal & Document Risk Wing
export function createLawer1LegalDocs(mats: WorldMaterialLibrary): BuildingRig {
  const meta = ZONE_METADATA.lawer1;
  const group = new THREE.Group();
  group.position.set(...meta.worldPos);
  const geos: THREE.BufferGeometry[] = [];

  addContactShadow(group, mats, 2.7, geos);
  const selRing = createSelectionRing(group, 2.7, meta.accentHex, geos);

  // Courthouse plinth
  const baseGeo = new THREE.BoxGeometry(3.8, 0.42, 3.0);
  geos.push(baseGeo);
  const base = new THREE.Mesh(baseGeo, mats.basaltDark);
  base.position.y = 0.21;
  base.receiveShadow = true;
  group.add(base);

  // Stacked Corporate Document Ledger Slabs
  const slabGeo = new THREE.BoxGeometry(2.6, 0.28, 1.9);
  geos.push(slabGeo);
  for (let i = 0; i < 4; i++) {
    const slab = new THREE.Mesh(slabGeo, i % 2 === 0 ? mats.limestone : mats.slateMid);
    slab.position.set(0, 0.58 + i * 0.34, -0.15);
    slab.rotation.y = (i - 1.5) * 0.06;
    slab.castShadow = true;
    group.add(slab);
  }

  // Twin Judicial Columns
  const colGeo = new THREE.CylinderGeometry(0.14, 0.16, 2.4, 14);
  geos.push(colGeo);
  [-1.45, 1.45].forEach((x) => {
    const col = new THREE.Mesh(colGeo, mats.limestone);
    col.position.set(x, 1.6, 0.95);
    col.castShadow = true;
    group.add(col);
  });

  // Dynamic Brass Scales of Justice mounted on central spire
  const pillarGeo = new THREE.CylinderGeometry(0.09, 0.12, 1.65, 12);
  const beamGeo = new THREE.BoxGeometry(2.4, 0.08, 0.08);
  const panGeo = new THREE.CylinderGeometry(0.38, 0.22, 0.14, 16);
  geos.push(pillarGeo, beamGeo, panGeo);

  const spire = new THREE.Mesh(pillarGeo, mats.brushedBrass);
  spire.position.set(0, 2.55, 0);
  group.add(spire);

  const scaleBeamGroup = new THREE.Group();
  scaleBeamGroup.position.set(0, 3.35, 0);
  scaleBeamGroup.add(new THREE.Mesh(beamGeo, mats.brushedBrass));

  const leftPanGroup = new THREE.Group();
  leftPanGroup.position.set(-1.1, -0.55, 0);
  leftPanGroup.add(new THREE.Mesh(panGeo, mats.brushedPlatinum));
  const rightPanGroup = new THREE.Group();
  rightPanGroup.position.set(1.1, -0.55, 0);
  rightPanGroup.add(new THREE.Mesh(panGeo, mats.brushedBrass));
  scaleBeamGroup.add(leftPanGroup, rightPanGroup);
  group.add(scaleBeamGroup);

  const hitProxy = createHitProxy(group, 'lawer1', 4.2, 4.2, 3.6, geos);

  return {
    group,
    hitProxy,
    update: (_elapsed, dt, state, isSelected) => {
      // Tilt beam proportionally to legalRiskScore (50 = balanced, >50 tilts sharply)
      const tiltTarget = ((state.legalRiskScore - 35) / 100) * 0.55;
      scaleBeamGroup.rotation.z = THREE.MathUtils.damp(
        scaleBeamGroup.rotation.z,
        -tiltTarget,
        4,
        dt,
      );
      leftPanGroup.rotation.z = -scaleBeamGroup.rotation.z;
      rightPanGroup.rotation.z = -scaleBeamGroup.rotation.z;

      const selMat = selRing.material as THREE.MeshBasicMaterial;
      selMat.opacity = THREE.MathUtils.damp(selMat.opacity, isSelected ? 0.95 : 0.22, 8, dt);
    },
    dispose: () => {
      geos.forEach((g) => g.dispose());
      (selRing.material as THREE.Material).dispose();
      (hitProxy.material as THREE.Material).dispose();
    },
  };
}

// 8. LAWER-2: Investment Risk & Covenant Shield Wing
export function createLawer2InvestmentRisk(mats: WorldMaterialLibrary): BuildingRig {
  const meta = ZONE_METADATA.lawer2;
  const group = new THREE.Group();
  group.position.set(...meta.worldPos);
  const geos: THREE.BufferGeometry[] = [];
  const localMats: THREE.Material[] = [];

  addContactShadow(group, mats, 2.7, geos);
  const selRing = createSelectionRing(group, 2.7, meta.accentHex, geos);

  // Armored Octagonal Base + Vault Structure
  const baseGeo = new THREE.CylinderGeometry(2.15, 2.35, 0.45, 8);
  const bodyGeo = new THREE.BoxGeometry(2.8, 2.0, 2.2);
  geos.push(baseGeo, bodyGeo);
  const base = new THREE.Mesh(baseGeo, mats.basaltDark);
  base.position.y = 0.225;
  base.receiveShadow = true;
  const body = new THREE.Mesh(bodyGeo, mats.slateMid);
  body.position.y = 1.45;
  body.castShadow = true;
  group.add(base, body);

  // Armored Vault Door Ring on front face
  const doorRingGeo = new THREE.TorusGeometry(0.68, 0.1, 12, 28);
  const doorCoreGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.16, 20);
  doorCoreGeo.rotateX(Math.PI / 2);
  geos.push(doorRingGeo, doorCoreGeo);
  const doorRing = new THREE.Mesh(doorRingGeo, mats.brushedBrass);
  doorRing.position.set(0, 1.45, 1.12);
  const doorCore = new THREE.Mesh(doorCoreGeo, mats.brushedPlatinum);
  doorCore.position.set(0, 1.45, 1.08);
  group.add(doorRing, doorCore);

  // Rooftop Risk Gauge Arc + Rotating Needle
  const arcGeo = new THREE.TorusGeometry(1.05, 0.08, 10, 32, Math.PI);
  const needleGeo = new THREE.ConeGeometry(0.09, 1.05, 8);
  needleGeo.translate(0, 0.52, 0);
  geos.push(arcGeo, needleGeo);

  const arc = new THREE.Mesh(arcGeo, mats.brushedPlatinum);
  arc.position.set(0, 2.55, 0);
  group.add(arc);

  const needleMat = new THREE.MeshStandardMaterial({
    color: 0xfb923c,
    emissive: 0xea580c,
    emissiveIntensity: 0.9,
    roughness: 0.25,
    metalness: 0.6,
  });
  localMats.push(needleMat);
  const needle = new THREE.Mesh(needleGeo, needleMat);
  needle.position.set(0, 2.55, 0.05);
  group.add(needle);

  const hitProxy = createHitProxy(group, 'lawer2', 4.2, 4.2, 3.6, geos);

  return {
    group,
    hitProxy,
    update: (_elapsed, dt, state, isSelected) => {
      // Needle sweeps from +PI/2 (safe left) to -PI/2 (high risk right)
      const angle = THREE.MathUtils.lerp(
        Math.PI * 0.42,
        -Math.PI * 0.42,
        state.investmentRiskScore / 100,
      );
      needle.rotation.z = THREE.MathUtils.damp(needle.rotation.z, angle, 5, dt);

      if (state.covenantBreaches.length > 0) {
        needleMat.color.setHex(0xef4444);
        needleMat.emissive.setHex(0xdc2626);
      } else {
        needleMat.color.setHex(0x10b981);
        needleMat.emissive.setHex(0x059669);
      }
      const selMat = selRing.material as THREE.MeshBasicMaterial;
      selMat.opacity = THREE.MathUtils.damp(selMat.opacity, isSelected ? 0.95 : 0.22, 8, dt);
    },
    dispose: () => {
      geos.forEach((g) => g.dispose());
      localMats.forEach((m) => m.dispose());
      (selRing.material as THREE.Material).dispose();
      (hitProxy.material as THREE.Material).dispose();
    },
  };
}
