import * as THREE from 'three';
import { ElementRef, Injectable, NgZone, OnDestroy } from '@angular/core';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment';

@Injectable({ providedIn: 'root' })
export class EngineService implements OnDestroy {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private scene: THREE.Scene;
  private controls: OrbitControls;
  private grid: THREE.GridHelper;
  private wheels: THREE.Object3D[] = [];
  private frameId: number = null;

  public constructor(private ngZone: NgZone) {}

  public ngOnDestroy(): void {
    if (this.frameId != null) {
      cancelAnimationFrame(this.frameId);
    }
  }

  public createScene(canvas: ElementRef<HTMLCanvasElement>): void {
    // The first step is to get the reference of the canvas element from our HTML document

    const bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xff0000,
      metalness: 0.6,
      roughness: 0.4,
      clearcoat: 0.05,
      clearcoatRoughness: 0.05,
    });

    const detailsMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 1.0,
      roughness: 0.5,
    });

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0.1,
      transmission: 0.9,
      transparent: true,
    });

    const bodyColorInput = document.getElementById('body-color');
    bodyColorInput.addEventListener('change', function (e) {
      bodyMaterial.color.set((<HTMLInputElement>e.target).value);
    });

    const detailsColorInput = document.getElementById('details-color');
    detailsColorInput.addEventListener('input', function (e) {
      detailsMaterial.color.set((<HTMLInputElement>e.target).value);
    });

    const glassColorInput = document.getElementById('glass-color');
    glassColorInput.addEventListener('input', function (e) {
      glassMaterial.color.set((<HTMLInputElement>e.target).value);
    });

    this.canvas = canvas.nativeElement;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true, // transparent background
      antialias: true, // smooth edges
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    //this.renderer.setAnimationLoop(this.render());
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.85;

    // camera
    this.camera = new THREE.PerspectiveCamera(
      40,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(4.25, 1.4, -4.5);

    // controls
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.target.set(0, 0.5, 0);
    this.controls.update();

    // create the scene
    const pmrremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xeeeeee);
    this.scene.environment = pmrremGenerator.fromScene(
      new RoomEnvironment()
    ).texture;
    this.scene.fog = new THREE.Fog(0xeeeeee, 10, 50);

    // grid
    this.grid = new THREE.GridHelper(100, 40, 0x000000, 0x000000);
    this.scene.add(this.grid);

    // car
    const shadow = new THREE.TextureLoader().load('assets/gltf/ferrari_ao.png');
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderConfig({ type: 'js' });
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    loader.load('assets/gltf/ferrari.glb', gltf => {
      const carModel = gltf.scene.children[0];
      (<THREE.Mesh>carModel.getObjectByName('body')).material = bodyMaterial;
      (<THREE.Mesh>carModel.getObjectByName('rim_fl')).material =
        detailsMaterial;
      (<THREE.Mesh>carModel.getObjectByName('rim_fr')).material =
        detailsMaterial;
      (<THREE.Mesh>carModel.getObjectByName('rim_rl')).material =
        detailsMaterial;
      (<THREE.Mesh>carModel.getObjectByName('rim_rr')).material =
        detailsMaterial;
      (<THREE.Mesh>carModel.getObjectByName('glass')).material = glassMaterial;

      this.wheels.push(
        carModel.getObjectByName('wheel_fl'),
        carModel.getObjectByName('wheel_fr'),
        carModel.getObjectByName('wheel_rl'),
        carModel.getObjectByName('wheel_rr')
      );

      // shadow
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.655 * 4, 1.3 * 4),
        new THREE.MeshBasicMaterial({
          map: shadow,
          blending: THREE.MultiplyBlending,
          toneMapped: false,
          transparent: true,
        })
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = 2;
      carModel.add(mesh);
      this.scene.add(carModel);
    });
  }

  public animate(): void {
    // We have to run this outside angular zones,
    // because it could trigger heavy changeDetection cycles.
    this.ngZone.runOutsideAngular(() => {
      if (document.readyState !== 'loading') {
        this.render();
      } else {
        window.addEventListener('DOMContentLoaded', () => {
          this.render();
        });
      }

      window.addEventListener('resize', () => {
        this.resize();
      });
    });
  }

  public render(): void {
    const time = -performance.now() / 1000;
    for (let i = 0; i < this.wheels.length; i++) {
      this.wheels[i].rotation.x = time * Math.PI;
    }
    this.grid.position.z = -time % 5;

    this.frameId = requestAnimationFrame(() => {
      this.render();
    });

    this.renderer.render(this.scene, this.camera);
  }

  public resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }
}
