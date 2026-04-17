// scene.js
// Three.js scene - handles the renderer, camera, lights, OrbitControls,
// raycaster for clicks, the post-processing composer (bloom pass), and the
// render loop. Loading / swapping of actual product meshes is handled here
// but the mesh-building code lives in models.js.

import * as THREE from 'three';
import { OrbitControls }        from 'three/addons/controls/OrbitControls.js';
import { EffectComposer }       from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }           from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass }      from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }           from 'three/addons/postprocessing/OutputPass.js';
import { buildCan, buildBottle, buildCoaster, makeLabelTexture } from './models.js';

export class Viewer {
    constructor(container) {
        this.container = container;

        // renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        container.appendChild(this.renderer.domElement);

        // scene + background gradient
        this.scene = new THREE.Scene();
        this.scene.background = this._makeGradient();

        // camera
        this.camera = new THREE.PerspectiveCamera(
            40,
            container.clientWidth / container.clientHeight,
            0.1, 200
        );
        this.camera.position.set(22, 6, 22);

        // orbit controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0, 0, 0);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 60;

        // lighting rig (three-point + optional spot)
        this._setupLights();

        // coaster
        this.scene.add(buildCoaster());

        // post-processing
        this._setupPostFX();

        // state
        this.currentMesh = null;
        this.currentProduct = null;
        this.wireframe = false;
        this.bloomEnabled = false;
        this.shaderEnabled = true;        // glass shader on by default
        this.autoRotate = false;
        this.spinRemaining = 0;           // radians left to spin on "spin once"
        this.clock = new THREE.Clock();

        // raycaster for click-on-model
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.renderer.domElement.addEventListener('pointerdown', (e) => this._onPointerDown(e));

        // resize handling
        window.addEventListener('resize', () => this._onResize());

        // kick off render loop
        this._animate();
    }

    // ---------- setup helpers ----------

