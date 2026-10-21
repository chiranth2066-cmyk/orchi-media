const root = document.documentElement;
const cursor = document.querySelector(".cursor");
const cursorLabel = cursor?.querySelector("span");
const hero = document.querySelector(".hero-stage");
const book = document.querySelector(".campaign-book");
const bookButtons = [...document.querySelectorAll(".work-list button")];
const workDesc = document.querySelector(".work-desc");
const marqueeTrack = document.querySelector(".marquee-track");
const magnetics = [...document.querySelectorAll(".magnetic")];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let pointer = { x: innerWidth / 2, y: innerHeight / 2 };
let smooth = { x: pointer.x, y: pointer.y };
let ticking = false;
let bookDragDelta = 0;
let lastScrollY = scrollY;
let scrollVelocity = 0;
let marqueeOffset = 0;
let lastFrameTime = performance.now();

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const lerp = (a, b, n) => a + (b - a) * n;

function setPointer(event) {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  if (hero) {
    const rect = hero.getBoundingClientRect();
    const insideHero =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (rect.top <= innerHeight && rect.bottom >= 0 && insideHero) {
      root.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      root.style.setProperty("--my", `${event.clientY - rect.top}px`);
      root.style.setProperty("--hero-mask", `${clamp(innerWidth * 0.13, 118, 230)}px`);
    }
  }
}

function setupHeroReveal() {
  if (!hero || matchMedia("(pointer: coarse)").matches) return;
  hero.addEventListener("pointerenter", () => {
    hero.classList.add("is-revealing");
  });
  hero.addEventListener("pointerleave", () => {
    hero.classList.remove("is-revealing");
    root.style.setProperty("--hero-mask", "0px");
  });
}

/* Character-split stagger reveals: [data-split] headlines break into
   chars that rise in sequence when the reveal fires. */
function setupCharSplits() {
  document.querySelectorAll("[data-split]").forEach((el) => {
    let charIndex = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const text = child.textContent;
          if (!text) return;
          const frag = document.createDocumentFragment();
          const words = text.split(" ");
          words.forEach((word, wIdx) => {
            if (word.length > 0) {
              const wordSpan = document.createElement("span");
              wordSpan.className = "word";
              wordSpan.style.display = "inline-block";
              wordSpan.style.whiteSpace = "nowrap";
              for (const ch of word) {
                const span = document.createElement("span");
                span.className = "char";
                span.textContent = ch;
                span.style.transitionDelay = `${(charIndex * 22).toFixed(0)}ms`;
                wordSpan.appendChild(span);
                charIndex++;
              }
              frag.appendChild(wordSpan);
            }
            if (wIdx < words.length - 1) {
              frag.appendChild(document.createTextNode(" "));
              charIndex++;
            }
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== "BR") {
          walk(child);
        }
      });
    };
    walk(el);
  });
}

function updateScrollState() {
  const maxScroll = document.documentElement.scrollHeight - innerHeight;
  root.style.setProperty("--progress", `${maxScroll > 0 ? (scrollY / maxScroll) * 100 : 0}%`);

  scrollVelocity = lerp(scrollVelocity, scrollY - lastScrollY, 0.2);
  lastScrollY = scrollY;

  document.querySelectorAll(".scene").forEach((scene) => {
    const rect = scene.getBoundingClientRect();
    const progress = clamp((innerHeight - rect.top) / (innerHeight + rect.height), 0, 1);
    scene.style.setProperty("--scene-progress", progress.toFixed(3));
  });
  ticking = false;
}

function requestScrollUpdate() {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(updateScrollState);
  }
}

function animate(now) {
  const dt = Math.min(64, now - lastFrameTime) / 16.67;
  lastFrameTime = now;

  smooth.x = lerp(smooth.x, pointer.x, 0.12);
  smooth.y = lerp(smooth.y, pointer.y, 0.12);
  if (cursor) {
    cursor.style.transform = `translate3d(${smooth.x}px, ${smooth.y}px, 0) translate(-50%, -50%)`;
  }

  /* Scroll-velocity marquee: base drift + speed follows scroll velocity. */
  if (marqueeTrack && !reducedMotion) {
    const speed = 0.9 + clamp(Math.abs(scrollVelocity) * 0.09, 0, 7);
    marqueeOffset -= speed * dt;
    const half = marqueeTrack.scrollWidth / 2;
    if (-marqueeOffset >= half) marqueeOffset += half;
    marqueeTrack.style.transform = `translate3d(${marqueeOffset.toFixed(1)}px, 0, 0)`;
    marqueeTrack.style.animation = "none";
  }

  if (!reducedMotion) {
    document.querySelectorAll("[data-parallax]").forEach((wrap) => {
      const rect = wrap.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > innerHeight) return;
      const localX = (smooth.x - innerWidth / 2) / (innerWidth / 2);
      const localY = (smooth.y - innerHeight / 2) / (innerHeight / 2);
      wrap.querySelectorAll("[data-depth]").forEach((layer) => {
        const depth = Number(layer.dataset.depth || 1);
        layer.style.transform = `translate3d(${localX * depth}px, ${localY * depth}px, 0)`;
      });
    });
  }
  requestAnimationFrame(animate);
}

