/* 白色情人節特效：整個畫面飄落各色花瓣；點畫面任何地方，點擊處會冒出愛心。
 * 純裝飾，不影響報名功能：
 * - 兩張畫布都不接收點擊（pointer-events: none），按鈕、欄位照常可以按。
 * - 游標在報名表的輸入欄位裡時，花瓣會自動變淡，不干擾填寫。
 * - 系統開啟「減少動態效果」時，預設不飄花瓣，愛心也只輕輕浮現。
 * - 頂欄的小花按鈕可以開關花瓣（記在這台裝置上）。
 * - 拿掉 index.html 最下面載入 fx.js 的那一行，就能整個關閉特效。 */
(function () {
  'use strict';

  var petalCanvas = document.getElementById('petalCanvas');
  var heartCanvas = document.getElementById('heartCanvas');
  var toggle = document.getElementById('petalToggle');
  if (!petalCanvas || !heartCanvas || !petalCanvas.getContext) return;
  var px = petalCanvas.getContext('2d');
  var hx = heartCanvas.getContext('2d');
  if (!px || !hx) return;

  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var KEY = 'ngr-petals';
  var petalsOn = !reduce;
  try {
    var saved = window.localStorage.getItem(KEY);
    if (saved === 'off') petalsOn = false;
    else if (saved === 'on') petalsOn = true;
  } catch (err) { /* 無痕模式等讀不到，就用預設 */ }

  /* [顏色, 出現比重]：櫻花粉、玫瑰粉、白（白色情人節）、蜜桃、薰衣草、檸檬黃、薄荷綠 */
  var PETAL_COLORS = [['#ff9ebb', 3], ['#ff6f9c', 2], ['#ffffff', 2], ['#ffb38a', 1], ['#c3a6ff', 1], ['#ffd84d', 1], ['#86dfb9', 1]];
  var HEART_COLORS = ['#ff4d6d', '#ff7aa2', '#ffb3c9', '#e8336b', '#ff5c8a', '#ffffff'];
  var TAU = Math.PI * 2;

  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0;
  var petals = [], hearts = [];
  var raf = 0, last = 0, clock = 0;
  var vis = 0;                       // 花瓣整體透明度（開關時淡入淡出）
  var calm = 0, calmTarget = 0;      // 填表時讓花瓣變淡
  var heartsOnCanvas = false;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function hexToRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(hex, toward, t) {
    var a = hexToRgb(hex), b = hexToRgb(toward);
    return 'rgb(' + a.map(function (v, i) { return Math.round(v + (b[i] - v) * t); }).join(',') + ')';
  }
  function edge(hex, alpha) {
    /* 白色的花瓣／愛心用淡粉色描邊，其他用自己的顏色加深 */
    var c = hexToRgb(hex === '#ffffff' ? '#f08aa8' : hex).map(function (v) { return Math.round(v * 0.72); });
    return 'rgba(' + c.join(',') + ',' + alpha + ')';
  }

  /* ---------- 預先畫好每種花瓣與愛心，動畫時只貼圖，手機也順 */
  var S = 96;
  function sprite(draw) {
    var c = document.createElement('canvas');
    c.width = c.height = S;
    var g = c.getContext('2d');
    g.translate(S / 2, S / 2);
    draw(g);
    return c;
  }

  function petalSprite(color, notched) {
    return sprite(function (g) {
      var L = S * 0.8, w = S * 0.5;
      g.beginPath();
      g.moveTo(0, L * 0.5);
      if (notched) {           // 櫻花瓣：尖端有缺口
        g.bezierCurveTo(w * 0.95, L * 0.22, w * 0.8, -L * 0.42, w * 0.2, -L * 0.5);
        g.lineTo(0, -L * 0.34);
        g.lineTo(-w * 0.2, -L * 0.5);
        g.bezierCurveTo(-w * 0.8, -L * 0.42, -w * 0.95, L * 0.22, 0, L * 0.5);
      } else {                 // 玫瑰瓣：圓弧
        g.bezierCurveTo(w * 1.05, L * 0.3, w * 0.85, -L * 0.5, 0, -L * 0.5);
        g.bezierCurveTo(-w * 0.85, -L * 0.5, -w * 1.05, L * 0.3, 0, L * 0.5);
      }
      g.closePath();
      var grad = g.createRadialGradient(0, L * 0.34, 1, 0, 0, L * 0.64);
      grad.addColorStop(0, mix(color, '#ffffff', 0.5));
      grad.addColorStop(1, color);
      g.fillStyle = grad;
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = edge(color, 0.42);
      g.stroke();
      g.beginPath();
      g.moveTo(0, L * 0.44);
      g.quadraticCurveTo(w * 0.07, 0, 0, -L * 0.22);
      g.lineWidth = 1.4;
      g.strokeStyle = edge(color, 0.2);
      g.stroke();
    });
  }

  function heartSprite(color) {
    return sprite(function (g) {
      var s = S * 0.4;
      g.translate(0, -s * 0.15);
      g.beginPath();
      g.moveTo(0, -0.35 * s);
      g.bezierCurveTo(0.5 * s, -1.05 * s, 1.38 * s, -0.12 * s, 0, 0.9 * s);
      g.bezierCurveTo(-1.38 * s, -0.12 * s, -0.5 * s, -1.05 * s, 0, -0.35 * s);
      g.closePath();
      var grad = g.createRadialGradient(-0.35 * s, -0.4 * s, 1, 0, 0, s * 1.3);
      grad.addColorStop(0, mix(color, '#ffffff', 0.5));
      grad.addColorStop(1, color);
      g.fillStyle = grad;
      g.fill();
      var white = color === '#ffffff';
      g.lineWidth = white ? 3 : 2;
      g.strokeStyle = edge(color, white ? 0.9 : 0.45);
      g.stroke();
      if (g.ellipse) {         // 左上角一點亮光
        g.beginPath();
        g.ellipse(-0.42 * s, -0.36 * s, 0.17 * s, 0.09 * s, -0.7, 0, TAU);
        g.fillStyle = 'rgba(255,255,255,.6)';
        g.fill();
      }
    });
  }

  var petalSprites = [];             // 依比重重複放入，抽到粉色的機會比較大
  PETAL_COLORS.forEach(function (pair) {
    var a = petalSprite(pair[0], true), b = petalSprite(pair[0], false);
    for (var i = 0; i < pair[1]; i++) petalSprites.push(a, b);
  });
  var heartSprites = HEART_COLORS.map(heartSprite);

  /* ---------- 花瓣 */
  function newPetal(scatter) {
    var depth = Math.random();       // 0 = 遠（小、慢、淡），1 = 近
    return {
      x: rand(-60, W + 60),
      y: scatter ? rand(-40, H) : rand(-80, -24),
      size: 11 + depth * 17,
      vy: 22 + depth * 44 + rand(-4, 4),
      windK: 0.5 + depth * 0.9,
      amp: rand(14, 46),
      freq: rand(0.1, 0.26),
      phase: rand(0, TAU),
      rot: rand(0, TAU),
      vr: rand(-1.2, 1.2),
      flip: rand(0, TAU),
      vf: rand(0.8, 2.2),
      alpha: 0.72 + depth * 0.28,
      img: pick(petalSprites)
    };
  }

  function targetCount() {             // 依螢幕大小：手機約 16 片，大螢幕最多 40 片
    return Math.max(16, Math.min(40, Math.round((W * H) / 34000)));
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    [petalCanvas, heartCanvas].forEach(function (c) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    });
    px.setTransform(dpr, 0, 0, dpr, 0, 0);
    hx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = targetCount();
    while (petals.length < n) petals.push(newPetal(true));
    if (petals.length > n) petals.length = n;
    start();
  }

  function drawPetals(dt) {
    var wind = 3 + Math.sin(clock * 0.11) * 14 + Math.sin(clock * 0.37) * 4;
    var fade = vis * (1 - 0.62 * calm);
    for (var i = 0; i < petals.length; i++) {
      var p = petals[i];
      p.y += p.vy * dt;
      p.x += wind * p.windK * dt;
      p.rot += p.vr * dt;
      p.flip += p.vf * dt;
      var sx = p.x + Math.sin(clock * p.freq * TAU + p.phase) * p.amp;
      if (p.y > H + 50 || sx > W + 90 || sx < -90) { petals[i] = newPetal(false); continue; }
      var f = Math.cos(p.flip);      // 翻面：左右壓扁再展開
      f = f < 0 ? Math.min(f, -0.28) : Math.max(f, 0.28);
      var d = p.size * 1.7;
      px.save();
      px.globalAlpha = p.alpha * fade * (f < 0 ? 0.85 : 1);
      px.translate(sx, p.y);
      px.rotate(p.rot);
      px.scale(f, 1);
      px.drawImage(p.img, -d / 2, -d / 2, d, d);
      px.restore();
    }
  }

  /* ---------- 愛心：從點擊處彈出，再慢慢往上飄、淡掉 */
  function burst(x, y) {
    var n = reduce ? 3 : 8;
    for (var i = 0; i < n; i++) {
      var ang = -Math.PI / 2 + rand(-1.2, 1.2);
      var speed = reduce ? 0 : rand(80, 200);
      hearts.push({
        x: x + (reduce ? rand(-18, 18) : rand(-6, 6)),
        y: y + (reduce ? rand(-14, 4) : rand(-4, 4)),
        vx: Math.cos(ang) * speed,
        vy: reduce ? -12 : Math.sin(ang) * speed,
        size: rand(18, 33) * (i === 0 ? 1.15 : 1),
        life: rand(1, 1.6),
        t: 0,
        rot: rand(-0.4, 0.4),
        wob: rand(0, TAU),
        img: pick(heartSprites)
      });
    }
    if (hearts.length > 140) hearts.splice(0, hearts.length - 140);
    start();
  }

  function easeOutBack(k) {
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
  }

  function drawHearts(dt) {
    var drag = Math.exp(-2.4 * dt);
    for (var j = hearts.length - 1; j >= 0; j--) {
      var h = hearts[j];
      h.t += dt;
      if (h.t >= h.life) { hearts.splice(j, 1); continue; }
      if (!reduce) {
        h.vx *= drag;
        h.vy = h.vy * drag - 70 * dt;  // 阻力＋浮力：先彈開，再往上飄
      }
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      var k = h.t / h.life;
      var pop = k < 0.18 ? Math.max(0.2, easeOutBack(k / 0.18)) : 1;
      var alpha = k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45;
      var size = h.size * 1.6 * pop;
      var sway = reduce ? 0 : Math.sin(h.t * 5.5 + h.wob) * 5;
      hx.save();
      hx.globalAlpha = Math.max(0, alpha);
      hx.translate(h.x + sway, h.y);
      hx.rotate(h.rot + (reduce ? 0 : Math.sin(h.t * 4 + h.wob) * 0.14));
      hx.drawImage(h.img, -size / 2, -size / 2, size, size);
      hx.restore();
    }
  }

  /* ---------- 動畫迴圈：沒有東西要動時自動停下，不耗電 */
  function frame(ts) {
    raf = 0;
    var dt = last ? Math.min(0.05, (ts - last) / 1000) : 1 / 60;
    last = ts;
    clock += dt;
    var ease = Math.min(1, dt * 4);
    vis += ((petalsOn ? 1 : 0) - vis) * ease;
    if (!petalsOn && vis < 0.01) vis = 0;
    calm += (calmTarget - calm) * ease;

    px.clearRect(0, 0, W, H);
    if (vis > 0) drawPetals(dt);

    if (hearts.length || heartsOnCanvas) {
      hx.clearRect(0, 0, W, H);
      drawHearts(dt);
      heartsOnCanvas = hearts.length > 0;
    }

    if (petalsOn || vis > 0 || hearts.length) raf = window.requestAnimationFrame(frame);
    else last = 0;
  }

  function start() {
    if (!raf && !document.hidden) raf = window.requestAnimationFrame(frame);
  }

  /* ---------- 點擊（輕點）冒愛心：拖曳、捲動、長按不算 */
  var down = null;
  function onDown(e) {
    if (e.isPrimary === false || (e.button !== undefined && e.button !== 0)) return;
    down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now() };
  }
  function onUp(e) {
    if (!down || e.pointerId !== down.id) return;
    var dx = e.clientX - down.x, dy = e.clientY - down.y, dt = Date.now() - down.t;
    down = null;
    if (dx * dx + dy * dy > 144 || dt > 700) return;
    burst(e.clientX, e.clientY);
  }
  if (window.PointerEvent) {
    var opt = { capture: true, passive: true };
    window.addEventListener('pointerdown', onDown, opt);
    window.addEventListener('pointerup', onUp, opt);
    window.addEventListener('pointercancel', function () { down = null; }, opt);
  } else {
    document.addEventListener('click', function (e) {
      if (e.clientX || e.clientY) burst(e.clientX, e.clientY);
    }, true);
  }

  /* ---------- 在輸入欄位裡打字時，花瓣變淡 */
  function isTextField(el) {
    if (!el || !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return false;
    return !/^(radio|checkbox|button|submit|reset)$/.test(el.type || '');
  }
  document.addEventListener('focusin', function (e) { calmTarget = isTextField(e.target) ? 1 : 0; start(); });
  document.addEventListener('focusout', function () { calmTarget = 0; start(); });

  /* ---------- 開關按鈕 */
  function syncToggle() {
    if (!toggle) return;
    var label = petalsOn ? '關閉花瓣特效' : '開啟花瓣特效';
    toggle.setAttribute('aria-pressed', petalsOn ? 'true' : 'false');
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
  }
  if (toggle) {
    toggle.hidden = false;
    toggle.addEventListener('click', function () {
      petalsOn = !petalsOn;
      try { window.localStorage.setItem(KEY, petalsOn ? 'on' : 'off'); } catch (err) { /* 存不了就算了 */ }
      syncToggle();
      start();
    });
  }

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { last = 0; start(); }
  });

  syncToggle();
  resize();
})();
