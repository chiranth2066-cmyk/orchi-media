const root = document.documentElement;
const cursor = document.querySelector(".cursor");
const cursorLabel = cursor?.querySelector("span");
const hero = document.querySelector(".hero-stage");
const magnetics = [...document.querySelectorAll(".magnetic")];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let pointer = { x: innerWidth / 2, y: innerHeight / 2 };
let smooth = { x: pointer.x, y: pointer.y };
let ticking = false;
let lastScrollY = scrollY;
let scrollVelocity = 0;
let lastFrameTime = performance.now();

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const lerp = (a, b, n) => a + (b - a) * n;

/* ============ HERO REVEAL & MOUSE PHYSICS (STRICTLY PROTECTED) ============ */
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

/* Character-split stagger reveals */
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
                span.style.transitionDelay = `${(charIndex * 18).toFixed(0)}ms`;
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

/* ============ MOBILE NAVIGATION DRAWER ============ */
function setupMobileDrawer() {
  const menuBtn = document.querySelector(".menu-line");
  const drawer = document.getElementById("mobileDrawer");
  const closeBtn = drawer?.querySelector(".drawer-close");
  const backdrop = drawer?.querySelector(".drawer-backdrop");
  const links = drawer?.querySelectorAll(".drawer-link");

  if (!menuBtn || !drawer) return;

  const openDrawer = () => {
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    menuBtn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  };

  const closeDrawer = () => {
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    menuBtn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  };

  menuBtn.addEventListener("click", openDrawer);
  closeBtn?.addEventListener("click", closeDrawer);
  backdrop?.addEventListener("click", closeDrawer);

  links?.forEach((link) => {
    link.addEventListener("click", () => {
      closeDrawer();
    });
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer.classList.contains("is-open")) {
      closeDrawer();
    }
  });
}

/* ============ BENGALURU LIVE CLOCK (IST) ============ */
function setupBengaluruClock() {
  const footerClock = document.getElementById("footerClock");
  const drawerClock = document.querySelector(".drawer-clock");

  const update = () => {
    const now = new Date();
    // Format to Indian Standard Time (UTC+5:30)
    const options = {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    };
    const timeStr = new Intl.DateTimeFormat("en-US", options).format(now);
    if (footerClock) footerClock.textContent = timeStr;
    if (drawerClock) drawerClock.textContent = timeStr.replace(/:\d\d\s/, " ");
  };

  update();
  setInterval(update, 1000);
}

/* ============ CINEMATIC VIDEO CONTROLS ============ */
function setupCinemaVideo() {
  const video = document.getElementById("mainReelVideo");
  const playBtn = document.getElementById("videoPlayToggle");
  const muteBtn = document.getElementById("videoMuteToggle");
  const timeDisplay = document.getElementById("videoCurrentTime");
  const durationDisplay = document.getElementById("videoDuration");
  const fsBtn = document.getElementById("videoFullscreenToggle");

  if (!video) return;

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Play / Pause
  if (playBtn) {
    const iconPlay = playBtn.querySelector(".icon-play");
    const iconPause = playBtn.querySelector(".icon-pause");

    playBtn.addEventListener("click", () => {
      if (video.paused) {
        video.play();
        if (iconPlay) iconPlay.style.display = "none";
        if (iconPause) iconPause.style.display = "block";
      } else {
        video.pause();
        if (iconPlay) iconPlay.style.display = "block";
        if (iconPause) iconPause.style.display = "none";
      }
    });
  }

  // Mute / Unmute
  if (muteBtn) {
    const iconMuted = muteBtn.querySelector(".icon-muted");
    const iconUnmuted = muteBtn.querySelector(".icon-unmuted");
    const label = muteBtn.querySelector(".audio-label");

    muteBtn.addEventListener("click", () => {
      video.muted = !video.muted;
      if (video.muted) {
        if (iconMuted) iconMuted.style.display = "block";
        if (iconUnmuted) iconUnmuted.style.display = "none";
        if (label) label.textContent = "Sound Off";
      } else {
        if (iconMuted) iconMuted.style.display = "none";
        if (iconUnmuted) iconUnmuted.style.display = "block";
        if (label) label.textContent = "Sound On";
      }
    });
  }

  // Timecode Update
  video.addEventListener("timeupdate", () => {
    if (timeDisplay && !isNaN(video.currentTime)) {
      timeDisplay.textContent = formatTime(video.currentTime);
    }
  });

  video.addEventListener("loadedmetadata", () => {
    if (durationDisplay && !isNaN(video.duration)) {
      durationDisplay.textContent = formatTime(video.duration);
    }
  });

  // Fullscreen
  if (fsBtn) {
    fsBtn.addEventListener("click", () => {
      const container = video.closest(".cinema-frame") || video;
      if (!document.fullscreenElement) {
        container.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    });
  }
}

/* ============ SERVICES EDITORIAL CATALOG ============ */
function setupServicesCatalog() {
  const navBtns = document.querySelectorAll(".service-nav-btn");
  const serviceItems = document.querySelectorAll(".service-list .service");

  if (!navBtns.length || !serviceItems.length) return;

  navBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = btn.dataset.service;
      navBtns.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      serviceItems.forEach((item) => {
        if (item.dataset.serviceIdx === idx) {
          item.classList.add("is-active");
        } else {
          item.classList.remove("is-active");
        }
      });
    });
  });
}

