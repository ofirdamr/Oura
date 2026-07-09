"use client";

// The guest's "big reveal" moment: a real 3D gift box (Three.js) that idles
// with a slow spin, can be dragged to rotate, and opens on click/tap with a
// GSAP-choreographed lid lift + inner glow + a placeholder "photo card" rising
// out of the box. This is the celebratory transition after the consent gate,
// before the guest lands on their personal gallery.
//
// Why raw Three.js + GSAP rather than react-three-fiber: the app runs on a very
// new React 19.2 / Next 16.2 stack, and the opening sequence is inherently an
// imperative GSAP timeline (mirrors the Stitch mockup's choreography exactly).
// Keeping the scene in a single self-managed useEffect - with explicit teardown
// (rAF cancel, GSAP kill, listener + ResizeObserver cleanup, GPU disposal +
// forced context loss) - is the most robust integration and avoids pulling in
// the r3f/drei React-19 compatibility surface for a single screen. Stays within
// CLAUDE.md's stated "Three.js + GSAP" stack; no CDN tags, real npm deps.
//
// SSR note: WebGL/canvas APIs don't exist server-side, so this is a client
// component and the page dynamic-imports it with `ssr: false`.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import gsap from "gsap";

// Colors match the original Stitch source (design/screens/
// oura_final_production_gift_box_reveal_desktop/code.html) exactly, not the
// app's generic brand primary - the ribbon/light color there is a distinct
// muted rust (#9f402d), not the app-wide coral primary.
const PRIMARY = 0x9f402d;
const BOX_DARK = 0x121212;

