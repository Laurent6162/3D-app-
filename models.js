// models.js
// Builds the three products (two cans + one bottle) procedurally in Three.js.
// Using LatheGeometry - I define a 2D outline (profile) and Three.js revolves it
// around the Y axis to make the 3D shape. This keeps tri count low.

import * as THREE from 'three';
import { glassShader } from './shaders.js';

// ---------- helpers ----------

// Build a label texture on an HTML canvas.
// Called whenever the edition changes (standard / night / retro).
export function makeLabelTexture(product, edition = 'standard') {
    const c = document.createElement('canvas');
    // wide canvas because it wraps around the can
    c.width = 1024;
    c.height = 512;
    const ctx = c.getContext('2d');

    // pick palette based on edition
    const palettes = {
        standard: { bg: product.colors.primary, fg: product.colors.secondary, text: product.colors.accent },
        night:    { bg: '#0a0c14', fg: product.colors.primary, text: '#ffffff' },
        retro:    { bg: '#ff00aa', fg: '#00ffff', text: '#ffff00' }
    };
    const pal = palettes[edition] || palettes.standard;

    // background
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, c.width, c.height);

    // diagonal stripe (simple brand motif)
    ctx.save();
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate(-0.25);
    ctx.fillStyle = pal.fg;
    ctx.fillRect(-c.width, -40, c.width * 2, 80);
    ctx.restore();

    // brand - repeated across so it wraps nicely
    ctx.fillStyle = pal.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // top small brand
    ctx.font = 'bold 42px "Bebas Neue", sans-serif';
    for (let i = 0; i < 4; i++) {
        ctx.fillText('NOVASODA', (c.width / 4) * i + c.width / 8, 70);
    }

    // main flavour name (repeat twice so both sides of the can show it)
    ctx.font = 'bold 140px "Bebas Neue", sans-serif';
    ctx.fillText(product.name.toUpperCase(), c.width * 0.25, c.height / 2);
    ctx.fillText(product.name.toUpperCase(), c.width * 0.75, c.height / 2);

    // sub flavour
    ctx.font = '26px Inter, sans-serif';
    ctx.fillText(product.flavour, c.width * 0.25, c.height / 2 + 100);
    ctx.fillText(product.flavour, c.width * 0.75, c.height / 2 + 100);

    // volume at bottom
    ctx.font = 'bold 32px "Bebas Neue", sans-serif';
    ctx.fillText(product.volume, c.width / 2, c.height - 50);

    // make a texture from the canvas
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

// ---------- can geometry ----------
// Profile of a typical drinks can in the XY plane (x = radius, y = height)
function canProfile() {
    // units roughly in cm
    const pts = [];
    // bottom inset (concave)
    pts.push(new THREE.Vector2(0.0, 0.2));
    pts.push(new THREE.Vector2(2.2, 0.2));
    pts.push(new THREE.Vector2(2.8, 0.0));   // bottom rim
    pts.push(new THREE.Vector2(3.0, 0.15));
    pts.push(new THREE.Vector2(3.1, 0.6));
    // straight body
    pts.push(new THREE.Vector2(3.1, 10.5));
    // top shoulder curve
    pts.push(new THREE.Vector2(3.05, 10.8));
    pts.push(new THREE.Vector2(2.6, 11.2));
    pts.push(new THREE.Vector2(2.1, 11.5));
    // neck
    pts.push(new THREE.Vector2(2.0, 11.7));
    pts.push(new THREE.Vector2(2.0, 11.9));
    // top rim
    pts.push(new THREE.Vector2(2.1, 12.0));
    pts.push(new THREE.Vector2(2.1, 12.1));
    return pts;
}

// Build a full can (metal body + separate label band).
// The label is a thin cylinder sitting flush against the can body so we can
// swap the texture without rebuilding the whole geometry.
export function buildCan(product) {
    const group = new THREE.Group();
    group.name = 'can-' + product.id;

    // metal body - lathe it
    const bodyGeom = new THREE.LatheGeometry(canProfile(), 64);
    const bodyMat = new THREE.MeshStandardMaterial({
        color: 0xdadde3,
        metalness: 0.9,
        roughness: 0.25
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // label - a cylinder wrapped with the canvas texture
    const labelGeom = new THREE.CylinderGeometry(3.12, 3.12, 9.5, 64, 1, true);
    const labelMat = new THREE.MeshStandardMaterial({
        map: makeLabelTexture(product, 'standard'),
        metalness: 0.1,
        roughness: 0.6
    });
    const label = new THREE.Mesh(labelGeom, labelMat);
    label.name = 'label';
    label.position.y = 5.5;
    group.add(label);

    // pull-tab on top
    const tabGeom = new THREE.TorusGeometry(0.35, 0.08, 8, 16);
    const tabMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1.0, roughness: 0.3 });
    const tab = new THREE.Mesh(tabGeom, tabMat);
    tab.position.set(0, 12.15, 1.0);
    tab.rotation.x = Math.PI / 2;
    group.add(tab);

    // centre it - can is about 12cm tall, want it centred on Y
    group.position.y = -6;
    return group;
}