/* ============ ARCHIVE FILTERS & HOVER PREVIEW ============ */
function setupArchive() {
  const filterPills = document.querySelectorAll(".filter-pill");
  const entries = document.querySelectorAll(".archive-entry");
  const hoverCard = document.getElementById("archiveHoverCard");
  const previewImg = document.getElementById("archivePreviewImg");

  // Filtering
  filterPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      filterPills.forEach((p) => p.classList.remove("is-active"));
      pill.classList.add("is-active");

      const filter = pill.dataset.filter;
      entries.forEach((entry) => {
        if (filter === "all" || entry.dataset.category === filter) {
          entry.classList.remove("is-hidden");
        } else {
          entry.classList.add("is-hidden");
        }
      });
    });
  });

  // Floating cursor hover preview
  if (hoverCard && previewImg && !matchMedia("(pointer: coarse)").matches) {
    entries.forEach((entry) => {
      entry.addEventListener("mouseenter", () => {
        const imgSrc = entry.dataset.img;
        if (imgSrc) {
          previewImg.src = imgSrc;
          hoverCard.classList.add("is-visible");
        }
      });

      entry.addEventListener("mousemove", (e) => {
        hoverCard.style.left = `${e.clientX + 16}px`;
        hoverCard.style.top = `${e.clientY + 16}px`;
      });

      entry.addEventListener("mouseleave", () => {
        hoverCard.classList.remove("is-visible");
      });
    });
  }
}

/* ============ COPY EMAIL TO CLIPBOARD ============ */
function setupCopyEmail() {
  const btn = document.querySelector(".copy-email-btn");
  const toast = btn?.querySelector(".copy-toast");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const email = "hello@orchi.media";
    navigator.clipboard?.writeText(email).then(() => {
      toast?.classList.add("is-shown");
      setTimeout(() => {
        toast?.classList.remove("is-shown");
      }, 2200);
    }).catch(() => {
      window.location.href = `mailto:${email}`;
    });
  });
}

