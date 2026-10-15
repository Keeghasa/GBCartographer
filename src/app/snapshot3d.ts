/**
 * 3D Snapshot (the author, 2026-10-14; the Darkroom mockup, review/camera-2026-10-13): a 3D model on a little stage,
 * turned by dragging its print, lit by a key, fill and rim light, and its picture taken at a Game Boy size in the four shades. three.js is loaded
 * only when the window opens (this module is imported lazily), so the app stays light.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { CLEAR } from "../paint";

export interface ShotSettings {
  width: number; height: number;
  /** Light strengths, 0–100: key (the main light), fill (softens the shadows), rim (lights the edges from behind). */
  key: number; fill: number; rim: number;
  /** Where each light stands in the rig, seen from above: x left–right, y front (−1, the camera's side) to back. */
  rig: Record<"key" | "fill" | "rim", [number, number]>;
  /** Lens, degrees (narrow: flatter, wide: more depth). */
  fov: number;
  /** -50…50 and 0…100: shift and spread of the shades. */
  brightness: number; contrast: number;
  dither: boolean; outline: boolean;
  /** A sprite: the background see-through and no shade 0 (GB Studio reads color 0 as see-through). */
  sprite: boolean;
}

export interface Stage {
  /** Puts a model on the stage (the old one goes) and frames it. */
  show: (model: THREE.Object3D) => void;
  /** The picture at the shot's size, in shades (0–3, CLEAR for see-through). */
  shot: (settings: ShotSettings) => Uint8Array;
  /** Called when the view changes (dragging the print, zooming). */
  onChange: (listener: () => void) => void;
  triangles: () => number;
  dispose: () => void;
}

/**
 * The stage (the Darkroom, the author's pick 2026-10-14): no separate 3D view; the print itself is what you drag to
 * turn the model (and scroll to zoom), so `handle` is the print's element. The render happens off screen.
 */
export function createStage(handle: HTMLElement): Stage {
  const canvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
  const controls = new OrbitControls(camera, handle);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 0.5));
  const lights = { key: new THREE.DirectionalLight(0xffffff, 2), fill: new THREE.DirectionalLight(0xffffff, 0.7), rim: new THREE.DirectionalLight(0xffffff, 1.2) };
  for (const light of Object.values(lights)) { scene.add(light); scene.add(light.target); }
  let model: THREE.Object3D | null = null, radius = 1;
  const listeners: (() => void)[] = [];
  controls.addEventListener("change", () => listeners.forEach((listener) => listener()));

  let target: THREE.WebGLRenderTarget | null = null;
  const shot = (settings: ShotSettings) => {
    const { width, height } = settings;
    if (!target || target.width !== width || target.height !== height) {
      target?.dispose();
      target = new THREE.WebGLRenderTarget(width, height, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    }
    camera.aspect = width / height;
    camera.fov = settings.fov;
    camera.updateProjectionMatrix();
    // The rig is seen from above with the camera at the front: turn it with the camera so the lights stay put in the picture.
    const view = Math.atan2(camera.position.x, camera.position.z);
    for (const name of ["key", "fill", "rim"] as const) {
      const [x, y] = settings.rig[name], light = lights[name];
      const angle = Math.atan2(x, -y) + view, reach = Math.hypot(x, y);
      light.position.set(Math.sin(angle) * radius * 4 * reach, radius * (1.5 + 2 * (1 - reach)), Math.cos(angle) * radius * 4 * reach);
      light.intensity = (name === "key" ? 3 : name === "fill" ? 1.2 : 2) * settings[name] / 100;
    }
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    const rgba = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(target, 0, 0, width, height, rgba);
    renderer.setRenderTarget(null);
    return toShades(rgba, settings);
  };

  return {
    show(next) {
      if (model) scene.remove(model);
      model = next;
      scene.add(next);
      const box = new THREE.Box3().setFromObject(next), center = box.getCenter(new THREE.Vector3());
      radius = Math.max(0.001, box.getSize(new THREE.Vector3()).length() / 2);
      next.position.sub(center);
      controls.target.set(0, 0, 0);
      camera.position.set(radius * 1.6, radius * 1.1, radius * 2.2);
      camera.near = radius / 100; camera.far = radius * 100;
      camera.updateProjectionMatrix();
      controls.update();
      listeners.forEach((listener) => listener());
    },
    shot,
    onChange(listener) { listeners.push(listener); },
    triangles() {
      let count = 0;
      model?.traverse((child) => { const mesh = child as THREE.Mesh; if (mesh.isMesh) { const geometry = mesh.geometry; count += (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3; } });
      return Math.round(count);
    },
    dispose() { controls.dispose(); target?.dispose(); renderer.dispose(); },
  };
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** The render as shades: brightness to four levels (light 0 … dark 3), dithered and outlined if asked; rows flipped (WebGL reads bottom up). */
export function toShades(rgba: Uint8Array, settings: ShotSettings): Uint8Array {
  const { width, height, brightness, contrast, dither, outline, sprite } = settings;
  const out = new Uint8Array(width * height);
  const spread = 0.5 + contrast / 50; // 0.5 … 2.5
  // The render is linear: brought to what the eye sees (sRGB-ish), then exposed like a camera would: the model's own
  // darkest and brightest (2nd and 98th percentile) span the whole range, so any model and lighting fills the shades.
  const luma = new Float32Array(width * height).fill(-1), seen: number[] = [];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const i = ((height - 1 - y) * width + x) * 4;
    if (rgba[i + 3] < 128) continue;
    const value = Math.pow((0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]) / 255, 1 / 2.2);
    luma[y * width + x] = value; seen.push(value);
  }
  seen.sort((a, b) => a - b);
  const low = seen[Math.floor(seen.length * 0.02)] ?? 0, high = seen[Math.floor(seen.length * 0.98)] ?? 1, range = Math.max(0.05, high - low);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    if (luma[y * width + x] < 0) { out[y * width + x] = sprite ? CLEAR : 0; continue; }
    let light = (luma[y * width + x] - low) / range;
    light = Math.min(1, Math.max(0, (light - 0.5) * spread + 0.5 + brightness / 100));
    const levels = sprite ? 3 : 4;
    let level = (1 - light) * (levels - 1);
    level = dither ? Math.floor(level + (BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16) : Math.round(level);
    level = Math.min(levels - 1, Math.max(0, level));
    out[y * width + x] = sprite ? level + 1 : level;
  }
  if (outline) {
    const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && rgba[((height - 1 - y) * width + x) * 4 + 3] >= 128;
    const lines: number[] = [];
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
      if (!solid(x, y)) continue;
      if (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1)) lines.push(y * width + x);
    }
    for (const at of lines) out[at] = 3;
  }
  return out;
}

