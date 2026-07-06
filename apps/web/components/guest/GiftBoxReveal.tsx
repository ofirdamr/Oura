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

export function GiftBoxReveal({
  onOpenChange,
  className = "",
}: {
  onOpenChange?: (opened: boolean) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Latest callback without re-running the scene effect.
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

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
    container.appendChild(renderer.domElement);

    // --- Lights (decay:0 keeps the mockup's straightforward, predictable
    // intensity model rather than physical inverse-square falloff) ---
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);

    const topLight = new THREE.DirectionalLight(0xffffff, 1.4);
    topLight.position.set(2, 8, 4);
    scene.add(topLight);

    const rimLight = new THREE.PointLight(PRIMARY, 2.4, 0, 0);
    rimLight.position.set(5, 4, 5);
    scene.add(rimLight);

    // Glow from inside the box - dark until the lid opens.
    const innerGlow = new THREE.PointLight(PRIMARY, 0, 6, 0);
    innerGlow.position.set(0, 0.4, 0);
    scene.add(innerGlow);

    // --- Box ---
    const group = new THREE.Group();
    scene.add(group);

    // One shared material for body + lid, matching the original source's
    // single `boxMaterial` exactly (color/roughness/metalness), including
    // reusing the same instance rather than two separately-tuned ones.
    const boxMat = new THREE.MeshStandardMaterial({
      color: BOX_DARK,
      roughness: 0.1,
      metalness: 0.8,
    });
    const bodyGeo = new THREE.BoxGeometry(2, 1.5, 2);
    const body = new THREE.Mesh(bodyGeo, boxMat);
    group.add(body);

    const lidGeo = new THREE.BoxGeometry(2.1, 0.4, 2.1);
    const lid = new THREE.Mesh(lidGeo, boxMat);
    lid.position.y = 0.9;
    group.add(lid);

    // Crossed ribbons - plain matte MeshStandardMaterial with only a color,
    // matching the original source exactly (no metalness/emissive override
    // there, so this takes the material's own defaults).
    const ribbonMat = new THREE.MeshStandardMaterial({
      color: PRIMARY,
    });
    const ribbonGeo = new THREE.BoxGeometry(0.26, 1.62, 2.2);
    const ribbon1 = new THREE.Mesh(ribbonGeo, ribbonMat);
    const ribbon2 = new THREE.Mesh(ribbonGeo, ribbonMat);
    ribbon2.rotation.y = Math.PI / 2;
    group.add(ribbon1, ribbon2);

    // --- Inner "gift" placeholder card (hidden inside the box until opened) ---
    const cardTex = makePlaceholderTexture();
    const cardMat = new THREE.MeshStandardMaterial({
      map: cardTex,
      roughness: 0.4,
      metalness: 0.1,
      emissive: PRIMARY,
      emissiveIntensity: 0.15,
    });
    const cardGeo = new THREE.BoxGeometry(1.05, 1.3, 0.05);
    const card = new THREE.Mesh(cardGeo, cardMat);
    card.position.y = -0.2; // tucked inside the box
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

      const tl = gsap.timeline();
      tl.to(lid.position, { y: 3.1, duration: 1.1, ease: "power4.out" }, 0);
      tl.to(
        lid.rotation,
        { x: -Math.PI / 4, z: Math.PI / 12, duration: 1.1, ease: "power3.out" },
        0,
      );
      tl.to(
        group.scale,
        { x: 1.12, y: 1.12, z: 1.12, duration: 0.4, yoyo: true, repeat: 1 },
        0,
      );
      tl.to(innerGlow, { intensity: 3.2, duration: 0.9, ease: "power2.out" }, 0.15);
      tl.to(
        card.position,
        { y: 1.75, duration: 1.2, ease: "back.out(1.4)" },
        0.25,
      );
      tl.to(
        card.scale,
        { x: 1, y: 1, z: 1, duration: 1.0, ease: "power2.out" },
        0.25,
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
      ]);
      resizeObserver.disconnect();
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);

      bodyGeo.dispose();
      lidGeo.dispose();
      ribbonGeo.dispose();
      cardGeo.dispose();
      boxMat.dispose();
      ribbonMat.dispose();
      cardMat.dispose();
      cardTex.dispose();

      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`h-full w-full touch-none select-none ${className}`}
    />
  );
}