/* ============ EDITORIAL ARTICLE DATA & READER MODAL ============ */
const ARTICLES_DATABASE = {
  "art-01": {
    id: "art-01",
    category: "Cinematic Direction",
    time: "6 min read",
    title: "The Death of Generic Aesthetics: Why Brands Need Friction in the Age of Homogenized Feeds",
    lead: "When every algorithm optimizes for the median, distinctiveness becomes the only asymmetric advantage.",
    img: "assets/generated/manifesto-portrait.jpg",
    body: [
      "In contemporary commercial design, smoothness has become an epidemic. Tools powered by average consensus produce predictable, rounded, safe visual interfaces. The result is total aesthetic compression: luxury brands, tech startups, and independent studios begin to sound, look, and behave identically.",
      "At Orchi Media, our fundamental thesis is that desire is born from tension. Without friction—without grain, intentional shadow, asymmetric balance, and uncompromised point of view—a brand cannot create cognitive memory.",
      "Cinematic craft is not merely about shooting on high-end cinema sensors or grading with analog film grain. It is a philosophy of respect for human attention. It insists on taking the time to build an atmosphere so rich and uncompromising that the viewer stops scrolling not because of a desperate visual hook, but because they have entered a world they refuse to leave."
    ]
  },
  "art-02": {
    id: "art-02",
    category: "Brand Strategy",
    time: "4 min read",
    title: "Positioning Before Pixels: The Mechanics of Cultural Authority",
    lead: "A visual identity without a strategic point of view is just expensive styling.",
    img: "assets/generated/panel-brand.jpg",
    body: [
      "Before an art director places a single pixel or a cinematographer selects an anamorphic lens, the fundamental commercial battle has already been decided: What does your brand believe that its category denies?",
      "Most modern marketing campaigns fail not because of flawed media buying, but because of conceptual anemia. When a brand lacks a sharp cultural position, all downstream creative work is diluted into generic marketing fluff.",
      "We begin every engagement by locating the structural tension in the client's industry. By giving that tension a name, an aesthetic vocabulary, and an uncompromising tone of voice, we transform client companies from vendors into category authorities."
    ]
  },
  "art-03": {
    id: "art-03",
    category: "Production & Metrics",
    time: "5 min read",
    title: "The High-Fidelity Funnel: Merging Cinema Craft with Paid Acquisition",
    lead: "Why cinema-grade creative assets consistently outperform low-effort UGC in scaling customer lifetime value.",
    img: "assets/generated/craft-bts.jpg",
    body: [
      "For years, direct response marketers claimed that 'ugly ads convert better.' In commoditized drop-shipping niches, this held true for short-term arbitrage. But for premium brands seeking sustainable pricing power, low-fidelity creative destroys brand equity.",
      "By engineering cinema-grade creative assets specifically around performance hooks, we prove that high-craft aesthetics and aggressive conversion rates are mutually reinforcing.",
      "Our dual pipeline crafts high-retention video worlds that capture cold audiences on Meta and YouTube while simultaneously educating prospects on product value, dropping CAC while compounding long-term organic search demand."
    ]
  },
  "art-04": {
    id: "art-04",
    category: "Strategy",
    time: "4 min read",
    title: "Sensory Brand Codes: Establishing Visual Recall in Sub-Second Attention Spans",
    lead: "Deconstructing how color contrast and typographic tension create subconscious recognition.",
    img: "assets/generated/detail-eye.jpg",
    body: [
      "Human cognition recognizes silhouette and chromatic contrast long before the cortex parses written language. In sub-second mobile feeds, subtle sensory signatures determine whether an ad is swiped away or internalized.",
      "We build proprietary sensory design codes for our studio partners: signature shadow treatments, distinct sound cues, and deliberate negative space that signal brand presence without requiring a giant logo watermark."
    ]
  },
  "art-05": {
    id: "art-05",
    category: "Production",
    time: "7 min read",
    title: "Color Grading as Emotional Architecture: Behind the DaVinci Studio Pipeline",
    lead: "Film emulation, highlight roll-offs, and spectral halation techniques that communicate luxury perception.",
    img: "assets/generated/studio-set.jpg",
    body: [
      "Digital cameras capture raw sensor data with clinical precision. But human emotion responds to optical memory—the gentle saturation roll-off of Kodak vision film, the warm halation around practical tungsten bulbs, and deep ink blacks.",
      "Our post-production pipeline preserves analog imperfections within ultra-high-definition deliverable standards, giving every campaign the timeless weight of 35mm film."
    ]
  },
  "art-06": {
    id: "art-06",
    category: "Growth & CRO",
    time: "5 min read",
    title: "Funnels with Soul: Converting Paid Traffic Without Degrading Premium Brand Equity",
    lead: "Bridging the divide between high-craft editorial perception and conversion rate optimisation.",
    img: "assets/generated/campaign-car.jpg",
    body: [
      "Conversion Rate Optimization (CRO) often devolves into aggressive countdown timers and flashing discount banners that erode consumer trust. We build conversion journeys that respect the intelligence of modern buyers.",
      "By removing cognitive friction, refining typography, and presenting transparent, compelling value narratives, our funnels achieve industry-leading conversion velocity without sacrificing premium brand positioning."
    ]
  },
  "art-07": {
    id: "art-07",
    category: "Culture",
    time: "4 min read",
    title: "The Always-On Engine: Sustainable Social Content Systems for Fast-Moving Brands",
    lead: "Why reactive trend-chasing burns creative capital. Building serialized content formats.",
    img: "assets/generated/studio-edit.jpg",
    body: [
      "The fastest way to burn out a creative team and confuse an audience is to chase daily social media audio trends. Brands that endure build serialized content formats—predictable, high-craft editorial shows that audiences actively anticipate.",
      "We design production systems that generate 30 days of cinematic short-form assets from a single studio shoot day, creating compounding organic distribution at predictable operating costs."
    ]
  },
  "art-08": {
    id: "art-08",
    category: "Strategy",
    time: "6 min read",
    title: "The Mechanics of Cultural Authority: From Niche Credibility to Category Dominance",
    lead: "How visionary founders leverage tension and editorial precision to transcend commoditized price competition.",
    img: "assets/generated/perspective-brutal.jpg",
    body: [
      "Every iconic brand began by fiercely serving a narrow, obsessive subculture before scaling to mass market authority.",
      "Through uncompromising visual storytelling and rigorous positioning, we help ambitious companies translate niche credibility into widespread cultural dominance."
    ]
  },
  "case-kaizen": {
    id: "case-kaizen",
    category: "Verified Client Proof // Direct-to-Consumer",
    time: "4 min case read",
    title: "Kaizen Luxury Apparel: Rebuilding the DTC Growth Engine (+340% ROAS / -42% CAC)",
    lead: "\"Orchi rebuilt our creative engine from scratch. In 90 days, acquisition costs dropped 42% while scaling monthly revenue 3.4x.\" — Devon Vance, Founder & CEO",
    img: "assets/testimonials/testimonial-kaizen.jpg",
    body: [
      "Kaizen faced an existential luxury apparel challenge: their unit economics were being compressed by rising ad network CPMs and generic creative exhaustion across paid channels.",
      "Orchi deployed a full-stack brand overhaul: replacing flat product carousels with 35mm film-emulated short-form narrative commercials, tension-driven lifestyle lookbooks, and high-converting obsidian glass landing flows.",
      "The result was immediate: customer acquisition costs dropped by 42% within the first 60 days, while scaling overall brand revenue by 3.4x at a sustained 340% ROAS. Kaizen solidified its market moat without taking outside venture dilution."
    ]
  },
  "case-nexus": {
    id: "case-nexus",
    category: "Verified Client Proof // Autonomous Systems",
    time: "5 min case read",
    title: "Nexus Systems: The $24M Series B Cinema Launch That Redefined Hardware",
    lead: "\"Their cinematic production does not look like tech marketing—it looks like cinema. Series B lead investors cited our launch film directly.\" — Elena Rostova, VP Brand",
    img: "assets/testimonials/testimonial-nexus.jpg",
    body: [
      "Hardware and robotics companies routinely struggle with technical commoditization. Nexus had world-class autonomous robotics, but their external storytelling sounded like engineering documentation.",
      "Orchi was commissioned to architect their global Series B unveil. Rather than rendering dry CAD models, we directed a high-tension cinematic vision piece depicting the human impact of autonomous logistics.",
      "The film accumulated 2.8 million organic industry views, was cited by lead institutional investors during their $24M round, and established Nexus as the clear category benchmark in autonomous systems."
    ]
  },
  "case-aura": {
    id: "case-aura",
    category: "Verified Client Proof // Bio-Nutrition & DTC",
    time: "4 min case read",
    title: "Aura Bio Labs: The Liquid Aesthetic That Dominated High-Ticket DTC (6.8X ROAS)",
    lead: "\"The liquid aesthetic and ruthless conversion focus gave our brand an unfair monopoly in a saturated global market.\" — Marcus Thorne, Co-Founder & CEO",
    img: "assets/testimonials/testimonial-aura.jpg",
    body: [
      "In the crowded wellness and bio-nutrition space, every competitor looked identical: pastel gradients and cheerful stock photography. Aura wanted an unmistakable, premium, liquid-cyber identity.",
      "We engineered an obsidian-and-liquid glass sensory design system, paired with algorithmic video ads that explained the cellular biochemistry through hypnotic macro visuals.",
      "Within six months, Aura scaled past 140,000 active recurring subscribers, maintained a 6.8x blended ROAS, and captured an unshakeable premium pricing power."
    ]
  },
  "case-lumina": {
    id: "case-lumina",
    category: "Verified Client Proof // Virtual Production",
    time: "4 min case read",
    title: "Lumina XR Studios: Generating 18 Million Views with Uncompromising Editorial Authority",
    lead: "\"Working with Orchi felt like hiring a tier-one secret weapon. Every single frame delivered possessed unmistakable editorial authority.\" — Sophia Chen, Head of Creative",
    img: "assets/testimonials/testimonial-lumina.jpg",
    body: [
      "Lumina needed to attract Hollywood studio directors and top-tier commercial agencies to their real-time virtual production stages in London and Tokyo.",
      "Orchi produced a serialized video showcase demonstrating real-time camera tracking and LED volume environments with the production quality of an Oscar-nominated feature.",
      "The campaign drove 18 million verified impressions across director and cinematographer networks, generating a 5.2x surge in qualified studio bookings."
    ]
  },
  "case-solaris": {
    id: "case-solaris",
    category: "Verified Client Proof // Electric Mobility",
    time: "4 min case read",
    title: "Solaris Mobility: Manufacturing Mythology to Outperform Paid Targets Organically",
    lead: "\"They do not just produce content; they orchestrate culture. Our organic viral reach exceeded our entire annual paid allocation.\" — Arjun Mehta, Managing Director",
    img: "assets/testimonials/testimonial-solaris.jpg",
    body: [
      "Launching a next-generation electric hyper-vehicle requires commanding cultural attention, not just buying ad impressions.",
      "Orchi engineered an episodic guerrilla video launch: dawn cinematography through empty brutalist architecture, visceral sound design, and mysterious narrative teasers across TikTok and Instagram.",
      "The campaign trended #1 organically, generated 14 million viral views, and fully reserved their entire inaugural production run in under 48 hours."
    ]
  },
  "case-hyperion": {
    id: "case-hyperion",
    category: "Verified Client Proof // Spatial Acoustics",
    time: "4 min case read",
    title: "Hyperion Audio: Sonic Architecture & The Global Sell-Out Campaign",
    lead: "\"Pure precision. From brand positioning to algorithmic distribution, Orchi operates at the absolute apex of creative performance.\" — Chloe Dupont, Global Creative Director",
    img: "assets/testimonials/testimonial-hyperion.jpg",
    body: [
      "Hyperion engineered revolutionary spatial sound monitors for acoustic purists, but needed a brand presence that matched the astronomical price tag.",
      "We created an audio-visual identity centered around kinetic typography, cymatic fluid simulations, and high-fidelity video interviews with Grammy-winning sound designers.",
      "Audience retention spiked by +210% over industry averages, leading to an immediate inventory sell-out worldwide."
    ]
  },
  "case-vanguard": {
    id: "case-vanguard",
    category: "Verified Client Proof // Spatial Architecture",
    time: "5 min case read",
    title: "Vanguard Atelier: Booking a $48M High-Net-Worth Spatial Pipeline",
    lead: "\"In an industry choked with templated noise, Orchi crafted an immortal visual identity that booked our pipeline solid for 24 months.\" — Liam Vance, Principal Partner",
    img: "assets/testimonials/testimonial-vanguard.jpg",
    body: [
      "Ultra-high-end architecture clients do not respond to generic marketing brochures. Vanguard needed an aura of indisputable architectural mastery.",
      "Orchi designed an editorial monograph and cinematic architectural documentary exploring Vanguard's brutalist concrete and glass masterpieces.",
      "The resulting campaign secured over $48M in private residence and cultural institution commissions, locking their studio pipeline solid for two years."
    ]
  },
  "case-chronos": {
    id: "case-chronos",
    category: "Verified Client Proof // Haute Horlogerie",
    time: "4 min case read",
    title: "Chronos Geneva: Stopping Ultra-High-Net-Worth Buyers Dead in Their Tracks",
    lead: "\"The sensory impact of their visual storytelling stopped ultra-high-net-worth buyers in their tracks. Conversion rates doubled immediately.\" — Vivienne Laurent, Brand Director",
    img: "assets/testimonials/testimonial-chronos.jpg",
    body: [
      "Independent Swiss luxury horlogerie lives or dies by connoisseur appreciation. Chronos wanted to translate century-old watchmaking heritage into modern digital velocity.",
      "Orchi deployed extreme macro probe cinematography, highlighting the hand-chamfered bridges, tourbillon escapements, and grand feu enamel dials.",
      "Online inquiries from verified private collectors doubled, DTC sales rose 195%, and their limited edition allocation achieved an 88% sell-through within one week."
    ]
  },
  "founder-mahadev": {
    id: "founder-mahadev",
    category: "Founding Leadership // Executive Vision",
    time: "3 min manifesto",
    title: "Mahadev Prasad — Founder & CEO: The Orchi Media Manifesto",
    lead: "“We did not build Orchi to be another comfortable agency. We built it for brands that refuse to blend in—merging raw cinematic culture with ruthless commercial growth.”",
    img: "assets/founders/founder-mahadev.jpg",
    body: [
      "When we founded Orchi Media in Bengaluru, our vision was simple yet uncompromising: eliminate the artificial divide between high-art aesthetic cinema and aggressive performance marketing.",
      "Most agencies either create pretty visual reels that fail to drive commercial revenue, or run low-effort direct response ads that degrade the brand's long-term enterprise valuation. At Orchi, we reject that false tradeoff.",
      "Our partners don't come to us for polite advice. They partner with us to engineer an asymmetric cultural advantage—creating campaigns with cinematic depth that seize human attention and drive transformative market valuation."
    ]
  },
  "founder-harsha": {
    id: "founder-harsha",
    category: "Founding Leadership // Operational Architecture",
    time: "3 min framework",
    title: "Harsha — Co-Founder & COO: Operational Rigor & The Engine of Scale",
    lead: "“Creative ambition without relentless operational momentum is just wishful thinking. We engineer scalable systems that deliver flawless execution every single time.”",
    img: "assets/founders/founder-harsha.jpg",
    body: [
      "Creative brilliance is only half the equation. The greatest film concept or brand narrative is meaningless if delivery timelines slip, media pipelines lag, or post-production execution falters.",
      "As Chief Operating Officer, my mandate is operational perfection: building institutional workflows across production sets, color grading bays, client dashboards, and distribution pipelines.",
      "We run Orchi like a high-precision technology company. Every sprint, deliverable, and campaign asset is orchestrated to move brands forward with zero friction and maximum momentum."
    ]
  },
  "founder-chiranth": {
    id: "founder-chiranth",
    category: "Founding Leadership // Creative Technology",
    time: "3 min engineering",
    title: "Chiranth — Co-Founder & CTO: Code as Creative Leverage",
    lead: "“Technology and art are not opposites; code is the highest form of creative leverage. From liquid WebGL shaders to algorithmic distribution, we build the unfair advantage.”",
    img: "assets/founders/founder-chiranth.jpg",
    body: [
      "In the contemporary landscape, a creative studio must be a technological powerhouse. The digital surfaces where audiences interact with brands are powered by code, shaders, and real-time graphics engines.",
      "As Chief Technology Officer, I focus on pushing the boundaries of web experiences: custom WebGL shaders, fluid physics, micro-interactions, and conversion-optimized architectures.",
      "When state-of-the-art interactive technology meets raw cinematic narrative, the result is an experience audiences cannot ignore and competitors cannot replicate."
    ]
  }
};