function setupCursor() {
  if (!cursor || matchMedia("(pointer: coarse)").matches) return;
  document.querySelectorAll("a, button, [data-cursor]").forEach((item) => {
    item.addEventListener("mouseenter", () => {
      cursor.classList.add("is-active");
      if (cursorLabel) cursorLabel.textContent = item.dataset.cursor || "VIEW";
    });
    item.addEventListener("mouseleave", () => {
      cursor.classList.remove("is-active");
      if (cursorLabel) cursorLabel.textContent = "";
    });
  });
}

/* Magnetic buttons: gentle pull toward the pointer, spring back on leave. */
function setupMagnetic() {
  if (!magnetics.length || reducedMotion || matchMedia("(pointer: coarse)").matches) return;
  magnetics.forEach((el) => {
    let raf = 0;
    el.addEventListener("pointermove", (event) => {
      const rect = el.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `translate3d(${(dx * 0.18).toFixed(1)}px, ${(dy * 0.22).toFixed(1)}px, 0)`;
      });
    });
    el.addEventListener("pointerleave", () => {
      cancelAnimationFrame(raf);
      el.style.transition = "transform 500ms cubic-bezier(.16,1,.3,1)";
      el.style.transform = "translate3d(0, 0, 0)";
      setTimeout(() => {
        el.style.transition = "";
      }, 520);
    });
  });
}

function setupBook() {
  if (!book) return;
  let dragging = false;
  let startX = 0;

  const images = [
    ["assets/generated/work-spread-left.jpg", "assets/generated/work-spread-right.jpg"],
    ["assets/generated/campaign-car.jpg", "assets/generated/craft-bts.jpg"],
    ["assets/generated/panel-content.jpg", "assets/generated/panel-digital.jpg"],
    ["assets/generated/studio-set.jpg", "assets/generated/studio-edit.jpg"],
    ["assets/generated/panel-growth.jpg", "assets/generated/manifesto-portrait.jpg"],
  ];

  const left = book.querySelector(".page-left img");
  const right = book.querySelector(".page-right img");

  book.addEventListener("pointermove", (event) => {
    const rect = book.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    book.style.setProperty("--book-ry", `${-13 + x * 9}deg`);
    book.style.setProperty("--book-rx", `${4 - y * 5}deg`);
    if (dragging) {
      bookDragDelta = event.clientX - startX;
      book.style.setProperty("--page-peek", `${clamp(Math.abs(bookDragDelta) / rect.width, 0, 0.65)}`);
    }
  });

  book.addEventListener("pointerdown", (event) => {
    dragging = true;
    bookDragDelta = 0;
    startX = event.clientX;
    book.classList.add("is-dragging");
    book.setPointerCapture(event.pointerId);
  });

  book.addEventListener("pointerup", (event) => {
    if (!dragging) return;
    dragging = false;
    book.classList.remove("is-dragging");
    book.style.setProperty("--page-peek", "0");
    if (Math.abs(event.clientX - startX) < 10 || Math.abs(bookDragDelta) > 60) {
      book.classList.toggle("is-open");
    }
  });

  const setActive = (button, index) => {
    bookButtons.forEach((other) => other.classList.remove("is-active"));
    button.classList.add("is-active");
    const pair = images[index % images.length];
    if (left && right && pair) {
      left.src = pair[0];
      right.src = pair[1];
    }
    if (workDesc && button.dataset.desc) {
      workDesc.style.opacity = "0";
      setTimeout(() => {
        workDesc.textContent = button.dataset.desc;
        workDesc.style.opacity = "1";
      }, 200);
    }
    book.classList.add("is-open");
    snapWorkLens(button, true);
  };

  const workList = document.querySelector(".work-list");
  const workLens = document.getElementById("workLens");

  function snapWorkLens(button, animate = true) {
    if (!workLens || !button || !workList) return;
    const listRect = workList.getBoundingClientRect();
    const btnRect = button.getBoundingClientRect();
    const top = btnRect.top - listRect.top;
    const height = btnRect.height;
    workList.classList.add("has-lens");

    if (animate && window.gsap && !reducedMotion) {
      gsap.to(workLens, {
        top: top,
        height: height,
        duration: 0.45,
        ease: "power3.out",
        overwrite: "auto",
      });
    } else {
      workLens.style.top = `${top}px`;
      workLens.style.height = `${height}px`;
    }
  }

  bookButtons.forEach((button, index) => {
    button.addEventListener("mouseenter", () => setActive(button, index));
    button.addEventListener("focus", () => setActive(button, index));
  });
  if (bookButtons[0]) {
    setActive(bookButtons[0], 0);
    requestAnimationFrame(() => snapWorkLens(bookButtons[0], false));
  }
  window.addEventListener(
    "resize",
    () => {
      const active =
        document.querySelector(".work-list button.is-active") || bookButtons[0];
      if (active) snapWorkLens(active, false);
    },
    { passive: true }
  );
}