/** The model a new stage starts with: a little house beside a tree on a patch of grass, so there's something to try. */
export function sampleModel(): THREE.Object3D {
  const group = new THREE.Group();
  const material = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true });
  const ground = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.2, 24), material(0x7fb15a));
  ground.position.y = -0.1;
  const walls = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1.2), material(0xe8d8b8));
  walls.position.set(-0.4, 0.5, 0);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.8, 4), material(0xa0442e));
  roof.position.set(-0.4, 1.4, 0); roof.rotation.y = Math.PI / 4;
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.55, 0.05), material(0x5a3a22));
  door.position.set(-0.4, 0.28, 0.62);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.6, 8), material(0x6b4a2b));
  trunk.position.set(1.2, 0.3, 0.3);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), material(0x3f8a3a));
  crown.position.set(1.2, 0.95, 0.3);
  group.add(ground, walls, roof, door, trunk, crown);
  return group;
}

/**
 * A model from dropped or picked files: a .glb, a .gltf (with its .bin and textures dropped beside it), or an .obj
 * (with its .mtl, if any: without one it's a plain light grey, which reads well in the four shades).
 */
export async function loadModel(files: File[]): Promise<{ model: THREE.Object3D; name: string }> {
  const byName = new Map(files.map((file) => [file.name.toLowerCase(), file]));
  const main = files.find((file) => /\.(glb|gltf|obj)$/i.test(file.name));
  if (!main) throw new Error("Pick a .glb, .gltf or .obj file (and any files that come with it).");
  const urls: string[] = [];
  const manager = new THREE.LoadingManager();
  // The model's own files point at each other by name: the dropped ones, by name.
  manager.setURLModifier((url) => {
    const file = byName.get(decodeURIComponent(url.split(/[\\/]/).pop() ?? "").toLowerCase());
    if (!file) return url;
    const made = URL.createObjectURL(file); urls.push(made); return made;
  });
  try {
    const name = main.name.toLowerCase();
    if (name.endsWith(".obj")) {
      const loader = new OBJLoader(manager);
      const mtl = files.find((file) => file.name.toLowerCase().endsWith(".mtl"));
      if (mtl) {
        const { MTLLoader } = await import("three/examples/jsm/loaders/MTLLoader.js");
        const materials = new MTLLoader(manager).parse(await mtl.text(), "");
        materials.preload();
        loader.setMaterials(materials);
      }
      const object = loader.parse(await main.text());
      if (!mtl) object.traverse((child) => { const mesh = child as THREE.Mesh; if (mesh.isMesh) mesh.material = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.9 }); });
      return { model: object, name: main.name };
    }
    const data = name.endsWith(".glb") ? await main.arrayBuffer() : await main.text();
    const gltf = await new GLTFLoader(manager).parseAsync(data, "");
    return { model: gltf.scene, name: main.name };
  } finally {
    // Textures have been read by now; the object URLs can go after a moment.
    setTimeout(() => urls.forEach((url) => URL.revokeObjectURL(url)), 5000);
  }
}

/** A built-in model from the app's own files (public/models), by its .gltf's URL. */
export async function loadBuiltIn(url: string): Promise<THREE.Object3D> {
  return (await new GLTFLoader().loadAsync(url)).scene;
}
