import * as THREE from 'three';

export interface ProceduralTextureSet {
  contactShadow: THREE.CanvasTexture;
  plazaGrid: THREE.CanvasTexture;
  stoneAlbedo: THREE.CanvasTexture;
  stoneRoughness: THREE.CanvasTexture;
  chartDisplay: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  // 1. Soft radial contact shadow
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 256;
  const sCtx = shadowCanvas.getContext('2d')!;
  const grad = sCtx.createRadialGradient(128, 128, 12, 128, 128, 124);
  grad.addColorStop(0, 'rgba(3, 6, 12, 0.72)');
  grad.addColorStop(0.55, 'rgba(3, 6, 12, 0.34)');
  grad.addColorStop(1, 'rgba(3, 6, 12, 0.0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 256, 256);
  const contactShadow = new THREE.CanvasTexture(shadowCanvas);
  contactShadow.colorSpace = THREE.SRGBColorSpace;

  // 2. Architectural radial plaza grid + coordinate rings
  const plazaCanvas = document.createElement('canvas');
  plazaCanvas.width = 1024;
  plazaCanvas.height = 1024;
  const pCtx = plazaCanvas.getContext('2d')!;
  pCtx.fillStyle = '#131C2B';
  pCtx.fillRect(0, 0, 1024, 1024);

  // Subtle tile checker micro-contrast
  pCtx.strokeStyle = 'rgba(148, 163, 184, 0.065)';
  pCtx.lineWidth = 1;
  const step = 32;
  for (let i = 0; i <= 1024; i += step) {
    pCtx.beginPath();
    pCtx.moveTo(i, 0);
    pCtx.lineTo(i, 1024);
    pCtx.stroke();
    pCtx.beginPath();
    pCtx.moveTo(0, i);
    pCtx.lineTo(1024, i);
    pCtx.stroke();
  }

  // Concentric brass & slate compass rings
  const cx = 512;
  const cy = 512;
  const ringRadii = [120, 220, 340, 445, 490];
  ringRadii.forEach((r, idx) => {
    pCtx.beginPath();
    pCtx.arc(cx, cy, r, 0, Math.PI * 2);
    pCtx.strokeStyle =
      idx === 1 || idx === 3
        ? 'rgba(245, 158, 11, 0.32)'
        : 'rgba(148, 163, 184, 0.16)';
    pCtx.lineWidth = idx === 3 ? 2.5 : 1.5;
    pCtx.stroke();
  });

  // Radial sector ticks
  for (let a = 0; a < 36; a++) {
    const rad = (a / 36) * Math.PI * 2;
    const inner = a % 3 === 0 ? 120 : 340;
    const outer = 490;
    pCtx.beginPath();
    pCtx.moveTo(cx + Math.cos(rad) * inner, cy + Math.sin(rad) * inner);
    pCtx.lineTo(cx + Math.cos(rad) * outer, cy + Math.sin(rad) * outer);
    pCtx.strokeStyle =
      a % 3 === 0 ? 'rgba(245, 158, 11, 0.14)' : 'rgba(148, 163, 184, 0.07)';
    pCtx.lineWidth = 1;
    pCtx.stroke();
  }

  const plazaGrid = new THREE.CanvasTexture(plazaCanvas);
  plazaGrid.colorSpace = THREE.SRGBColorSpace;
  plazaGrid.anisotropy = maxAnisotropy;

  // 3. Stone albedo + linear roughness micro-grain
  const stoneCanvas = document.createElement('canvas');
  stoneCanvas.width = 256;
  stoneCanvas.height = 256;
  const stCtx = stoneCanvas.getContext('2d')!;
  stCtx.fillStyle = '#CBD5E1';
  stCtx.fillRect(0, 0, 256, 256);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 256;
  roughCanvas.height = 256;
  const rCtx = roughCanvas.getContext('2d')!;
  rCtx.fillStyle = '#999999';
  rCtx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 2400; i++) {
    const x = (i * 73) % 256;
    const y = (i * 137) % 256;
    const sz = (i % 3) + 1;
    const shade = 188 + (i % 40);
    stCtx.fillStyle = `rgb(${shade}, ${shade + 4}, ${shade + 10})`;
    stCtx.fillRect(x, y, sz, sz);

    const rShade = 120 + (i % 75);
    rCtx.fillStyle = `rgb(${rShade}, ${rShade}, ${rShade})`;
    rCtx.fillRect(x, y, sz, sz);
  }
  const stoneAlbedo = new THREE.CanvasTexture(stoneCanvas);
  stoneAlbedo.colorSpace = THREE.SRGBColorSpace;
  stoneAlbedo.wrapS = THREE.RepeatWrapping;
  stoneAlbedo.wrapT = THREE.RepeatWrapping;
  stoneAlbedo.repeat.set(2, 2);
  stoneAlbedo.anisotropy = maxAnisotropy;

  // Data texture stays in linear NoColorSpace
  const stoneRoughness = new THREE.CanvasTexture(roughCanvas);
  stoneRoughness.wrapS = THREE.RepeatWrapping;
  stoneRoughness.wrapT = THREE.RepeatWrapping;
  stoneRoughness.repeat.set(2, 2);
  stoneRoughness.anisotropy = maxAnisotropy;

  // 4. Procedural financial chart facade texture
  const chartCanvas = document.createElement('canvas');
  chartCanvas.width = 512;
  chartCanvas.height = 256;
  const cCtx = chartCanvas.getContext('2d')!;
  cCtx.fillStyle = '#09111E';
  cCtx.fillRect(0, 0, 512, 256);

  cCtx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
  cCtx.lineWidth = 1;
  for (let y = 32; y < 256; y += 32) {
    cCtx.beginPath();
    cCtx.moveTo(0, y);
    cCtx.lineTo(512, y);
    cCtx.stroke();
  }
  // Candlestick silhouettes
  for (let i = 0; i < 24; i++) {
    const x = 18 + i * 20;
    const up = i % 3 !== 0;
    const h = 24 + ((i * 19) % 72);
    const y = 160 - Math.sin(i * 0.45) * 45 - h * 0.5;
    cCtx.strokeStyle = up ? '#10B981' : '#EF4444';
    cCtx.lineWidth = 2;
    cCtx.beginPath();
    cCtx.moveTo(x + 4, y - 12);
    cCtx.lineTo(x + 4, y + h + 12);
    cCtx.stroke();
    cCtx.fillStyle = up ? '#10B981' : '#EF4444';
    cCtx.fillRect(x, y, 8, h);
  }
  const chartDisplay = new THREE.CanvasTexture(chartCanvas);
  chartDisplay.colorSpace = THREE.SRGBColorSpace;
  chartDisplay.anisotropy = maxAnisotropy;

  return {
    contactShadow,
    plazaGrid,
    stoneAlbedo,
    stoneRoughness,
    chartDisplay,
    dispose: () => {
      contactShadow.dispose();
      plazaGrid.dispose();
      stoneAlbedo.dispose();
      stoneRoughness.dispose();
      chartDisplay.dispose();
    },
  };
}