/* ============ INTERACTIVE NAV INDICATOR ============ */
function setupNavIndicator() {
  const nav = document.querySelector(".liquid-glass-nav");
  const pill = document.querySelector(".nav-indicator-pill");
  const links = document.querySelectorAll(".main-nav a");
  if (!nav || !pill || !links.length) return;

  const movePill = (link) => {
    const navRect = nav.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    const left = linkRect.left - navRect.left;
    const width = linkRect.width;
    pill.style.left = `${left}px`;
    pill.style.width = `${width}px`;
    nav.classList.add("has-pill");
  };

  links.forEach((link) => {
    link.addEventListener("mouseenter", () => movePill(link));
    link.addEventListener("focus", () => movePill(link));
  });

  nav.addEventListener("mouseleave", () => {
    nav.classList.remove("has-pill");
  });
}

/* ============ LIQUID GLASS (LiquidGL v3.0.0 Architecture) ============ */
function setupLiquidGlass() {
  if (window.LiquidGlassSystem && typeof window.LiquidGlassSystem.init === "function") {
    window.LiquidGlassSystem.init();
  } else if (typeof window.liquidGL === "function") {
    console.warn("LiquidGlassSystem adapter not found; falling back to direct liquidGL call.");
  } else {
    console.warn("liquidGL v3.0.0 library not loaded; falling back to CSS.");
  }
}

/* ============ GSAP 3D SPATIAL MOTION & PARALLAX ============ */
function setupGsapMotion() {
  if (typeof gsap === "undefined" || reducedMotion) return;

  if (typeof ScrollTrigger !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
  }

  // 1. Cinematic Hero Entrance Sequence
  const introTl = gsap.timeline({ defaults: { ease: "power3.out" } });

  introTl
    .fromTo(
      ".site-header",
      { y: -30, opacity: 0 },
      { y: 0, opacity: 1, duration: 1.1, delay: 0.1 }
    )
    .fromTo(
      ".hero-copy > p",
      { y: 46, opacity: 0, rotateX: 6 },
      { y: 0, opacity: 1, rotateX: 0, duration: 1.25 },
      "-=0.75"
    )
    .fromTo(
      ".hero-craft p",
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.75, stagger: 0.08 },
      "-=0.9"
    );

  // 2. Scroll-triggered Spatial Parallax
  if (typeof ScrollTrigger !== "undefined") {
    // Parallax depth on service visuals
    document.querySelectorAll(".service").forEach((service) => {
      const visual = service.querySelector(".service-visual img");
      if (visual) {
        gsap.fromTo(
          visual,
          { yPercent: -7, scale: 1.1 },
          {
            yPercent: 7,
            scale: 1.02,
            ease: "none",
            scrollTrigger: {
              trigger: service,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          }
        );
      }
    });

    // Method items staggered spatial lift
    const methodItems = document.querySelectorAll(".method-strip li");
    if (methodItems.length) {
      gsap.fromTo(
        methodItems,
        { opacity: 0, y: 32, rotateX: 8 },
        {
          opacity: 1,
          y: 0,
          rotateX: 0,
          duration: 0.8,
          stagger: 0.12,
          ease: "power2.out",
          scrollTrigger: {
            trigger: ".method-strip",
            start: "top 82%",
            toggleActions: "play none none none",
          },
        }
      );
    }

    // CTA background cinematic zoom-out
    const ctaBg = document.querySelector(".cta-bg");
    if (ctaBg) {
      gsap.fromTo(
        ctaBg,
        { scale: 1.16, yPercent: -4 },
        {
          scale: 1.0,
          yPercent: 4,
          ease: "none",
          scrollTrigger: {
            trigger: ".cta",
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        }
      );
    }
  }
}

function setupReveals() {
  const els = [...document.querySelectorAll(".reveal, .reveal-img")];
  if (!els.length) return;
  if (reducedMotion) {
    els.forEach((el) => el.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );
  els.forEach((el) => io.observe(el));
}

function setupSmoothAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const id = link.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    });
  });
}

addEventListener("pointermove", setPointer, { passive: true });
addEventListener("scroll", requestScrollUpdate, { passive: true });
addEventListener("resize", requestScrollUpdate);

setupCharSplits();
setupCursor();
setupHeroReveal();
setupBook();
setupMagnetic();
setupReveals();
setupSmoothAnchors();
setupNavIndicator();
setupLiquidGlass();
setupGsapMotion();
updateScrollState();
requestAnimationFrame(animate);
