import * as THREE from 'three';
import { ProceduralTextureSet } from './textures';

export interface WorldMaterialLibrary {
  basaltDark: THREE.MeshStandardMaterial;
  slateMid: THREE.MeshStandardMaterial;
  limestone: THREE.MeshStandardMaterial;
  brushedBrass: THREE.MeshPhysicalMaterial;
  brushedPlatinum: THREE.MeshPhysicalMaterial;
  opticalGlass: THREE.MeshPhysicalMaterial;
  plazaSurface: THREE.MeshStandardMaterial;
  moatWater: THREE.MeshPhysicalMaterial;
  terrainHill: THREE.MeshStandardMaterial;
  chartScreen: THREE.MeshStandardMaterial;
  contactShadow: THREE.MeshBasicMaterial;
  conduitPipe: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function createWorldMaterials(
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean,
): WorldMaterialLibrary {
  const basaltDark = new THREE.MeshStandardMaterial({
    color: 0x162032,
    roughness: 0.72,
    metalness: 0.15,
  });

  const slateMid = new THREE.MeshStandardMaterial({
    color: 0x2a3950,
    roughness: 0.58,
    metalness: 0.25,
  });

  const limestone = new THREE.MeshStandardMaterial({
    color: 0xd8dee9,
    map: textures.stoneAlbedo,
    roughnessMap: textures.stoneRoughness,
    roughness: 0.82,
    metalness: 0.04,
  });

  // High-metalness brushed brass with anisotropic specular highlights
  const brushedBrass = new THREE.MeshPhysicalMaterial({
    color: 0xeab308,
    roughness: 0.22,
    metalness: 0.92,
    anisotropy: 0.8,
    anisotropyRotation: Math.PI / 6,
    clearcoat: 0.25,
  });

  const brushedPlatinum = new THREE.MeshPhysicalMaterial({
    color: 0xcbd5e1,
    roughness: 0.2,
    metalness: 0.9,
    anisotropy: 0.75,
  });

  // Optical glass with software WebGL fallback
  const opticalGlass = new THREE.MeshPhysicalMaterial({
    color: 0xa5f3fc,
    roughness: 0.08,
    metalness: 0.05,
    transmission: isSoftwareGl ? 0 : 0.86,
    transparent: true,
    opacity: isSoftwareGl ? 0.38 : 0.92,
    ior: 1.52,
    thickness: 0.8,
    clearcoat: 1.0,
    depthWrite: false,
  });

  const plazaSurface = new THREE.MeshStandardMaterial({
    map: textures.plazaGrid,
    roughness: 0.68,
    metalness: 0.18,
  });

  const moatWater = new THREE.MeshPhysicalMaterial({
    color: 0x0c2438,
    roughness: 0.12,
    metalness: 0.35,
    clearcoat: 0.9,
    clearcoatRoughness: 0.08,
  });

  const terrainHill = new THREE.MeshStandardMaterial({
    color: 0x131d2c,
    roughness: 0.92,
    metalness: 0.04,
  });

  const chartScreen = new THREE.MeshStandardMaterial({
    map: textures.chartDisplay,
    emissive: 0x1e3a5f,
    emissiveMap: textures.chartDisplay,
    emissiveIntensity: 0.9,
    roughness: 0.3,
    metalness: 0.1,
  });

  const contactShadow = new THREE.MeshBasicMaterial({
    map: textures.contactShadow,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });

  const conduitPipe = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.42,
    metalness: 0.65,
  });

  const all = [
    basaltDark,
    slateMid,
    limestone,
    brushedBrass,
    brushedPlatinum,
    opticalGlass,
    plazaSurface,
    moatWater,
    terrainHill,
    chartScreen,
    contactShadow,
    conduitPipe,
  ];

  return {
    basaltDark,
    slateMid,
    limestone,
    brushedBrass,
    brushedPlatinum,
    opticalGlass,
    plazaSurface,
    moatWater,
    terrainHill,
    chartScreen,
    contactShadow,
    conduitPipe,
    dispose: () => {
      all.forEach((m) => m.dispose());
    },
  };
}
