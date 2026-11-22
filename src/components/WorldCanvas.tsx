import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  createCenterCitadel,
  createDept1CashFlow,
  createDept2WarVolatility,
  createDept3HistoricalArchive,
  createDept4RegulationGraph,
  createDept5RiskForecast,
  createLawer1LegalDocs,
  createLawer2InvestmentRisk,
  BuildingRig,
} from '../scene/buildings';
import { createWorldMaterials } from '../scene/materials';
import { createProceduralTextures } from '../scene/textures';
import { createWorldEnvironment } from '../scene/worldEnvironment';
import { createSwarmDrones } from '../scene/swarmDrones';
import { ZONE_METADATA } from '../simulation/financialEngine';
import { SimulationState, SwarmRunResult, SwarmStatus, ZoneId } from '../types/finance';

const _projVec = new THREE.Vector3();
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();

const BUILDING_IDS: Exclude<ZoneId, 'overview'>[] = [
  'center',
  'department1',
  'department2',
  'department3',
  'department4',
  'department5',
  'lawer1',
  'lawer2',
];

interface WorldCanvasProps {
  simState: SimulationState;
  selectedZone: ZoneId;
  showLabels: boolean;
  onSelectZone: (zone: ZoneId) => void;
  cameraResetTrigger: number;
  swarmStatus: SwarmStatus;
  lastSwarmRun: SwarmRunResult | null;
}