function setupArticleModal() {
  const modal = document.getElementById("articleModal");
  const backdrop = document.getElementById("modalBackdrop");
  const closeBtn = document.getElementById("modalCloseBtn");
  const closeBottom = modal?.querySelector(".modal-close-bottom");
  const triggers = document.querySelectorAll(".read-trigger");

  const titleEl = document.getElementById("modalArticleTitle");
  const catEl = document.getElementById("modalArticleCategory");
  const timeEl = document.getElementById("modalArticleTime");
  const leadEl = document.getElementById("modalArticleLead");
  const imgEl = document.getElementById("modalArticleImg");
  const bodyEl = document.getElementById("modalArticleBody");

  if (!modal) return;

  const openArticle = (id) => {
    const data = ARTICLES_DATABASE[id] || ARTICLES_DATABASE["art-01"];
    if (titleEl) titleEl.textContent = data.title;
    if (catEl) catEl.textContent = data.category;
    if (timeEl) timeEl.textContent = data.time;
    if (leadEl) leadEl.textContent = data.lead;
    if (imgEl) {
      imgEl.src = data.img;
      imgEl.alt = data.title;
    }
    if (bodyEl) {
      bodyEl.innerHTML = data.body.map((p) => `<p>${p}</p>`).join("");
    }

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  };

  const closeModal = () => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };

  triggers.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const articleId = btn.dataset.article;
      if (articleId) openArticle(articleId);
    });
  });

  // Also support clicking on the whole archive-entry row
  document.querySelectorAll(".archive-entry").forEach((row) => {
    row.addEventListener("click", () => {
      const articleId = row.dataset.articleId;
      if (articleId) openArticle(articleId);
    });
  });

  // Delegated click listener for any modal triggers, including 3D Crest links
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-article], [data-article-id]");
    if (trigger && !trigger.closest(".modal-container")) {
      const articleId = trigger.dataset.articleId || trigger.dataset.article;
      if (articleId && ARTICLES_DATABASE[articleId]) {
        e.preventDefault();
        openArticle(articleId);
      }
    }
  });

  closeBtn?.addEventListener("click", closeModal);
  closeBottom?.addEventListener("click", closeModal);
  backdrop?.addEventListener("click", closeModal);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) {
      closeModal();
    }
  });
}

