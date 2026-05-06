import * as THREE from 'three';

// ============ THREE.JS SETUP ============
export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060606);
scene.fog = new THREE.Fog(0x060606, 15, 35);

export const camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.1, 50);
camera.position.set(0, 1.6, -2);

export const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 3.35;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);

const hemiLight = new THREE.HemisphereLight(0xffeedd, 0x1b1b24, 1.3);
scene.add(hemiLight);
scene.add(new THREE.AmbientLight(0xfff2dc, 0.52));

export function resizeRenderer(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
}
