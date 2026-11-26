/**
 * LiquidGlass Design System Adapter (v3.0.0)
 * Centralized configuration, named glass variants, and lifecycle management for LiquidGL.
 *
 * CRITICAL RULE ZERO ENFORCEMENT:
 * The homepage hero (#hero) and its subtree are strictly off-limits.
 * Any attempt to mount a glass shader inside #hero is explicitly blocked.
 */

(function () {
  "use strict";

  const isReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Visual Target Configurations matching creative direction:
  // - Dark smoked glass aesthetic
  // - High-contrast content preservation
  // - Real physical refraction, chromatic aberration, and fine specular edges
  const VARIANTS = {
    subtle: {
      resolution: 1.8,
      engine: "auto",
      refraction: 0.006,
      aberration: 0.14,
      bevelDepth: 0.025,
      bevelWidth: 0.050,
      frost: 0.25,
      specular: true,
      tint: "rgba(16, 16, 22, 0.32)",
      interaction: "fluid",
      interactionStrength: 0.20,
      interactionRadius: 0.22,
      interactionViscosity: 0.82,
      tilt: false,
      shadow: false,
    },
    standard: {
      resolution: 2.0,
      engine: "auto",
      refraction: 0.012,
      aberration: 0.22,
      bevelDepth: 0.038,
      bevelWidth: 0.065,
      frost: 0.35,
      specular: true,
      tint: "rgba(14, 14, 18, 0.40)",
      interaction: "fluid",
      interactionStrength: 0.28,
      interactionRadius: 0.26,
      interactionViscosity: 0.76,
      tilt: !isReducedMotion,
      tiltFactor: 4,
      tiltEase: 400,
      shadow: true,
    },
    featured: {
      resolution: 2.0,
      engine: "auto",
      refraction: 0.016,
      aberration: 0.28,
      bevelDepth: 0.045,
      bevelWidth: 0.075,
      frost: 0.38,
      specular: true,
      tint: "rgba(16, 16, 22, 0.44)",
      interaction: "fluid",
      interactionStrength: 0.34,
      interactionRadius: 0.30,
      interactionViscosity: 0.72,
      tilt: !isReducedMotion,
      tiltFactor: 5,
      tiltEase: 450,
      shadow: true,
    },
  };

  const activeInstances = new Set();

  function isHeroElement(el) {
    if (!el) return false;
    return el.id === "hero" || !!el.closest("#hero");
  }

  function applyGlass(target, variantName = "standard", customOptions = {}) {
    if (typeof window.liquidGL !== "function") {
      console.warn("LiquidGlassSystem: liquidGL library not loaded; applying CSS fallback.");
      applyFallback(target);
      return null;
    }

    const elements = typeof target === "string" 
      ? Array.from(document.querySelectorAll(target))
      : (target instanceof NodeList || Array.isArray(target) ? Array.from(target) : [target]);

    const preset = VARIANTS[variantName] || VARIANTS.standard;

    elements.forEach((el) => {
      if (!el || !(el instanceof HTMLElement)) return;

      // CRITICAL RULE ZERO: Explicitly reject any hero elements
      if (isHeroElement(el)) {
        console.warn("LiquidGlassSystem: Blocked glass effect on hero element under Rule Zero:", el);
        return;
      }

      const options = {
        target: el,
        snapshot: "body",
        ...preset,
        ...customOptions,
      };

      try {
        const instance = window.liquidGL(options);
        activeInstances.add(instance);
        el.classList.add("has-liquid-glass", `liquid-glass--${variantName}`);
      } catch (err) {
        console.warn("LiquidGlassSystem: Error mounting liquidGL instance; falling back to CSS:", err);
        applyFallback(el);
      }
    });
  }

  function applyFallback(el) {
    if (!el) return;
    const elements = el instanceof HTMLElement ? [el] : Array.from(document.querySelectorAll(el));
    elements.forEach((node) => {
      if (isHeroElement(node)) return;
      node.classList.add("glass-fallback");
    });
  }

  function initSystem() {
    // 1. Primary Navigation Bar (Featured variant)
    applyGlass(".liquid-glass-nav", "featured", {
      tint: "rgba(16, 16, 20, 0.42)",
      tiltFactor: 4,
    });

    // 2. Header Meta Status Pill (Subtle variant)
    applyGlass(".header-meta-pill", "subtle", {
      tilt: false,
    });

    // 3. Cinema Controls Bar (Featured variant)
    applyGlass(".cinema-controls", "featured", {
      refraction: 0.012,
      aberration: 0.20,
      frost: 0.32,
      tilt: false,
      shadow: true,
    });

    // 4. Final CTA Solid Button (Liquid Crimson Crystal)
    applyGlass(".liquid-glass-cta", "featured", {
      refraction: 0.014,
      aberration: 0.22,
      tint: "rgba(180, 22, 24, 0.45)",
      tiltFactor: 4.5,
    });

    // 5. Final CTA Ghost Button (Standard variant)
    applyGlass(".liquid-glass-ghost", "standard", {
      refraction: 0.008,
      frost: 0.32,
      tiltFactor: 3.5,
    });

    // 6. Auto-bind any elements declaring [data-liquid-glass]
    document.querySelectorAll("[data-liquid-glass]").forEach((el) => {
      if (isHeroElement(el)) return;
      const variant = el.getAttribute("data-liquid-glass") || "standard";
      applyGlass(el, variant);
    });

    // Register dynamic background motion so shader snapshots update during continuous scroll/animation
    if (typeof window.liquidGL?.registerDynamic === "function") {
      const dynamicElements = [];
      const video = document.getElementById("mainReelVideo");
      if (video) dynamicElements.push(video);

      if (dynamicElements.length) {
        window.liquidGL.registerDynamic(dynamicElements);
      }
    }

    // Synchronize LiquidGL render loop
    window.addEventListener("load", () => {
      if (typeof window.liquidGL?.syncWith === "function") {
        window.liquidGL.syncWith();
      }
    });
  }

  // Export system API to window
  window.LiquidGlassSystem = {
    variants: VARIANTS,
    apply: applyGlass,
    applyFallback,
    init: initSystem,
    instances: activeInstances,
  };
})();