export const WorldCanvas: React.FC<WorldCanvasProps> = ({
  simState,
  selectedZone,
  showLabels,
  onSelectZone,
  cameraResetTrigger,
  swarmStatus,
  lastSwarmRun,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const labelRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [contextLost, setContextLost] = useState(false);

  const stateRef = useRef<SimulationState>(simState);
  stateRef.current = simState;

  const selectedZoneRef = useRef<ZoneId>(selectedZone);
  selectedZoneRef.current = selectedZone;

  const onSelectZoneRef = useRef(onSelectZone);
  onSelectZoneRef.current = onSelectZone;

  const showLabelsRef = useRef(showLabels);
  showLabelsRef.current = showLabels;

  const swarmStatusRef = useRef<SwarmStatus>(swarmStatus);
  swarmStatusRef.current = swarmStatus;

  const lastSwarmRunRef = useRef<SwarmRunResult | null>(lastSwarmRun);
  lastSwarmRunRef.current = lastSwarmRun;

  // Camera transition target ref
  const cameraTransitionRef = useRef<{
    active: boolean;
    camPos: THREE.Vector3;
    lookAt: THREE.Vector3;
  }>({
    active: false,
    camPos: new THREE.Vector3(22, 17, 24),
    lookAt: new THREE.Vector3(0, 1.2, 0),
  });

  // Trigger smooth camera fly-to whenever selectedZone or cameraResetTrigger changes
  useEffect(() => {
    const meta = ZONE_METADATA[selectedZone];
    const [wx, wy, wz] = meta.worldPos;
    const [ox, oy, oz] = meta.cameraOffset;
    cameraTransitionRef.current.camPos.set(wx + ox, wy + oy, wz + oz);
    cameraTransitionRef.current.lookAt.set(
      wx,
      selectedZone === 'overview' ? 1.2 : 1.7,
      wz,
    );
    cameraTransitionRef.current.active = true;
  }, [selectedZone, cameraResetTrigger]);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const scene = new THREE.Scene();
    const bgHex = 0x0b111a;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.0135);

    // Mandatory studio environment map via RoomEnvironment + PMREMGenerator
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.2, 220);
    camera.position.set(22, 17, 24);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 6;
    controls.maxDistance = 52;
    controls.maxPolarAngle = Math.PI * 0.45;
    controls.minPolarAngle = 0.18;
    controls.target.set(0, 1.2, 0);
    controls.update();

    // Cancel scripted camera fly-to when user manually interacts
    const cancelTransition = () => {
      cameraTransitionRef.current.active = false;
    };
    controls.addEventListener('start', cancelTransition);

    // Balanced 3-point studio lighting rig
    const hemiLight = new THREE.HemisphereLight(0x8bb8e8, 0x162032, 0.78);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.2);
    keyLight.position.set(18, 28, 16);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 75;
    const d = 22;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 0.75);
    rimLight.position.set(-20, 14, -18);
    scene.add(rimLight);

    // Procedural Textures, Materials, Environment & 8 Composite Buildings
    const textures = createProceduralTextures(renderer.capabilities.getMaxAnisotropy());
    const mats = createWorldMaterials(textures, isSoftwareGl);
    const worldEnv = createWorldEnvironment(mats);
    scene.add(worldEnv.group);

    const swarmDrones = createSwarmDrones(mats);
    scene.add(swarmDrones.group);

    const buildings: Record<Exclude<ZoneId, 'overview'>, BuildingRig> = {
      center: createCenterCitadel(mats),
      department1: createDept1CashFlow(mats),
      department2: createDept2WarVolatility(mats),
      department3: createDept3HistoricalArchive(mats),
      department4: createDept4RegulationGraph(mats),
      department5: createDept5RiskForecast(mats),
      lawer1: createLawer1LegalDocs(mats),
      lawer2: createLawer2InvestmentRisk(mats),
    };

    const hitProxies: THREE.Mesh[] = [];
    BUILDING_IDS.forEach((id) => {
      scene.add(buildings[id].group);
      hitProxies.push(buildings[id].hitProxy);
    });

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycasting on dedicated layer 1
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let downX = 0;
    let downY = 0;
    let lastHoverCheck = 0;

    const updatePointer = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };

    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (dist > 6) return; // Dragged camera, not a building click
      updatePointer(e);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hitProxies, false);
      if (hits.length > 0) {
        const zoneId = hits[0].object.userData.zoneId as ZoneId | undefined;
        if (zoneId) onSelectZoneRef.current(zoneId);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 50) return;
      lastHoverCheck = now;
      updatePointer(e);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hitProxies, false);
      renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Animation loop with software WebGL afterDraw pacing
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function updateProjectedLabels(w: number, h: number) {
      if (!showLabelsRef.current) return;
      for (let i = 0; i < BUILDING_IDS.length; i++) {
        const id = BUILDING_IDS[i];
        const el = labelRefs.current[id];
        if (!el) continue;
        const meta = ZONE_METADATA[id];
        _projVec.set(meta.worldPos[0], meta.labelHeight, meta.worldPos[2]);
        _projVec.project(camera);
        if (_projVec.z > 1 || _projVec.z < -1) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          continue;
        }
        const sx = ((_projVec.x + 1) * 0.5) * w;
        const sy = ((-_projVec.y + 1) * 0.5) * h;
        el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
      }
    }

    function tick() {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.08);
      const elapsed = clock.elapsedTime;
      const sim = stateRef.current;
      const activeZone = selectedZoneRef.current;

      // Smooth exponential camera fly-to
      const trans = cameraTransitionRef.current;
      if (trans.active) {
        _targetCamPos.copy(trans.camPos);
        _targetLookAt.copy(trans.lookAt);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _targetCamPos.x, 4.5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _targetCamPos.y, 4.5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _targetCamPos.z, 4.5, dt);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, _targetLookAt.x, 4.5, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _targetLookAt.y, 4.5, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _targetLookAt.z, 4.5, dt);
        if (
          camera.position.distanceTo(_targetCamPos) < 0.08 &&
          controls.target.distanceTo(_targetLookAt) < 0.05
        ) {
          trans.active = false;
        }
      }

      controls.update();

      worldEnv.update(elapsed, dt, sim);
      swarmDrones.update(elapsed, dt, swarmStatusRef.current, lastSwarmRunRef.current);
      for (let i = 0; i < BUILDING_IDS.length; i++) {
        const id = BUILDING_IDS[i];
        buildings[id].update(elapsed, dt, sim, activeZone === id);
      }

      renderer.render(scene, camera);
      updateProjectedLabels(
        container?.clientWidth || window.innerWidth,
        container?.clientHeight || window.innerHeight,
      );

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      controls.removeEventListener('start', cancelTransition);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      controls.dispose();
      BUILDING_IDS.forEach((id) => buildings[id].dispose());
      swarmDrones.dispose();
      worldEnv.dispose();
      mats.dispose();
      textures.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0B111A]">
      {/* Stable isolated WebGL container */}
      <div ref={canvasMountRef} className="w-full h-full" />

      {/* Projected 3D Building Semantic Markers */}
      {showLabels && !contextLost && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
          {BUILDING_IDS.map((id) => {
            const meta = ZONE_METADATA[id];
            const isSelected = selectedZone === id;
            return (
              <button
                key={id}
                ref={(el) => {
                  labelRefs.current[id] = el;
                }}
                type="button"
                onClick={() => onSelectZone(id)}
                style={{ opacity: 0 }}
                className={`absolute top-0 left-0 px-2.5 py-1 rounded-md border text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-amber-400 ${
                  isSelected
                    ? 'bg-[#111927]/95 border-amber-400/80 text-white shadow-lg'
                    : 'bg-[#0D131D]/88 border-white/15 text-slate-200 hover:border-white/40 hover:bg-[#131C2B]/95'
                }`}
              >
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <span
                    className="inline-block w-2 h-2 rounded-xs shrink-0"
                    style={{ backgroundColor: meta.accentHex }}
                  />
                  <span className="font-mono-tabular text-[10px] tracking-wider text-slate-400">
                    {meta.code}
                  </span>
                  <span className="text-xs font-semibold">{meta.shortTitle}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* WebGL Context Lost Graceful Fallback */}
      {contextLost && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0B111A] text-center p-6">
          <div className="max-w-md rounded-xl border border-white/10 bg-[#121A28] p-6">
            <h2 className="text-lg font-semibold text-white">Đang khôi phục đồ họa 3D</h2>
            <p className="mt-2 text-sm text-slate-300">
              Ngữ cảnh WebGL tạm thời bị gián đoạn. Hệ thống mô phỏng tài chính vẫn đang duy trì trạng thái.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
