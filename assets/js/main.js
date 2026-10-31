/* ============================================================
   SUNBII Technology — main.js v3
   Hệ thống: preloader · Lenis smooth scroll · custom cursor ·
   hero glow · ember canvas · marquee vận tốc · manifesto
   word-lit · horizontal showcase · counters · tilt · magnetic ·
   parallax · cookie · scrollspy.
   Nguyên tắc: hiệu ứng chỉ nâng đỡ — trang đọc được cả khi
   JS/GSAP không tải (html.no-js / html.gsap-fail).
   ============================================================ */
(function () {
  'use strict';

  var docEl = document.documentElement;
  docEl.classList.remove('no-js');

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var state = { vel: 0, lenis: null };

  /* ---------------- Header state + progress ---------------- */
  var header = document.querySelector('.site-header');
  var progress = document.getElementById('scrollProgress');
  var toTop = document.getElementById('toTop');

  function onScroll() {
    var y = window.scrollY || 0;
    header.classList.toggle('is-scrolled', y > 24);
    var max = docEl.scrollHeight - innerHeight;
    progress.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
    if (toTop) toTop.hidden = y < 600;
  }

  if (toTop) {
    toTop.addEventListener('click', function () {
      if (state.lenis) state.lenis.scrollTo(0);
      else scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    });
  }

  /* ---------------- Mobile menu ---------------- */
  var toggle = document.querySelector('.nav-toggle');
  var menu = document.getElementById('mobileMenu');
  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      menu.hidden = open;
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        toggle.setAttribute('aria-expanded', 'false');
        menu.hidden = true;
      }
    });
  }

  /* ---------------- Cookie consent ---------------- */
  var bar = document.getElementById('cookieBar');
  if (bar && !localStorage.getItem('sunbii-cookie-consent')) {
    setTimeout(function () { bar.hidden = false; }, 1400);
    document.getElementById('cookieAccept').addEventListener('click', function () {
      localStorage.setItem('sunbii-cookie-consent', 'granted');
      bar.hidden = true;
    });
    document.getElementById('cookieDecline').addEventListener('click', function () {
      localStorage.setItem('sunbii-cookie-consent', 'denied');
      bar.hidden = true;
    });
  }

  /* ---------------- Năm bản quyền ---------------- */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------------- Scrollspy ---------------- */
  var sections = document.querySelectorAll('main section[id]');
  var navLinks = document.querySelectorAll('.nav-link[href^="#"]');
  if ('IntersectionObserver' in window && sections.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        navLinks.forEach(function (l) {
          l.classList.toggle('is-active', l.getAttribute('href') === '#' + en.target.id);
        });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ---------------- Tilt + glow (rAF-throttled, không layout thrash) ----------------
     Nguyên tắc: KHÔNG đọc layout trong pointermove (getBoundingClientRect gây
     reflow mỗi pixel chuột). Đọc rect 1 lần khi vào card, ghi style qua rAF,
     glow dùng transform thay vì background-position → chỉ composite, không repaint. */
  function tiltCard(card) {
    if (reduced) return;
    var rect = null, rectScroll = 0, raf = 0, px = 0.5, py = 0.5;

    function readRect() {
      rect = card.getBoundingClientRect();
      rectScroll = window.scrollY || 0;
    }
    function apply() {
      raf = 0;
      if (!rect) return;
      if ((window.scrollY || 0) !== rectScroll) readRect(); // cuộn khi đang hover → đọc lại tối đa 1 lần/frame
      var rx = (0.5 - py) * 5;
      var ry = (px - 0.5) * 5;
      card.style.transform = 'perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateY(-4px)';
      card.style.setProperty('--gx', ((px - 0.5) * rect.width).toFixed(1) + 'px');
      card.style.setProperty('--gy', ((py - 0.5) * rect.height).toFixed(1) + 'px');
    }
    card.addEventListener('pointerenter', function () {
      readRect();
      card.classList.add('is-tilting');
    });
    card.addEventListener('pointermove', function (e) {
      if (!rect) readRect();
      px = (e.clientX - rect.left) / rect.width;
      py = (e.clientY - rect.top) / rect.height;
      if (!raf) raf = requestAnimationFrame(apply); // tối đa 1 lần ghi style mỗi frame
    });
    card.addEventListener('pointerleave', function () {
      rect = null;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      card.classList.remove('is-tilting');
      card.style.transform = ''; // CSS spring-back tiếp quản
    });
  }
  document.querySelectorAll('.value-card').forEach(tiltCard);

  /* ---------------- Nút magnetic ---------------- */
  if (matchMedia('(hover: hover)').matches && !reduced) {
    document.querySelectorAll('.magnetic').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var dx = e.clientX - r.left - r.width / 2;
        var dy = e.clientY - r.top - r.height / 2;
        el.style.transform = 'translate(' + dx * 0.14 + 'px,' + dy * 0.14 + 'px)';
      });
      el.addEventListener('pointerleave', function () {
        el.style.transition = 'transform .45s cubic-bezier(.22,1,.36,1)';
        el.style.transform = '';
        setTimeout(function () { el.style.transition = ''; }, 460);
      });
    });
  }

  /* ---------------- Custom cursor + hero glow ---------------- */
  var dot = document.querySelector('.cursor-dot');
  var ring = document.querySelector('.cursor-ring');
  var heroGlow = document.getElementById('heroGlow');
  if (matchMedia('(hover: hover)').matches) {
    var pos = { x: -100, y: -100 }, rPos = { x: -100, y: -100 };
    addEventListener('pointermove', function (e) { pos.x = e.clientX; pos.y = e.clientY; }, { passive: true });
    (function cursorLoop() {
      rPos.x += (pos.x - rPos.x) * 0.16;
      rPos.y += (pos.y - rPos.y) * 0.16;
      if (dot) {
        dot.style.transform = 'translate(' + pos.x + 'px,' + pos.y + 'px) translate(-50%,-50%)';
        dot.style.opacity = 1;
      }
      if (ring) {
        ring.style.transform = 'translate(' + rPos.x + 'px,' + rPos.y + 'px) translate(-50%,-50%)';
        ring.style.opacity = 1;
      }
      requestAnimationFrame(cursorLoop);
    })();
    document.querySelectorAll('a, button, summary').forEach(function (el) {
      el.addEventListener('pointerenter', function () { ring.classList.add('is-hover'); });
      el.addEventListener('pointerleave', function () { ring.classList.remove('is-hover'); });
    });

    if (heroGlow) {
      var hero = document.querySelector('.hero');
      var gRaf = 0, gx = 0, gy = 0, gRect = null, gScroll = -1;
      hero.addEventListener('pointermove', function (e) {
        var sy = window.scrollY || 0;
        if (!gRect || sy !== gScroll) { gRect = hero.getBoundingClientRect(); gScroll = sy; }
        gx = e.clientX - gRect.left;
        gy = e.clientY - gRect.top;
        if (!gRaf) {
          gRaf = requestAnimationFrame(function () {
            gRaf = 0;
            heroGlow.style.transform = 'translate3d(' + gx.toFixed(0) + 'px,' + gy.toFixed(0) + 'px,0) translate(-50%,-50%)';
          });
        }
      }, { passive: true });
    }
  }

  /* ============================================================
     EMBER CANVAS — tàn lửa vàng/đỏ bay lên (hero + footer)
     ============================================================ */
  function emberCanvas(canvas, opts) {
    if (!canvas || reduced) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var W = 0, H = 0, dpr = Math.min(devicePixelRatio || 1, 2), parts = [];
    var PALETTE = ['251,192,45', '216,67,21', '255,224,130', '191,54,12'];

    function resize() {
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var target = Math.floor(Math.min(opts.density(W, H), opts.max));
      while (parts.length < target) parts.push(make(true));
      parts.length = Math.min(parts.length, target);
    }
    function make(anywhere) {
      return {
        x: Math.random() * W,
        y: anywhere ? Math.random() * H : H + 12,
        r: 0.8 + Math.random() * 2.6,
        vy: 0.18 + Math.random() * 0.55,
        sway: 0.4 + Math.random() * 1.1,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.25 + Math.random() * 0.55,
        c: PALETTE[(Math.random() * PALETTE.length) | 0],
        tw: 0.5 + Math.random() * 1.5,
      };
    }
    var t = 0;
    function frame() {
      if (document.hidden) { requestAnimationFrame(frame); return; }
      t += 0.016;
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.y -= p.vy;
        p.x += Math.sin(t * p.tw + p.phase) * p.sway * 0.4;
        if (p.y < -14) parts[i] = make(false);
        var glow = 0.7 + 0.3 * Math.sin(t * p.tw * 2 + p.phase);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + p.c + ',' + (p.alpha * glow).toFixed(3) + ')';
        ctx.fill();
      }
      requestAnimationFrame(frame);
    }
    addEventListener('resize', resize, { passive: true });
    resize();
    requestAnimationFrame(frame);
  }

  emberCanvas(document.getElementById('emberCanvas'), {
    max: 110, density: function (w, h) { return (w * h) / 22000; },
  });
  emberCanvas(document.getElementById('emberCanvasFooter'), {
    max: 70, density: function (w, h) { return (w * h) / 30000; },
  });

  /* ============================================================
     GSAP — mọi thứ cần ScrollTrigger nằm ở đây
     ============================================================ */
  var preloader = document.getElementById('preloader');

  function failSafe() {
    docEl.classList.add('gsap-fail');
    if (preloader) preloader.classList.add('is-done');
  }

  function initGsap() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') { failSafe(); return; }
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    gsap.ticker.lagSmoothing(0);

    /* Chuẩn hoá dòng chữ mask về yPercent — ẩn/hiện khớp % với CSS translateY(112%) */
    gsap.utils.toArray('.line').forEach(function (l) { gsap.set(l, { yPercent: 112, y: 0 }); });

    /* ---- Lenis smooth scroll (một ticker duy nhất) ---- */
    var lenis = null;
    if (typeof Lenis !== 'undefined' && !reduced) {
      lenis = new Lenis({ autoRaf: false, lerp: 0.1, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (time) {
        if (document.hidden) return;
        lenis.raf(time * 1000);
      });
      lenis.stop(); // chờ preloader
      state.lenis = lenis;
    }

    /* ---- Preloader ---- */
    var preCount = document.getElementById('preCount');
    var preFill = document.getElementById('preBarFill');
    var pct = { v: 0 };
    var paint = function () {
      if (preCount) preCount.textContent = String(Math.round(pct.v));
      if (preFill) preFill.style.width = pct.v + '%';
    };

    function finishPreloader() {
      if (!preloader || preloader.classList.contains('is-done')) return;
      preloader.classList.add('is-done');
      onScroll();
      if (lenis) lenis.start();
      ScrollTrigger.refresh();

      if (!reduced) {
        gsap.to('.hero-title .line', { yPercent: 0, duration: 1.15, ease: 'power4.out', stagger: 0.11, delay: 0.15 });
        gsap.to('.hero .reveal', { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.1, delay: 0.55 });
      }
    }

    var fontsReady = Promise.race([
      document.fonts ? document.fonts.ready.catch(function () {}) : Promise.resolve(),
      new Promise(function (r) { setTimeout(r, 1500); }),
    ]);

    gsap.to(pct, { v: 82, duration: 1.2, ease: 'power1.inOut', onUpdate: paint });
    fontsReady.then(function () {
      gsap.to(pct, {
        v: 100, duration: 0.45, delay: 0.15, ease: 'power2.out',
        onUpdate: paint, onComplete: finishPreloader,
      });
    });
    setTimeout(finishPreloader, 4000); // giới hạn tuyệt đối — không bao giờ kẹt

    if (reduced) {
      // tôn trọng reduced-motion: hiện hết, đếm nhanh, không tween
      document.querySelectorAll('.line').forEach(function (l) { l.style.transform = 'none'; });
      gsap.set('.reveal', { autoAlpha: 1, y: 0 });
      document.querySelectorAll('[data-count]').forEach(function (el) {
        el.textContent = Number(el.dataset.count).toLocaleString('vi-VN') + (el.dataset.suffix || '');
      });
      var words = document.querySelectorAll('.manifesto-text .mw');
      words.forEach(function (w) { w.classList.add('is-lit'); });
      return;
    }

    /* ---- Tiêu đề masked line (ngoài hero — hero do preloader lo) ---- */
    document.querySelectorAll('.section-title').forEach(function (title) {
      gsap.to(title.querySelectorAll('.line'), {
        yPercent: 0, duration: 1.05, ease: 'power4.out', stagger: 0.1,
        scrollTrigger: { trigger: title, start: 'top 78%', once: true },
      });
    });

    /* ---- .reveal fade-up ---- */
    gsap.utils.toArray('.reveal').forEach(function (el) {
      if (el.closest('.hero')) return; // hero do intro lo
      gsap.to(el, {
        autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 84%', once: true },
      });
    });

    /* ---- Stagger panels ---- */
    gsap.utils.toArray('.values-grid, .numbers-grid, .manifesto-grid').forEach(function (grid) {
      gsap.set(grid.children, { autoAlpha: 0, y: 30 });
      gsap.to(grid.children, {
        autoAlpha: 1, y: 0, duration: 0.85, ease: 'power3.out', stagger: 0.09,
        scrollTrigger: { trigger: grid, start: 'top 82%', once: true },
      });
    });

    /* ---- Manifesto word-by-word lit ---- */
    (function splitManifesto() {
      var box = document.getElementById('manifestoTitle');
      if (!box) return;
      function wrap(node) {
        Array.from(node.childNodes).forEach(function (child) {
          if (child.nodeType === 3) {
            var frag = document.createDocumentFragment();
            child.textContent.split(/(\s+)/).forEach(function (part) {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
              var s = document.createElement('span');
              s.className = 'mw';
              s.textContent = part;
              frag.appendChild(s);
            });
            node.replaceChild(frag, child);
          } else if (child.nodeType === 1) {
            wrap(child);
          }
        });
      }
      wrap(box);
      var words = gsap.utils.toArray('.manifesto-text .mw');
      ScrollTrigger.create({
        trigger: '.manifesto',
        start: 'top 72%',
        end: 'center 42%',
        onUpdate: function (self) {
          var lit = Math.floor(self.progress * words.length * 1.25);
          words.forEach(function (w, i) { w.classList.toggle('is-lit', i < lit); });
        },
      });
    })();

    /* ---- Horizontal showcase (chỉ desktop, không reduced-motion) ---- */
    gsap.matchMedia().add('(min-width: 1024px)', function () {
      var track = document.getElementById('showcaseTrack');
      var showcase = document.querySelector('.showcase');
      if (!track || !showcase) return;
      var amount = function () { return Math.max(0, track.scrollWidth - window.innerWidth + 40); };
      var tween = gsap.to(track, {
        x: function () { return -amount(); },
        ease: 'none',
        scrollTrigger: {
          trigger: showcase,
          start: 'top top',
          end: function () { return '+=' + (amount() + window.innerHeight * 0.35); },
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });
      return function () {
        tween.scrollTrigger && tween.scrollTrigger.kill();
        tween.kill();
        gsap.set(track, { x: 0 });
      };
    });

    /* ---- Counters ---- */
    document.querySelectorAll('[data-count]').forEach(function (el) {
      var target = parseFloat(el.dataset.count || '0');
      var suffix = el.dataset.suffix || '';
      ScrollTrigger.create({
        trigger: el, start: 'top 86%', once: true,
        onEnter: function () {
          var obj = { v: 0 };
          gsap.to(obj, {
            v: target, duration: 1.7, ease: 'power2.out',
            onUpdate: function () {
              el.textContent = Math.round(obj.v).toLocaleString('vi-VN') + suffix;
            },
          });
        },
      });
    });

    /* ---- Parallax ảnh ---- */
    gsap.utils.toArray('[data-parallax]').forEach(function (el) {
      gsap.set(el, { scale: 1.18 });
      gsap.to(el, {
        yPercent: -9, ease: 'none',
        scrollTrigger: { trigger: el.parentElement || el, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });

    /* ---- Marquee vận tốc ---- */
    var mTrack = document.getElementById('marqueeTrack');
    if (mTrack) {
      mTrack.innerHTML += mTrack.innerHTML;
      var mx = 0, mw = 0;
      var measure = function () { mw = mTrack.scrollWidth / 2; };
      addEventListener('resize', measure, { passive: true });
      measure();
      gsap.ticker.add(function (t, dms) {
        if (document.hidden) return;
        var dt = Math.min(Math.max(dms / 1000, 0.001), 0.05);
        var targetVel = state.lenis ? (state.lenis.velocity || 0) / 70 : 0;
        state.vel += (targetVel - state.vel) * 0.08;
        mx -= (80 + Math.abs(state.vel) * 320) * dt;
        if (mx <= -mw) mx += mw;
        mTrack.style.transform = 'translate3d(' + mx + 'px,0,0) skewX(' + Math.max(-8, Math.min(8, state.vel * -5)) + 'deg)';
      });
    }
  }

  /* ---- Lenis anchor scrolling ---- */
  function initAnchors() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var target = document.querySelector(id);
      if (!target || !state.lenis) return;
      e.preventDefault();
      state.lenis.scrollTo(target, { offset: -80, duration: 1.4 });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initGsap(); initAnchors(); });
  } else {
    initGsap(); initAnchors();
  }

  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