    _makeGradient() {
        // simple vertical gradient as scene background using a canvas texture
        const c = document.createElement('canvas');
        c.width = 4; c.height = 256;
        const ctx = c.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, 0, 256);
        g.addColorStop(0, '#111625');
        g.addColorStop(0.5, '#1a2138');
        g.addColorStop(1, '#0a0c14');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 4, 256);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }

    _setupLights() {
        // ambient - barely there, just to stop full black shadows
        this.ambient = new THREE.AmbientLight(0xffffff, 0.12);
        this.scene.add(this.ambient);

        // key - main light, warm
        this.keyLight = new THREE.DirectionalLight(0xfff0e0, 1.2);
        this.keyLight.position.set(10, 15, 8);
        this.keyLight.castShadow = true;
        this.keyLight.shadow.mapSize.set(1024, 1024);
        this.scene.add(this.keyLight);

        // fill - from the other side, cool
        this.fillLight = new THREE.DirectionalLight(0x88b0ff, 0.5);
        this.fillLight.position.set(-10, 8, 5);
        this.scene.add(this.fillLight);

        // rim - behind the object for a magenta edge highlight
        this.rimLight = new THREE.DirectionalLight(0xff4d8d, 0.9);
        this.rimLight.position.set(0, 10, -12);
        this.scene.add(this.rimLight);

        // spot - extra punch, off by default
        this.spotLight = new THREE.SpotLight(0xffffff, 60, 40, Math.PI / 6, 0.5, 1);
        this.spotLight.position.set(0, 25, 0);
        this.spotLight.target.position.set(0, 0, 0);
        this.spotLight.visible = false;
        this.scene.add(this.spotLight);
        this.scene.add(this.spotLight.target);
    }

    _setupPostFX() {
        this.composer = new EffectComposer(this.renderer);
        this.composer.setSize(this.container.clientWidth, this.container.clientHeight);

        this.renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(this.renderPass);

        // bloom pass - tuned fairly subtle so the cans do not glow like light bulbs.
        // Disabled by default so it matches the Bloom button being off at start,
        // otherwise the first click of the button just "turns on what was already on"
        // and looks like it did nothing.
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(this.container.clientWidth, this.container.clientHeight),
            0.6,    // strength
            0.6,    // radius
            0.85    // threshold
        );
        this.bloomPass.enabled = false;
        this.composer.addPass(this.bloomPass);

        this.outputPass = new OutputPass();
        this.composer.addPass(this.outputPass);
    }

    // ---------- model swap ----------

    loadProduct(product) {
        // remove previous
        if (this.currentMesh) {
            this.scene.remove(this.currentMesh);
            this._disposeMesh(this.currentMesh);
        }
        this.currentProduct = product;
        this.currentMesh = product.shape === 'bottle'
            ? buildBottle(product)
            : buildCan(product);
        this.scene.add(this.currentMesh);
        // re-apply current rendering toggles so the new mesh picks up
        // whatever mode the user had selected before switching
        this.setWireframe(this.wireframe);
        this.setShaderEnabled(this.shaderEnabled);
    }

    setEdition(edition) {
        if (!this.currentMesh || !this.currentProduct) return;
        const label = this.currentMesh.getObjectByName('label');
        if (label && label.material && label.material.map) {
            // swap the canvas texture - no geometry rebuild needed
            label.material.map.dispose();
            label.material.map = makeLabelTexture(this.currentProduct, edition);
            label.material.needsUpdate = true;
        }
    }

    _disposeMesh(root) {
        root.traverse((o) => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) {
                if (o.material.map) o.material.map.dispose();
                o.material.dispose();
            }
        });
    }

    // ---------- toggles ----------

    setWireframe(on) {
        this.wireframe = on;
        if (!this.currentMesh) return;
        this.currentMesh.traverse((o) => {
            if (o.material && 'wireframe' in o.material) {
                o.material.wireframe = on;
            }
        });
    }

    setBloom(on) {
        this.bloomEnabled = on;
        this.bloomPass.enabled = on;
    }

    setShaderEnabled(on) {
        this.shaderEnabled = on;
        if (!this.currentMesh) return;
        const glass = this.currentMesh.getObjectByName('glass');
        if (!glass) return;
        // toggle between the custom shader and a plain physical material
        // so users can see what the shader does.
        if (on) {
            if (glass.userData.shaderMat) glass.material = glass.userData.shaderMat;
        } else {
            if (!glass.userData.plainMat) {
                glass.userData.plainMat = new THREE.MeshPhysicalMaterial({
                    color: 0x3a1708,
                    transmission: 0.6,
                    transparent: true,
                    opacity: 0.5,
                    roughness: 0.2
                });
            }
            glass.userData.shaderMat = glass.userData.shaderMat || glass.material;
            glass.material = glass.userData.plainMat;
        }
    }

    setLight(which, on) {
        const map = {
            key: this.keyLight,
            fill: this.fillLight,
            rim: this.rimLight,
            spot: this.spotLight
        };
        const l = map[which];
        if (l) l.visible = on;
    }

    setCamera(preset) {
        const presets = {
            default: [22, 6, 22],
            front:   [0, 4, 28],
            top:     [0, 30, 0.1],
            low:     [18, -4, 18]
        };
        const p = presets[preset] || presets.default;
        this.camera.position.set(...p);
        this.controls.target.set(0, 2, 0);
        this.controls.update();
    }

    setAutoRotate(on) {
        this.autoRotate = on;
        this.controls.autoRotate = on;
        this.controls.autoRotateSpeed = 1.5;
    }

    spinOnce() {
        // queue a full 2pi rotation over the next ~1.2s
        this.spinRemaining = Math.PI * 2;
    }

    // ---------- events ----------

    _onPointerDown(e) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        if (!this.currentMesh) return;
        const hits = this.raycaster.intersectObject(this.currentMesh, true);
        if (hits.length) {
            this.spinOnce();
        }
    }

    _onResize() {
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.composer.setSize(w, h);
    }

    // ---------- render loop ----------

    _animate() {
        requestAnimationFrame(() => this._animate());
        const dt = this.clock.getDelta();

        // update custom shader uniform
        if (this.currentMesh) {
            const glass = this.currentMesh.getObjectByName('glass');
            if (glass && glass.material && glass.material.uniforms && glass.material.uniforms.uTime) {
                glass.material.uniforms.uTime.value += dt;
            }

            // spin-once animation
            if (this.spinRemaining > 0) {
                const step = Math.min(this.spinRemaining, dt * 6);  // ~6 rad/s = ~1s for full spin
                this.currentMesh.rotation.y += step;
                this.spinRemaining -= step;
            }
        }

        this.controls.update();

        // render through composer so bloom toggle actually has an effect
        this.composer.render(dt);
    }
}
