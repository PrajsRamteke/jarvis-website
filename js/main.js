/* Jarvis website — interactions and scroll scenes.
   Everything is readable without JS; animations only add motion on top. */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  document.documentElement.classList.add("js");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  /* ------------------------------------------------------------------
     Smooth scrolling
     ------------------------------------------------------------------ */
  let lenis = null;
  if (!reduce && hasGsap && window.Lenis) {
    lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  /* ------------------------------------------------------------------
     Nav, mobile sheet, progress, anchors
     ------------------------------------------------------------------ */
  const nav = $("#nav");
  const sheet = $("#sheet");
  const toggle = $("#nav-toggle");
  const bar = $(".progress span");
  let lastY = window.scrollY;

  function setSheet(open) {
    sheet.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (open) nav.classList.remove("is-hidden");
  }
  toggle.addEventListener("click", () => setSheet(sheet.hidden));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !sheet.hidden) { setSheet(false); toggle.focus(); } });

  function onScroll() {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    nav.classList.toggle("is-solid", y > 24);
    if (sheet.hidden) nav.classList.toggle("is-hidden", y > lastY && y > 480);
    if (y < lastY - 4) nav.classList.remove("is-hidden");
    lastY = y;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (!id || id.length < 2) return;
      const el = $(id);
      if (!el) return;
      e.preventDefault();
      setSheet(false);
      if (lenis) lenis.scrollTo(el, { offset: id === "#top" ? 0 : -8, duration: 1.4 });
      else el.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
      history.replaceState(null, "", id);
    });
  });

  /* ------------------------------------------------------------------
     Toast + copy buttons
     ------------------------------------------------------------------ */
  const toast = $("#toast");
  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-on"), 1800);
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      ta.remove();
      return ok;
    }
  }
  $$(".copy").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ok = await copyText(btn.dataset.copy);
      if (!ok) { showToast("Couldn’t copy. Select the command and copy it by hand."); return; }
      btn.classList.add("is-done");
      btn.querySelector("use").setAttribute("href", "#i-check");
      showToast("Copied to clipboard");
      setTimeout(() => { btn.classList.remove("is-done"); btn.querySelector("use").setAttribute("href", "#i-copy"); }, 1600);
    });
  });

  /* ------------------------------------------------------------------
     Hero terminal — a scripted Jarvis session
     ------------------------------------------------------------------ */
  const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const heroScript = [
    { t: "user", text: "the checkout total is wrong when a cart has two of the same item" },
    { t: "recall", text: "pricing bugs: check quantity handling in cart.py first" },
    { t: "tool", name: "search_code", arg: '"def cart_total"', res: "1 match", ms: 700 },
    { t: "tool", name: "read_file", arg: "shop/cart.py", res: "48 lines", ms: 520 },
    { t: "tool", name: "edit_file", arg: "shop/cart.py", res: "+1 −1", ms: 760,
      diff: [["del", "41 -    total = sum(item.price for item in items)"], ["add", "41 +    total = sum(item.price * item.qty for item in items)"]] },
    { t: "tool", name: "run_bash", arg: "pytest tests/test_checkout.py -q", res: "12 passed", ok: true, ms: 1400 },
    { t: "reply", text: "Fixed. cart_total added each item’s price once and ignored quantity. It now multiplies by qty, and all 12 checkout tests pass." },
    { t: "saved", text: "✦ Saved a lesson for next time" },
  ];

  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function makeTerminal(log, script) {
    let visible = false;
    let started = false;
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0.15 });
    io.observe(log);
    const waitVisible = async () => { while (!visible || document.hidden) await sleep(250); };

    function renderStatic() {
      log.innerHTML = "";
      for (const s of script) {
        if (s.t === "user") log.appendChild(el("div", "t-user", `<span class="p">›</span>${esc(s.text)}`));
        if (s.t === "recall") log.appendChild(el("div", "t-recall", `✦ Recalled a lesson <span>${esc(s.text)}</span>`));
        if (s.t === "tool") {
          log.appendChild(el("div", "t-tool", `<span class="st ok">✓</span><span class="name">${s.name}</span><span class="arg">${esc(s.arg)}</span><span class="res${s.ok ? " ok" : ""}">${esc(s.res)}</span>`));
          if (s.diff) log.appendChild(el("div", "t-diff", s.diff.map(([k, l]) => `<div class="${k}">${esc(l)}</div>`).join("")));
        }
        if (s.t === "reply") log.appendChild(el("div", "t-reply", `<span class="who">Jarvis</span><p>${esc(s.text)}</p>`));
        if (s.t === "saved") log.appendChild(el("div", "t-saved", esc(s.text)));
      }
    }

    async function play() {
      for (;;) {
        log.innerHTML = "";
        log.style.opacity = "1";
        for (const s of script) {
          await waitVisible();
          if (s.t === "user") {
            const row = el("div", "t-user", `<span class="p">›</span><span class="txt"></span><span class="t-caret"></span>`);
            log.appendChild(row);
            const txt = row.querySelector(".txt");
            for (let i = 1; i <= s.text.length; i++) { txt.textContent = s.text.slice(0, i); await sleep(18 + Math.random() * 30); }
            await sleep(380);
            row.querySelector(".t-caret").remove();
            await sleep(260);
          } else if (s.t === "recall") {
            log.appendChild(el("div", "t-recall", `✦ Recalled a lesson <span>${esc(s.text)}</span>`));
            await sleep(560);
          } else if (s.t === "tool") {
            const row = el("div", "t-tool", `<span class="st">${SPIN[0]}</span><span class="name">${s.name}</span><span class="arg">${esc(s.arg)}</span><span class="res">running</span>`);
            log.appendChild(row);
            const st = row.querySelector(".st");
            let k = 0;
            const spin = setInterval(() => { st.textContent = SPIN[(k = (k + 1) % SPIN.length)]; }, 80);
            await sleep(s.ms);
            clearInterval(spin);
            st.textContent = "✓"; st.classList.add("ok");
            const res = row.querySelector(".res");
            res.textContent = s.res;
            if (s.ok) res.classList.add("ok");
            if (s.diff) log.appendChild(el("div", "t-diff", s.diff.map(([kk, l]) => `<div class="${kk}">${esc(l)}</div>`).join("")));
            await sleep(220);
          } else if (s.t === "reply") {
            const row = el("div", "t-reply", `<span class="who">Jarvis</span><p></p>`);
            log.appendChild(row);
            const p = row.querySelector("p");
            const words = s.text.split(" ");
            for (let i = 1; i <= words.length; i++) { p.textContent = words.slice(0, i).join(" "); await sleep(45 + Math.random() * 40); }
            await sleep(300);
          } else if (s.t === "saved") {
            log.appendChild(el("div", "t-saved", esc(s.text)));
          }
        }
        await sleep(6500);
        await waitVisible();
        log.style.transition = "opacity .5s";
        log.style.opacity = "0";
        await sleep(550);
        log.style.transition = "";
      }
    }

    return {
      start() {
        if (started) return;
        started = true;
        if (reduce) renderStatic(); else play();
      },
    };
  }

  const heroTerm = makeTerminal($("#hero-log"), heroScript);

  /* ------------------------------------------------------------------
     Split headings into words for the reveal
     ------------------------------------------------------------------ */
  $$("[data-split]").forEach((h) => {
    const text = h.textContent.trim().replace(/\s+/g, " ");
    h.setAttribute("aria-label", text);
    h.textContent = "";
    text.split(" ").forEach((word, i) => {
      if (i) h.appendChild(document.createTextNode(" "));
      const w = el("span", "w"); w.setAttribute("aria-hidden", "true");
      const inner = el("span"); inner.textContent = word;
      w.appendChild(inner); h.appendChild(w);
    });
  });

  /* ------------------------------------------------------------------
     QR code art (decorative)
     ------------------------------------------------------------------ */
  (function buildQR() {
    const qr = $(".qr");
    if (!qr) return;
    const N = 25;
    let seed = 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const finder = (x, y, ox, oy) => {
      const dx = x - ox, dy = y - oy;
      if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return null;
      if (dx === 0 || dy === 0 || dx === 6 || dy === 6) return true;
      if (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4) return true;
      return false;
    };
    const frag = document.createDocumentFragment();
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        let on = finder(x, y, 0, 0);
        if (on === null) on = finder(x, y, N - 7, 0);
        if (on === null) on = finder(x, y, 0, N - 7);
        const nearFinder = (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
        if (on === null) on = nearFinder ? false : rnd() > 0.52;
        const c = document.createElement("i");
        if (!on) c.className = "off";
        frag.appendChild(c);
      }
    }
    qr.insertBefore(frag, qr.firstChild);
  })();

  /* ------------------------------------------------------------------
     Story panels — small animations that play when a chapter is active
     ------------------------------------------------------------------ */
  const panelRuns = new Map();
  function countUp(node, to, dur = 900, suffix = "") {
    if (reduce) { node.textContent = to + suffix; return; }
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      node.textContent = Math.round(to * e) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  const runners = {
    0: async (panel, token) => {
      const li = $(".mem-new", panel), typed = $(".mem-typed", panel), count = $(".mem-count", panel);
      const text = typed.dataset.text;
      li.classList.remove("is-saved");
      count.textContent = "5 facts";
      if (reduce) { typed.textContent = text; li.classList.add("is-saved"); count.textContent = "6 facts"; return; }
      typed.textContent = "";
      typed.classList.add("is-typing");
      await sleep(500);
      for (let i = 1; i <= text.length; i++) { if (token.dead) return; typed.textContent = text.slice(0, i); await sleep(28 + Math.random() * 30); }
      typed.classList.remove("is-typing");
      await sleep(250);
      li.classList.add("is-saved");
      count.textContent = "6 facts";
    },
    1: async (panel, token) => {
      $$("[data-count]", panel).forEach((b) => countUp(b, +b.dataset.count, 1100));
      const fresh = $(".lesson-new", panel);
      if (!reduce && hasGsap) gsap.fromTo(fresh, { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.8, delay: 0.5, ease: "expo.out" });
    },
    2: async (panel) => {
      const rows = $$(".src-list li", panel), fill = $(".agree-bar span", panel), num = $(".agree-top b", panel);
      if (reduce || !hasGsap) { num.textContent = "5"; return; }
      gsap.fromTo(rows, { opacity: 0, x: 18 }, { opacity: 1, x: 0, duration: 0.5, stagger: 0.12, ease: "power3.out" });
      gsap.fromTo(fill, { scaleX: 0 }, { scaleX: 1, duration: 1.1, delay: 0.75, ease: "expo.out" });
      countUp(num, 5, 900);
    },
    3: async (panel) => {
      if (reduce || !hasGsap) return;
      gsap.fromTo($(".phone", panel), { y: 60, opacity: 0, rotate: 4 }, { y: 0, opacity: 1, rotate: 0, duration: 1, ease: "expo.out" });
      gsap.fromTo($$(".phone-screen > *", panel), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.22, delay: 0.35, ease: "power3.out" });
      gsap.fromTo($(".qr-card", panel), { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.8, ease: "expo.out" });
    },
    4: async (panel, token) => {
      const rows = $$(".mac-log li", panel);
      rows.forEach((r) => r.classList.remove("is-done"));
      if (reduce) { rows.forEach((r) => r.classList.add("is-done")); return; }
      if (hasGsap) gsap.fromTo(rows, { opacity: 0.35 }, { opacity: 1, duration: 0.4, stagger: 0.38 });
      for (const r of rows) { await sleep(380); if (token.dead) return; r.classList.add("is-done"); }
    },
  };
  function runPanel(i, panel) {
    const prev = panelRuns.get(i);
    if (prev) prev.dead = true;
    const token = { dead: false };
    panelRuns.set(i, token);
    runners[i] && runners[i](panel, token);
  }

  /* ------------------------------------------------------------------
     Pets — real sprites from jarvis/pet/sprites.py
     ------------------------------------------------------------------ */
  (function pets() {
    const canvas = $("#pet-canvas");
    const data = window.JARVIS_PETS;
    if (!canvas || !data) return;
    const ctx = canvas.getContext("2d");
    const P = 5; // CSS px per sprite pixel
    let species = "cat";
    let W = 96, H = 46, x = 20, dir = 1, frame = 0, pause = 0, hearts = 0, last = 0, acc = 0;
    let running = false;

    function size() {
      const r = canvas.getBoundingClientRect();
      W = Math.max(40, Math.round(r.width / P));
      H = Math.max(30, Math.round(r.height / P));
      canvas.width = W; canvas.height = H;
      x = Math.min(x, W - 18);
    }

    const HEART = [".PP.PP.", "PPPPPPP", "PPPPPPP", ".PPPPP.", "..PPP..", "...P..."];

    function draw() {
      const pet = data[species];
      const rows = pet.f[frame];
      const pal = pet.pal;
      ctx.clearRect(0, 0, W, H);
      const floor = H - Math.round(34 / P);
      const top = floor - rows.length;
      const px = Math.round(x);
      for (let r = 0; r < rows.length; r++) {
        const line = rows[r];
        for (let c = 0; c < line.length; c++) {
          const k = line[dir > 0 ? line.length - 1 - c : c];
          if (k === "." || !pal[k]) continue;
          ctx.fillStyle = pal[k];
          ctx.fillRect(px + c, top + r, 1, 1);
        }
      }
      if (hearts > 0) {
        const hy = top - 2 - Math.round((1 - hearts) * 6);
        ctx.globalAlpha = Math.min(1, hearts * 2);
        ctx.fillStyle = "#f58ba6";
        HEART.forEach((line, r) => { for (let c = 0; c < line.length; c++) if (line[c] === "P") ctx.fillRect(px + 5 + c, hy + r, 1, 1); });
        ctx.globalAlpha = 1;
      }
    }

    function tick(now) {
      if (!running) return;
      const dt = Math.min(100, now - (last || now));
      last = now;
      acc += dt;
      if (hearts > 0) hearts = Math.max(0, hearts - dt / 1400);
      if (pause > 0) {
        pause -= dt;
        frame = 0;
      } else {
        x += dir * dt * 0.012;
        if (x > W - 20) { x = W - 20; dir = -1; pause = 900; }
        if (x < 4) { x = 4; dir = 1; pause = 900; }
        if (Math.random() < dt / 9000) pause = 1400 + Math.random() * 1600;
        if (acc > 170) { frame = frame === 1 ? 2 : 1; acc = 0; }
      }
      draw();
      requestAnimationFrame(tick);
    }

    size();
    window.addEventListener("resize", size);
    canvas.addEventListener("click", () => { hearts = 1; pause = 900; });
    $$(".species .chip").forEach((b) => b.addEventListener("click", () => {
      species = b.dataset.species;
      $$(".species .chip").forEach((o) => o.classList.toggle("is-on", o === b));
      hearts = 1; pause = 700;
      draw();
    }));

    if (reduce) { draw(); return; }
    new IntersectionObserver(([en]) => {
      if (en.isIntersecting && !running) { running = true; last = 0; requestAnimationFrame(tick); }
      else if (!en.isIntersecting) running = false;
    }).observe(canvas);
  })();

  /* ------------------------------------------------------------------
     Themes — real palettes from jarvis/tui/theme.py
     ------------------------------------------------------------------ */
  (function themes() {
    const T = window.JARVIS_THEMES;
    const wrap = $("#swatches"), view = $("#theme-view"), name = $("#tv-name");
    if (!T || !wrap) return;
    const names = Object.keys(T);
    let current = names.indexOf("tokyonight");
    let userPicked = false;
    function apply(i) {
      current = i;
      const [bg, acc, acc2, ok, fg, mute] = T[names[i]];
      view.style.setProperty("--tv-bg", bg);
      view.style.setProperty("--tv-acc", acc);
      view.style.setProperty("--tv-acc2", acc2);
      view.style.setProperty("--tv-ok", ok);
      view.style.setProperty("--tv-fg", fg);
      view.style.setProperty("--tv-mute", mute);
      name.textContent = names[i];
      $$(".sw", wrap).forEach((s, k) => { s.classList.toggle("is-on", k === i); s.setAttribute("aria-pressed", String(k === i)); });
    }
    names.forEach((n, i) => {
      const b = el("button", "sw");
      b.type = "button";
      b.style.setProperty("--a", T[n][1]);
      b.style.setProperty("--b", T[n][2]);
      b.setAttribute("aria-label", `Preview the ${n} theme`);
      b.addEventListener("click", () => { userPicked = true; apply(i); });
      wrap.appendChild(b);
    });
    apply(current);
    if (reduce) return;
    let inView = false;
    new IntersectionObserver(([en]) => { inView = en.isIntersecting; }).observe(wrap);
    setInterval(() => { if (inView && !userPicked && !document.hidden) apply((current + 1) % names.length); }, 2200);
  })();

  /* ------------------------------------------------------------------
     Install tabs
     ------------------------------------------------------------------ */
  (function tabs() {
    const list = $(".os-tabs");
    if (!list) return;
    const tabsEls = $$(".os-tab", list), pill = $(".os-pill", list);
    function place(tab) {
      pill.style.width = tab.offsetWidth + "px";
      pill.style.transform = `translateX(${tab.offsetLeft - 4}px)`;
    }
    function select(tab, focus) {
      tabsEls.forEach((t) => {
        const on = t === tab;
        t.classList.toggle("is-on", on);
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        $("#" + t.getAttribute("aria-controls")).hidden = !on;
      });
      place(tab);
      if (focus) tab.focus();
      if (hasGsap) ScrollTrigger.refresh();
    }
    tabsEls.forEach((t, i) => {
      t.addEventListener("click", () => select(t));
      t.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          const n = (i + (e.key === "ArrowRight" ? 1 : -1) + tabsEls.length) % tabsEls.length;
          select(tabsEls[n], true);
        }
      });
    });
    const ua = navigator.userAgent || "";
    if (/Windows/i.test(ua)) select(tabsEls[1]); else place(tabsEls[0]);
    window.addEventListener("resize", () => place($(".os-tab.is-on", list)));
    document.fonts && document.fonts.ready.then(() => place($(".os-tab.is-on", list)));
  })();

  /* ------------------------------------------------------------------
     Without GSAP (or with reduced motion): show everything, run panels once
     ------------------------------------------------------------------ */
  const chapters = $$(".chapter");
  if (!hasGsap || reduce) {
    heroTerm.start();
    const panels = chapters.map((ch) => $(".panel", ch));
    if (window.matchMedia("(min-width: 961px)").matches) {
      // Same sticky story, switched by IntersectionObserver instead of GSAP.
      const stage = $(".stage-panels"), dots = $$(".stage-rail i");
      panels.forEach((p) => stage.appendChild(p));
      const show = (i) => {
        chapters.forEach((c, k) => c.classList.toggle("is-active", k === i));
        panels.forEach((p, k) => p.classList.toggle("is-active", k === i));
        dots.forEach((d, k) => d.classList.toggle("is-on", k === i));
      };
      show(0);
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) show(chapters.indexOf(en.target)); });
      }, { rootMargin: "-45% 0px -45% 0px" });
      chapters.forEach((c) => io.observe(c));
    }
    panels.forEach((p, i) => { if (p) runPanel(i, p); });
    $$(".stat b[data-count]").forEach((b) => { b.textContent = b.dataset.count + (b.dataset.suffix || ""); });
    $$(".step").forEach((s) => s.classList.add("is-lit"));
    document.documentElement.style.setProperty("--line-p", "1");
    $(".steps") && $$(".steps").forEach((s) => s.style.setProperty("--line-p", "1"));
    return;
  }

  /* ==================================================================
     GSAP scenes
     ================================================================== */
  const mm = gsap.matchMedia();

  /* ---------- hero intro ---------- */
  const intro = gsap.timeline({ defaults: { ease: "expo.out" } });
  intro
    .from(".nav-inner", { y: -20, opacity: 0, duration: 1 }, 0)
    .from(".hero-title .ln > span", { yPercent: 118, duration: 1.3, stagger: 0.09 }, 0.1)
    .fromTo(".hero-title", { "--wdth": 116 }, { "--wdth": 100, duration: 1.8 }, 0.1)
    .from(".hero-sub, .hero-actions, .hero-facts", { y: 26, opacity: 0, duration: 1.1, stagger: 0.08 }, 0.5)
    .from(".hero-stage", { y: 140, opacity: 0, duration: 1.6 }, 0.55)
    .from(".hero-glow", { opacity: 0, duration: 2 }, 0.3)
    .add(() => heroTerm.start(), 1.1);

  /* ---------- hero scroll: terminal flattens, headline drifts ---------- */
  mm.add("(min-width: 721px)", () => {
    gsap.fromTo(".term-hero", { rotateX: 20, scale: 0.94 }, {
      rotateX: 0, scale: 1, ease: "none",
      scrollTrigger: { trigger: ".hero-stage", start: "top 92%", end: "top 18%", scrub: 0.6 },
    });
    gsap.to(".hero-head", {
      y: -70, opacity: 0.3, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "15% top", end: "bottom top", scrub: true },
    });
  });

  /* ---------- headings: word reveal ---------- */
  $$("[data-split]").forEach((h) => {
    gsap.from($$(".w > span", h), {
      yPercent: 115, duration: 1.1, ease: "expo.out", stagger: 0.045,
      scrollTrigger: { trigger: h, start: "top 86%", once: true },
    });
  });

  /* ---------- light reveals for supporting content ---------- */
  ScrollTrigger.batch(".sec-head .lede, .way, .stat, .tile, .spec li, .install-note, .foot-line, .foot-actions, .os-tabs, .chapter > .h3, .chapter > p", {
    start: "top 88%",
    once: true,
    onEnter: (els) => gsap.from(els, { y: 28, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.07, overwrite: true }),
  });

  /* ---------- FREE: pinned $0 that stretches ---------- */
  const freeIn = (tl, at = 0) => tl
    .from(".nos li", { opacity: 0, y: 26, scale: 0.9, stagger: 0.12, duration: 0.5, ease: "back.out(2)" }, at + 0.15)
    .from(".picker", { y: 70, opacity: 0, rotate: 2, duration: 0.8, ease: "power3.out" }, at)
    .from(".picker .pg-row, .picker .pg-title", { opacity: 0, x: 26, stagger: 0.06, duration: 0.45, ease: "power3.out" }, at + 0.25)
    .from(".free-more", { opacity: 0, y: 16, duration: 0.5 }, at + 0.5);

  mm.add("(min-width: 961px) and (min-height: 760px)", () => {
    gsap.fromTo(".zero", { yPercent: 30, opacity: 0 }, {
      yPercent: 0, opacity: 1, ease: "none",
      scrollTrigger: { trigger: ".free", start: "top 85%", end: "top 15%", scrub: true },
    });
    const tl = gsap.timeline({ scrollTrigger: { trigger: ".free", start: "top top", end: "+=110%", pin: ".free-pin", scrub: 0.7, anticipatePin: 1, refreshPriority: 2 } });
    tl.fromTo(".zero", { "--wdth": 75 }, { "--wdth": 125, duration: 1.2, ease: "none" }, 0);
    freeIn(tl, 0.1);
  });
  mm.add("(max-width: 960px), (max-height: 759px)", () => {
    const tl = gsap.timeline({ scrollTrigger: { trigger: ".free-grid", start: "top 75%", once: true } });
    tl.fromTo(".zero", { "--wdth": 75, opacity: 0, y: 30 }, { "--wdth": 118, opacity: 1, y: 0, duration: 1.4, ease: "expo.out" }, 0);
    freeIn(tl, 0.2);
  });

  /* ---------- WHY: sticky story ---------- */
  const stagePanels = $(".stage-panels");
  const rail = $$(".stage-rail i");
  const panelsByCh = chapters.map((ch) => $(".panel", ch));

  mm.add("(min-width: 961px)", () => {
    panelsByCh.forEach((p) => stagePanels.appendChild(p));
    let active = -1;
    const setActive = (i) => {
      if (i === active) return;
      active = i;
      chapters.forEach((c, k) => c.classList.toggle("is-active", k === i));
      panelsByCh.forEach((p, k) => p.classList.toggle("is-active", k === i));
      rail.forEach((r, k) => r.classList.toggle("is-on", k === i));
      runPanel(i, panelsByCh[i]);
    };
    const triggers = chapters.map((ch, i) => ScrollTrigger.create({
      trigger: ch, start: "top 55%", end: "bottom 55%",
      onToggle: (self) => { if (self.isActive) setActive(i); },
    }));
    // first chapter visible before reaching it
    setActive(0);
    return () => {
      triggers.forEach((t) => t.kill());
      panelsByCh.forEach((p, i) => { p.classList.remove("is-active"); chapters[i].appendChild(p); });
      chapters.forEach((c) => c.classList.remove("is-active"));
    };
  });
  mm.add("(max-width: 960px)", () => {
    const triggers = panelsByCh.map((p, i) => ScrollTrigger.create({
      trigger: p, start: "top 80%", once: true, onEnter: () => runPanel(i, p),
    }));
    return () => triggers.forEach((t) => t.kill());
  });

  /* ---------- MODELS: velocity marquee + counters ---------- */
  const marqueeTweens = $$(".mq-row").map((row) => {
    const track = $(".mq-track", row);
    const clone = track.cloneNode(true);
    row.appendChild(clone);
    const dir = +row.dataset.dir;
    return gsap.fromTo([track, clone], { xPercent: dir < 0 ? 0 : -100 }, { xPercent: dir < 0 ? -100 : 0, duration: 46, ease: "none", repeat: -1 });
  });
  let boost = 0;
  ScrollTrigger.create({
    trigger: ".marquee", start: "top bottom", end: "bottom top",
    onUpdate: (self) => { boost = Math.min(7, Math.abs(self.getVelocity()) / 260); },
  });
  gsap.ticker.add(() => {
    boost *= 0.92;
    marqueeTweens.forEach((t) => t.timeScale(1 + boost));
  });
  $$(".stat b[data-count]").forEach((b) => {
    ScrollTrigger.create({ trigger: b, start: "top 90%", once: true, onEnter: () => countUp(b, +b.dataset.count, 1400, b.dataset.suffix || "") });
  });

  /* ---------- SETUP: folders converge into Jarvis ---------- */
  mm.add("(min-width: 961px)", () => {
    const paths = $$(".wires path");
    paths.forEach((p) => { p.setAttribute("pathLength", "1"); p.style.strokeDasharray = "1"; p.style.strokeDashoffset = "1"; });
    const sources = $$(".sources li");
    const scatter = sources.map((_, i) => ({
      x: gsap.utils.random(-320, 220), y: (i - 3.5) * gsap.utils.random(-30, 30) + gsap.utils.random(-60, 60), r: gsap.utils.random(-16, 16),
    }));
    const tall = window.matchMedia("(min-height: 760px)").matches;
    const tl = gsap.timeline({
      scrollTrigger: tall
        ? { trigger: ".setup", start: "top top", end: "+=130%", pin: ".setup-pin", scrub: 0.7, anticipatePin: 1, refreshPriority: 1 }
        : { trigger: ".flow", start: "top 80%", end: "bottom 40%", scrub: 0.7 },
    });
    tl.from(sources, { x: (i) => scatter[i].x, y: (i) => scatter[i].y, rotation: (i) => scatter[i].r, opacity: 0, stagger: 0.05, duration: 1, ease: "power3.out" })
      .to(".wires-in path", { strokeDashoffset: 0, stagger: 0.04, duration: 0.7, ease: "none" }, 0.7)
      .from(".core", { scale: 0.5, opacity: 0, duration: 0.6, ease: "back.out(1.6)" }, 1.0)
      .to(".wires-out path", { strokeDashoffset: 0, stagger: 0.07, duration: 0.6, ease: "none" }, 1.45)
      .from(".outputs li", { opacity: 0, x: -30, stagger: 0.1, duration: 0.5, ease: "power3.out" }, 1.6);
    return () => paths.forEach((p) => { p.style.strokeDasharray = ""; p.style.strokeDashoffset = ""; });
  });
  mm.add("(max-width: 960px)", () => {
    gsap.from(".sources li", { opacity: 0, y: 16, scale: 0.9, stagger: 0.05, duration: 0.6, ease: "back.out(2)", scrollTrigger: { trigger: ".flow", start: "top 80%", once: true } });
    gsap.from(".core, .outputs li", { opacity: 0, y: 20, stagger: 0.1, duration: 0.7, ease: "power3.out", scrollTrigger: { trigger: ".core", start: "top 85%", once: true } });
  });

  /* ---------- COMPARE: card grows to full bleed, rows check in ---------- */
  mm.add("(min-width: 961px)", () => {
    gsap.fromTo(".compare", { "--ci": "3.5%", "--cr": "40px" }, {
      "--ci": "0%", "--cr": "0px", ease: "none",
      scrollTrigger: { trigger: ".compare", start: "top bottom", end: "top 10%", scrub: true },
    });
  });
  $$(".table .tr:not(.th)").forEach((tr) => gsap.set(tr, { "--draw": 24 }));
  gsap.from(".table .tr", {
    opacity: 0, y: 22, duration: 0.7, stagger: 0.07, ease: "power3.out",
    scrollTrigger: { trigger: ".table", start: "top 82%", once: true },
  });
  gsap.to(".table .tr:not(.th)", {
    "--draw": 0, duration: 0.6, stagger: 0.07, delay: 0.25, ease: "power2.out",
    scrollTrigger: { trigger: ".table", start: "top 82%", once: true },
  });

  /* ---------- INSTALL: the step line draws as you read ---------- */
  $$(".steps").forEach((list) => {
    gsap.fromTo(list, { "--line-p": 0 }, {
      "--line-p": 1, ease: "none",
      scrollTrigger: { trigger: list, start: "top 70%", end: "bottom 60%", scrub: true },
    });
    $$(".step", list).forEach((s) => ScrollTrigger.create({ trigger: s, start: "top 72%", onEnter: () => s.classList.add("is-lit"), onLeaveBack: () => s.classList.remove("is-lit") }));
  });

  /* ---------- FOOTER: the wordmark stretches out ---------- */
  gsap.fromTo(".wordmark", { "--wdth": 75 }, {
    "--wdth": 125, ease: "none",
    scrollTrigger: { trigger: ".foot", start: "top bottom", end: "bottom bottom", scrub: 0.5 },
  });
  gsap.from(".wordmark span", {
    yPercent: 40, ease: "none",
    scrollTrigger: { trigger: ".foot", start: "top bottom", end: "bottom bottom", scrub: 0.5 },
  });

  /* ---------- nav: highlight the section in view ---------- */
  const links = $$(".nav-links a");
  ["free", "why", "models", "compare", "install"].forEach((id) => {
    const sec = document.getElementById(id);
    if (!sec) return;
    ScrollTrigger.create({
      trigger: sec, start: "top 50%", end: "bottom 50%",
      onToggle: (self) => links.forEach((a) => a.classList.toggle("is-current", self.isActive && a.getAttribute("href") === "#" + id)),
    });
  });

  ScrollTrigger.sort();
  // Fonts change line lengths; re-measure once they are in.
  if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener("load", () => ScrollTrigger.refresh());
})();