/* ============ LIQUID GLASS (LiquidGL v3.0.0 Architecture) ============ */
function setupLiquidGlass() {
  if (window.LiquidGlassSystem && typeof window.LiquidGlassSystem.init === "function") {
    window.LiquidGlassSystem.init();
  } else if (typeof window.liquidGL === "function") {
    console.warn("LiquidGlassSystem adapter not found; falling back to direct liquidGL call.");
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

  // 2. Parallax and scroll reveals on non-hero elements
  if (typeof ScrollTrigger !== "undefined") {
    document.querySelectorAll(".service").forEach((service) => {
      const visual = service.querySelector(".service-visual img");
      if (visual) {
        gsap.fromTo(
          visual,
          { yPercent: -5, scale: 1.08 },
          {
            yPercent: 5,
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

    const ctaBg = document.querySelector(".cta-bg");
    if (ctaBg) {
      gsap.fromTo(
        ctaBg,
        { scale: 1.15, yPercent: -4 },
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
    { threshold: 0.1, rootMargin: "0px 0px -6% 0px" }
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

/* ============ CREST DISTORTION WEBGL ENGINES ============ */
async function setupCrestEffects() {
  if (typeof window.Crest === "undefined") {
    console.warn("[Orchi] Crest engine not loaded");
    return;
  }

  // 1. Services Crest Distortion Showcase
  const servicesStage = document.getElementById("servicesCrest");
  if (servicesStage) {
    try {
      const servicesCrest = new window.Crest();
      await servicesCrest.mount(servicesStage, {
        placement: "fill",
        background: "#08090c",
        columns: 3,
        narrowColumns: 1,
        imageSize: 0.88,
        speed: 1.0,
        slant: 5,
        crestHeight: 0.35,
        crestWidth: 0.46,
        swell: 0.22,
        crestCurve: 0.45,
        light: 0.8,
        shadow: 0.45,
        radius: 0.02,
        startFill: 0.55,
        endFill: 0.15,
        smoothing: 0.5
      });
      console.log("[Orchi] servicesCrest mounted successfully");
    } catch (err) {
      console.warn("[Orchi] servicesCrest mount error:", err);
    }
  }

  // 2. Testimonials Crest Distortion Pinned Stream
  const testimonialsStage = document.getElementById("testimonialsCrest");
  if (testimonialsStage) {
    try {
      const testimonialsCrest = new window.Crest();
      await testimonialsCrest.mount(testimonialsStage, {
        placement: "pin",
        background: "#ede8e0",
        columns: 3,
        narrowColumns: 1,
        imageSize: 0.88,
        speed: 0.95,
        slant: 7,
        crestHeight: 0.48,
        crestWidth: 0.45,
        swell: 0.35,
        crestCurve: 0.45,
        light: 0.75,
        shadow: 0.8,
        radius: 0.02,
        startFill: 0.6,
        endFill: 0.12,
        smoothing: 0.5
      });
      console.log("[Orchi] testimonialsCrest mounted successfully");
    } catch (err) {
      console.warn("[Orchi] testimonialsCrest mount error:", err);
    }
  }
}

/* ============ INITIALIZE ============ */
addEventListener("pointermove", setPointer, { passive: true });
addEventListener("scroll", requestScrollUpdate, { passive: true });
addEventListener("resize", requestScrollUpdate);

setupCharSplits();
setupCursor();
setupHeroReveal();
setupMagnetic();
setupReveals();
setupSmoothAnchors();
setupNavIndicator();
setupMobileDrawer();
setupBengaluruClock();
setupCinemaVideo();
setupServicesCatalog();
setupArchive();
setupCopyEmail();
setupArticleModal();
setupLiquidGlass();
setupGsapMotion();
setupCrestEffects();
updateScrollState();
requestAnimationFrame(animate);