// Draws the placeholder "gift" that rises out of the box - deliberately the
// same visual language as the app's PhotoTile placeholders (dark card, muted
// image glyph), since no real event media exists yet. Self-contained canvas
// texture, no external asset to load.
function makePlaceholderTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = Math.round(size * 1.25);
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width;
  const h = canvas.height;

  // Card background
  ctx.fillStyle = "#1e1e1e";
  ctx.fillRect(0, 0, w, h);

  // Inner border
  ctx.strokeStyle = "rgba(255,138,117,0.5)";
  ctx.lineWidth = 10;
  ctx.strokeRect(24, 24, w - 48, h - 48);

  // Simple "image" glyph (mountains + sun), muted
  const cx = w / 2;
  const cy = h / 2;
  ctx.fillStyle = "rgba(255,138,117,0.85)";
  ctx.beginPath();
  ctx.arc(cx + 70, cy - 90, 34, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(176,176,176,0.55)";
  ctx.beginPath();
  ctx.moveTo(cx - 150, cy + 120);
  ctx.lineTo(cx - 40, cy - 20);
  ctx.lineTo(cx + 40, cy + 70);
  ctx.lineTo(cx + 120, cy - 30);
  ctx.lineTo(cx + 170, cy + 120);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Draws a REAL guest photo onto the same framed card, cover-cropped to the
// card's portrait aspect so any source aspect ratio fits without distortion.
// This is what turns the reveal's rising card into an actual teaser of the
// guest's own matched photo, instead of the generic placeholder glyph.
function makePhotoTexture(img: HTMLImageElement): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = Math.round(size * 1.25);
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = "#1e1e1e";
  ctx.fillRect(0, 0, w, h);

  // Cover-fit: scale so the image fills the card, center-cropping the overflow.
  const imgRatio = img.width / img.height;
  const cardRatio = w / h;
  let dw: number, dh: number, dx: number, dy: number;
  if (imgRatio > cardRatio) {
    dh = h;
    dw = h * imgRatio;
    dx = (w - dw) / 2;
    dy = 0;
  } else {
    dw = w;
    dh = w / imgRatio;
    dx = 0;
    dy = (h - dh) / 2;
  }
  ctx.drawImage(img, dx, dy, dw, dh);

  // Rust frame to match the card's premium framed look.
  ctx.strokeStyle = "rgba(159,64,45,0.95)";
  ctx.lineWidth = 16;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function GiftBoxReveal({
  onOpenChange,
  photoUrl,
  className = "",
}: {
  onOpenChange?: (opened: boolean) => void;
  // A real photo (the guest's first matched photo, else a general event photo)
  // to show on the rising card. Falls back to the placeholder glyph if absent
  // or if it fails to load. Requires the media origin to send CORS (it does).
  photoUrl?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Latest callback without re-running the scene effect.
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  // Shared with the photo-loading effect so it can swap the card texture in
  // without rebuilding the whole scene.
  const cardMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const photoTexRef = useRef<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let width = container.clientWidth || 1;
    let height = container.clientHeight || 1;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1.25, 5.4);
    camera.lookAt(0, 0.2, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    // Neutral tone mapping keeps the rust ribbon close to its real #9f402d hex;
    // ACES noticeably warms/orange-shifts saturated reds at these light levels.
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    // --- Environment map ---
    // Stitch's material is a near-mirror metal (metalness 0.8 / roughness 0.1).
    // A metal reflects its ENVIRONMENT; with nothing to reflect it renders flat
    // black - which is exactly why the literal port (and Stitch's own screen.png)
    // showed a dead, near-invisible box with only the ribbons catching light.
    // Generating a soft studio environment (RoomEnvironment -> PMREM) gives the
    // dark metal real reflections so it reads as a glossy, premium gift box.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;

    // --- Lights (decay:0 keeps the mockup's straightforward, predictable
    // intensity model rather than physical inverse-square falloff) ---
    const ambient = new THREE.AmbientLight(0xffffff, 0.22);
    scene.add(ambient);

    const topLight = new THREE.DirectionalLight(0xffffff, 0.8);
    topLight.position.set(2, 8, 4);
    scene.add(topLight);

    // Neutral warm-white key light so the box faces and the rust ribbon read in
    // their TRUE colours. Stitch's source used a rust-coloured point light here,
    // but shining rust light on the rust ribbon (then tone-mapping it) pushed the
    // ribbon to a bright orange - the exact "wrong colour" the founder flagged.
    const keyLight = new THREE.PointLight(0xfff1e6, 1.0, 0, 0);
    keyLight.position.set(4, 5, 5);
    scene.add(keyLight);

    // A faint rust accent light kept low, purely for mood on the box's metal -
    // not strong enough to tint the ribbon.
    const rimLight = new THREE.PointLight(PRIMARY, 0.5, 0, 0);
    rimLight.position.set(-4, 3, 4);
    scene.add(rimLight);

    const fillLight = new THREE.PointLight(0xbcd4ff, 0.45, 0, 0);
    fillLight.position.set(-5, 2, 3);
    scene.add(fillLight);

    // Glow from inside the box - dark until the lid opens.
    const innerGlow = new THREE.PointLight(PRIMARY, 0, 6, 0);
    innerGlow.position.set(0, 0.4, 0);
    scene.add(innerGlow);

    // --- Box ---
    // A premium wrapped gift box built from soft, rounded-edge primitives (not
    // Stitch's bare hard-edged BoxGeometry): a rounded body, an overhanging
    // rounded lid, satin rust ribbons wrapping the sides, and a real ribbon bow
    // (knot + two loops + two tails) on top. The lid, its top ribbon cross and
    // the bow all live in `lidGroup` so they lift away together on open.
    const group = new THREE.Group();
    scene.add(group);

    // Geometry registry so teardown can dispose everything without naming each.
    const geometries: THREE.BufferGeometry[] = [];
    const track = <G extends THREE.BufferGeometry>(g: G): G => {
      geometries.push(g);
      return g;
    };

    // Deep warm-charcoal box with a clear glossy finish (reads as a premium dark
    // box catching studio reflections rather than a flat black blob).
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0x232025,
      roughness: 0.22,
      metalness: 0.5,
      envMapIntensity: 2.3,
      transparent: true,
    });
    // Satin rust ribbon (#9f402d): soft sheen, true colour under neutral tone
    // mapping (a rust-tinted light + emissive previously blew it out to orange).
    const ribbonMat = new THREE.MeshStandardMaterial({
      color: PRIMARY,
      roughness: 0.5,
      metalness: 0.22,
      envMapIntensity: 0.45,
      transparent: true,
    });

    // Box body as an OPEN-TOP container (four walls + a floor, no top face) so
    // that once the lid lifts the box reads as genuinely open - you see down
    // into the cavity as the gift rises out, instead of a still-capped top.
    const BODY_W = 2;
    const BODY_H = 1.4;
    const BODY_D = 2;
    const WALL = 0.14;
    const body = new THREE.Group();
    body.position.y = -0.15;
    group.add(body);

    const floor = new THREE.Mesh(
      track(new RoundedBoxGeometry(BODY_W, WALL, BODY_D, 4, 0.05)),
      boxMat,
    );
    floor.position.y = -BODY_H / 2 + WALL / 2;
    body.add(floor);

    const wallFBGeo = track(new RoundedBoxGeometry(BODY_W, BODY_H, WALL, 4, 0.05));
    const wallLRGeo = track(new RoundedBoxGeometry(WALL, BODY_H, BODY_D, 4, 0.05));
    const frontWall = new THREE.Mesh(wallFBGeo, boxMat);
    frontWall.position.z = BODY_D / 2 - WALL / 2;
    const backWall = new THREE.Mesh(wallFBGeo, boxMat);
    backWall.position.z = -(BODY_D / 2 - WALL / 2);
    const leftWall = new THREE.Mesh(wallLRGeo, boxMat);
    leftWall.position.x = -(BODY_W / 2 - WALL / 2);
    const rightWall = new THREE.Mesh(wallLRGeo, boxMat);
    rightWall.position.x = BODY_W / 2 - WALL / 2;
    body.add(frontWall, backWall, leftWall, rightWall);

    // Warm inner liner on the cavity floor so the open box glows from within
    // (paired with innerGlow) rather than showing a flat black hole.
    const linerMat = new THREE.MeshStandardMaterial({
      color: 0x3a140b,
      roughness: 0.7,
      metalness: 0.0,
      emissive: PRIMARY,
      emissiveIntensity: 0.25,
      transparent: true,
    });
    const liner = new THREE.Mesh(
      track(new THREE.BoxGeometry(BODY_W - WALL * 2, 0.04, BODY_D - WALL * 2)),
      linerMat,
    );
    liner.position.y = -BODY_H / 2 + WALL;
    body.add(liner);

    // Ribbon strips hugging ONLY the outer face of each of the four walls, so no
    // ribbon ever crosses the open interior. (The previous solid bands spanned
    // the full width/depth and passed through the cavity, showing ribbon "inside"
    // the box once the lid was off.) Each strip sits flat on its wall's outside.
    const ribbonStripFB = track(new RoundedBoxGeometry(0.26, 1.44, 0.1, 3, 0.03));
    const ribbonStripLR = track(new RoundedBoxGeometry(0.1, 1.44, 0.26, 3, 0.03));
    const frontRibbon = new THREE.Mesh(ribbonStripFB, ribbonMat);
    frontRibbon.position.set(0, -0.15, BODY_D / 2);
    const backRibbon = new THREE.Mesh(ribbonStripFB, ribbonMat);
    backRibbon.position.set(0, -0.15, -BODY_D / 2);
    const leftRibbon = new THREE.Mesh(ribbonStripLR, ribbonMat);
    leftRibbon.position.set(-BODY_W / 2, -0.15, 0);
    const rightRibbon = new THREE.Mesh(ribbonStripLR, ribbonMat);
    rightRibbon.position.set(BODY_W / 2, -0.15, 0);
    group.add(frontRibbon, backRibbon, leftRibbon, rightRibbon);

    // --- Lid group (lid + top ribbon cross + bow) - lifts away as one unit ---
    // The lid parts get their OWN cloned materials (transparent-enabled) so the
    // whole lid can fade out on open without affecting the body's shared
    // materials. On open the lid lifts straight up, out of frame, and fades to
    // nothing - so it reads as cleanly removed instead of hovering in a broken
    // pose over the box.
    const lidMat = boxMat.clone();
    lidMat.transparent = true;
    const lidRibbonMat = ribbonMat.clone();
    lidRibbonMat.transparent = true;

    const lid = new THREE.Group();
    lid.position.y = 0.62;
    group.add(lid);

    const lidBox = new THREE.Mesh(
      track(new RoundedBoxGeometry(2.16, 0.42, 2.16, 5, 0.08)),
      lidMat,
    );
    lid.add(lidBox);

    // Ribbon cross over the top of the lid.
    const lidRibbonGeoZ = track(new RoundedBoxGeometry(0.26, 0.46, 2.2, 3, 0.03));
    const lidRibbonGeoX = track(new RoundedBoxGeometry(2.2, 0.46, 0.26, 3, 0.03));
    lid.add(new THREE.Mesh(lidRibbonGeoZ, lidRibbonMat));
    lid.add(new THREE.Mesh(lidRibbonGeoX, lidRibbonMat));

    // Bow: a center knot, two upright loops, two trailing tails.
    const bow = new THREE.Group();
    bow.position.y = 0.24;
    lid.add(bow);

    const knot = new THREE.Mesh(
      track(new RoundedBoxGeometry(0.34, 0.3, 0.34, 4, 0.1)),
      lidRibbonMat,
    );
    knot.position.y = 0.16;
    bow.add(knot);

    const loopGeo = track(new THREE.TorusGeometry(0.28, 0.07, 16, 40));
    for (const dir of [-1, 1]) {
      const loop = new THREE.Mesh(loopGeo, lidRibbonMat);
      // Stand the ring upright and tilt it outward to form a bow wing.
      loop.rotation.x = Math.PI / 2;
      loop.rotation.y = dir * 0.5;
      loop.position.set(dir * 0.3, 0.16, 0);
      loop.scale.set(1, 0.8, 1);
      bow.add(loop);
    }

    const tailGeo = track(new RoundedBoxGeometry(0.16, 0.5, 0.05, 3, 0.02));
    for (const dir of [-1, 1]) {
      const tail = new THREE.Mesh(tailGeo, lidRibbonMat);
      tail.position.set(dir * 0.14, -0.1, 0.12);
      tail.rotation.z = dir * 0.35;
      bow.add(tail);
    }

    // --- Inner "gift" placeholder card (hidden inside the box until opened) ---
    const cardTex = makePlaceholderTexture();
    const cardMat = new THREE.MeshStandardMaterial({
      map: cardTex,
      roughness: 0.4,
      metalness: 0.1,
      emissive: PRIMARY,
      emissiveIntensity: 0.15,
    });
    cardMatRef.current = cardMat;
    // If a real photo already arrived before the scene finished building, apply
    // it now (the photo effect below no-ops until the material exists).
    if (photoTexRef.current) {
      cardMat.map = photoTexRef.current;
      cardMat.emissiveIntensity = 0.05;
      cardMat.needsUpdate = true;
    }
    const cardGeo = track(new THREE.BoxGeometry(1.05, 1.3, 0.05));
    const card = new THREE.Mesh(cardGeo, cardMat);
    card.position.y = -0.3; // tucked inside the box
    card.scale.setScalar(0.6);
    card.visible = false;
    group.add(card);

    // --- Interaction state ---
    let opened = false;
    let dragging = false;
    let pointerDown = false;
    let lastX = 0;
    let movedDistance = 0;
    let autoSpin = true;

    function setOpened(next: boolean) {
      opened = next;
      onOpenChangeRef.current?.(next);
    }

    function openBox() {
      if (opened) return;
      setOpened(true);
      autoSpin = false;
      card.visible = true;

      // Real unwrapping - NOTHING is deleted or faded. The lid (with its ribbon
      // cross AND bow still on it) lifts straight off the TOP of the box and is
      // set up and to the side, staying fully visible, exactly like taking a lid
      // off a real gift box. The box body and the ribbon wrapping its sides both
      // stay put; only the top (the lid) is removed. The photo then rises up out
      // of the now-open box.
      const tl = gsap.timeline();
      // Lid lifts UP and clearly BEHIND the box (negative z), so its slab can
      // never hang over or intersect the photo that rises in front. Kept to the
      // side and gently tilted so it still reads as "the lid, set aside".
      tl.to(
        lid.position,
        { y: 2.5, x: 1.25, z: -1.1, duration: 1.0, ease: "power3.out" },
        0,
      );
      tl.to(
        lid.rotation,
        { x: -Math.PI / 10, y: Math.PI / 7, z: Math.PI / 7, duration: 1.0, ease: "power3.out" },
        0,
      );
      tl.to(group.scale, { x: 1.06, y: 1.06, z: 1.06, duration: 0.35, yoyo: true, repeat: 1 }, 0);
      // Keep the interior lit so the open box glows warmly.
      tl.to(innerGlow, { intensity: 2.6, duration: 0.7, ease: "power2.out" }, 0.2);
      // The photo stands up and rises out of the open box as the hero. It stays
      // within the box footprint in depth (z inside the walls) and clearly in
      // FRONT of the lid, so nothing ever pokes through it.
      tl.to(
        card.position,
        { y: 1.05, z: 0.35, duration: 1.1, ease: "back.out(1.3)" },
        0.4,
      );
      tl.to(
        card.scale,
        { x: 1.25, y: 1.25, z: 1.25, duration: 1.0, ease: "power2.out" },
        0.4,
      );

      if (typeof navigator !== "undefined") {
        navigator.vibrate?.(50);
      }
    }

    // --- Pointer handling: drag to rotate, click/tap (below move threshold)
    // to open ---
    const el = renderer.domElement;

    function onPointerDown(e: PointerEvent) {
      pointerDown = true;
      dragging = false;
      lastX = e.clientX;
      movedDistance = 0;
      el.setPointerCapture?.(e.pointerId);
    }
    function onPointerMove(e: PointerEvent) {
      if (!pointerDown) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      movedDistance += Math.abs(dx);
      if (movedDistance > 5) dragging = true;
      group.rotation.y += dx * 0.01;
    }
    function onPointerUp(e: PointerEvent) {
      if (pointerDown && !dragging && movedDistance <= 5) {
        openBox();
      }
      pointerDown = false;
      dragging = false;
      el.releasePointerCapture?.(e.pointerId);
    }

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);

    // --- Resize ---
    const resizeObserver = new ResizeObserver(() => {
      width = container.clientWidth || 1;
      height = container.clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(container);

    // --- Animation loop ---
    let rafId = 0;
    let disposed = false;
    const startTime = performance.now();

    function animate() {
      if (disposed) return;
      rafId = requestAnimationFrame(animate);
      const t = (performance.now() - startTime) / 1000;

      if (autoSpin && !pointerDown) {
        group.rotation.y += 0.005;
      } else if (opened) {
        group.rotation.y += 0.0016;
      }

      if (opened && card.visible) {
        // Gentle bob + face-forward drift once revealed.
        card.position.x = Math.sin(t * 1.2) * 0.04;
        card.rotation.y = Math.sin(t * 0.8) * 0.25;
      }

      renderer.render(scene, camera);
    }
    animate();

    // --- Teardown ---
    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      gsap.killTweensOf([
        lid.position,
        lid.rotation,
        group.scale,
        innerGlow,
        card.position,
        card.scale,
        lidMat,
        lidRibbonMat,
        boxMat,
        ribbonMat,
        linerMat,
      ]);
      resizeObserver.disconnect();
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);

      for (const g of geometries) g.dispose();
      boxMat.dispose();
      ribbonMat.dispose();
      lidMat.dispose();
      lidRibbonMat.dispose();
      linerMat.dispose();
      cardMat.dispose();
      cardTex.dispose();
      photoTexRef.current?.dispose();
      cardMatRef.current = null;
      envTexture.dispose();
      pmrem.dispose();

      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Load the real photo (when it arrives from the parent's gallery fetch) and
  // swap it onto the already-built card material, without rebuilding the scene.
  useEffect(() => {
    if (!photoUrl) return;
    let cancelled = false;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      const tex = makePhotoTexture(img);
      const prevPhoto = photoTexRef.current;
      photoTexRef.current = tex;
      const mat = cardMatRef.current;
      if (mat) {
        mat.map = tex;
        // A real photo doesn't need the placeholder's warm glow.
        mat.emissiveIntensity = 0.05;
        mat.needsUpdate = true;
      }
      // Dispose only a previous PHOTO texture (never the placeholder, which the
      // scene teardown owns).
      prevPhoto?.dispose();
    };
    img.onerror = () => {
      // Keep the placeholder card on failure — the reveal must never break.
    };
    img.src = photoUrl;
    return () => {
      cancelled = true;
    };
  }, [photoUrl]);

  return (
    <div
      ref={containerRef}
      className={`h-full w-full touch-none select-none ${className}`}
    />
  );
}