// ---------- bottle geometry (the more complex model) ----------
function bottleProfile() {
    const pts = [];
    // base
    pts.push(new THREE.Vector2(0.0, 0.0));
    pts.push(new THREE.Vector2(3.6, 0.0));
    pts.push(new THREE.Vector2(3.9, 0.3));
    // lower curve
    pts.push(new THREE.Vector2(4.0, 1.0));
    // bulge body
    pts.push(new THREE.Vector2(4.2, 3.0));
    pts.push(new THREE.Vector2(4.3, 5.0));
    pts.push(new THREE.Vector2(4.2, 7.0));
    pts.push(new THREE.Vector2(4.0, 9.0));
    // shoulder
    pts.push(new THREE.Vector2(3.8, 10.0));
    pts.push(new THREE.Vector2(3.4, 11.0));
    pts.push(new THREE.Vector2(2.6, 12.0));
    pts.push(new THREE.Vector2(1.8, 13.0));
    // neck
    pts.push(new THREE.Vector2(1.3, 13.5));
    pts.push(new THREE.Vector2(1.25, 14.5));
    pts.push(new THREE.Vector2(1.25, 16.0));
    // lip
    pts.push(new THREE.Vector2(1.5, 16.2));
    pts.push(new THREE.Vector2(1.5, 16.5));
    pts.push(new THREE.Vector2(1.3, 16.5));
    return pts;
}

// Inner liquid profile - slightly smaller than the bottle so it sits inside.
function liquidProfile() {
    const pts = [];
    pts.push(new THREE.Vector2(0.0, 0.3));
    pts.push(new THREE.Vector2(3.5, 0.3));
    pts.push(new THREE.Vector2(3.9, 1.0));
    pts.push(new THREE.Vector2(4.1, 3.0));
    pts.push(new THREE.Vector2(4.2, 5.0));
    pts.push(new THREE.Vector2(4.1, 7.0));
    pts.push(new THREE.Vector2(3.9, 9.0));
    pts.push(new THREE.Vector2(3.7, 10.0));
    pts.push(new THREE.Vector2(3.3, 11.0));
    pts.push(new THREE.Vector2(2.5, 12.0));
    // top level of the liquid (inside the neck)
    pts.push(new THREE.Vector2(1.7, 13.0));
    pts.push(new THREE.Vector2(1.15, 13.0));
    pts.push(new THREE.Vector2(0.0, 13.0));
    return pts;
}

export function buildBottle(product) {
    const group = new THREE.Group();
    group.name = 'bottle-' + product.id;

    // liquid inside - render FIRST so it sits behind the glass
    const liquidGeom = new THREE.LatheGeometry(liquidProfile(), 48);
    const liquidMat = new THREE.MeshStandardMaterial({
        color: 0x6a2a12,
        transparent: true,
        opacity: 0.92,
        roughness: 0.25,
        metalness: 0.0
    });
    const liquid = new THREE.Mesh(liquidGeom, liquidMat);
    group.add(liquid);

    // glass body with custom shader (this is the GLSL "deeper understanding" bit)
    const glassGeom = new THREE.LatheGeometry(bottleProfile(), 64);
    const glassMat = new THREE.ShaderMaterial({
        vertexShader: glassShader.vertex,
        fragmentShader: glassShader.fragment,
        uniforms: {
            uTime:       { value: 0 },
            uTint:       { value: new THREE.Color(0x2a1208) },
            uEdgeColor:  { value: new THREE.Color(0xffa34d) },
            uFresnelPow: { value: 2.5 },
            uOpacity:    { value: 0.35 }
        },
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    const glass = new THREE.Mesh(glassGeom, glassMat);
    glass.name = 'glass';
    group.add(glass);

    // neck label (paper band around the belly of the bottle)
    const labelGeom = new THREE.CylinderGeometry(4.28, 4.28, 3.0, 48, 1, true);
    const labelMat = new THREE.MeshStandardMaterial({
        map: makeLabelTexture(product, 'standard'),
        metalness: 0.0,
        roughness: 0.8,
        side: THREE.DoubleSide
    });
    const label = new THREE.Mesh(labelGeom, labelMat);
    label.name = 'label';
    label.position.y = 5.5;
    group.add(label);

    // cap
    const capGeom = new THREE.CylinderGeometry(1.55, 1.55, 1.0, 24);
    const capMat = new THREE.MeshStandardMaterial({
        color: 0xcc3b1f,
        metalness: 0.7,
        roughness: 0.4
    });
    const cap = new THREE.Mesh(capGeom, capMat);
    cap.position.y = 17.0;
    group.add(cap);

    // ridges on the cap (small cylinders around the rim) - adapted from a
    // Three.js example about radial patterns
    for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2;
        const ridgeGeom = new THREE.BoxGeometry(0.1, 0.9, 0.2);
        const ridge = new THREE.Mesh(ridgeGeom, capMat);
        ridge.position.set(Math.cos(angle) * 1.55, 17.0, Math.sin(angle) * 1.55);
        ridge.rotation.y = -angle;
        group.add(ridge);
    }

    group.position.y = -8;
    return group;
}

// ---------- coaster / scene props ----------
export function buildCoaster() {
    const geom = new THREE.CylinderGeometry(8, 8, 0.4, 48);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x14182a,
        metalness: 0.3,
        roughness: 0.7
    });
    const m = new THREE.Mesh(geom, mat);
    m.position.y = -8.2;
    m.receiveShadow = true;
    return m;
}

// ---------- thumbnail renderer ----------
// Render a small still image of a product into an HTML canvas, for the gallery.
export function renderThumbnail(product, size = 60) {
    const c = document.createElement('canvas');
    c.width = c.height = size * 2; // retina

    // super-lightweight standalone scene
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    cam.position.set(10, 4, 18);
    cam.lookAt(0, 2, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(5, 10, 5);
    scene.add(key);

    const mesh = product.shape === 'bottle' ? buildBottle(product) : buildCan(product);
    mesh.scale.set(0.6, 0.6, 0.6);
    scene.add(mesh);

    const r = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true });
    r.setSize(size * 2, size * 2, false);
    r.render(scene, cam);

    // cleanup GPU resources
    r.dispose();
    return c;
}
