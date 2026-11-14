// Rahul J.: paper-grid runtime (DesignForge). Vanilla, no dependencies.
function installPaperSite(doc) {
  var win = doc.defaultView || window;
  var root = doc.documentElement;
  var reduced = !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var DPR = Math.min(win.devicePixelRatio || 1, 2);
  root.classList.add('pp-js');
  var BANDS = [[0.27, '#1c2541'], [0.4, '#3b5bd9'], [0.52, '#f5c518'], [0.62, '#e0492a'], [2, '#d8ff00']];
  var PAL = ['#1c2541', '#3b5bd9', '#f5c518', '#e0492a', '#d8ff00'];
  function band(v) { for (var i = 0; i < BANDS.length; i++) if (v < BANDS[i][0]) return BANDS[i][1]; return BANDS[BANDS.length - 1][1]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function hash(c, r, s) { var n = Math.sin(c * 127.1 + r * 311.7 + s * 0.13) * 43758.5453; return n - Math.floor(n); }
  function seedOf(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % 997; }
  function noise(nx, ny, t, s) {
    nx += Math.sin(ny * 5 + t * 0.5 + s) * 0.05; ny += Math.cos(nx * 5 - t * 0.4) * 0.05;
    var v = Math.sin(nx * 5.6 + s * 1.3 + t * 0.3) * Math.cos(ny * 4.7 - s * 0.7 + t * 0.22) + Math.sin((nx * 1.4 + ny * 1.7) * 4.1 - s + t * 0.16) + Math.sin(ny * 9 + s * 2.1 + nx * 3) * 0.5 + Math.sin(nx * 13 - s * 1.7) * 0.28;
    return 0.5 + 0.5 * (v / 2.55);
  }

  /* ---------- Pixel fields ---------- */
  var fields = [];
  function makeField(cv, kind, o) {
    var ctx = cv.getContext('2d');
    if (!ctx) return null;
    var f = { cv: cv, kind: kind, visible: false, cell: o.cell, seed: o.seed, variant: o.variant || 0, W: 0, H: 0, cols: 0, rows: 0, heat: null, mx: -1, my: -1, pmx: -1, pmy: 0, scroll: 0, born: 0, hover: false, phase: 0, idle: 0, pac: null };
    f.resize = function () {
      var r = cv.getBoundingClientRect();
      f.W = Math.max(1, r.width); f.H = Math.max(1, r.height);
      cv.width = Math.round(f.W * DPR); cv.height = Math.round(f.H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      f.cols = Math.ceil(f.W / f.cell) + 1; f.rows = Math.ceil(f.H / f.cell) + 1;
      f.heat = new Float32Array(f.cols * f.rows);
      f.draw(f.lastT || 0, true);
    };
    f.dep = function (x, y, amt, sig) {
      var cc = x / f.cell, cr = y / f.cell, rad = Math.ceil(sig * 1.6), inv = 1 / (2 * sig * sig * 0.18);
      for (var dr = -rad; dr <= rad; dr++) for (var dc = -rad; dc <= rad; dc++) {
        var c = (cc + dc) | 0, r = (cr + dr) | 0;
        if (c < 0 || r < 0 || c >= f.cols || r >= f.rows) continue;
        var dx = c + 0.5 - cc, dy = r + 0.5 - cr, w = Math.exp(-(dx * dx + dy * dy) * inv);
        if (w < 0.02) continue;
        var id = r * f.cols + c, v = f.heat[id] + amt * w; f.heat[id] = v > 1 ? 1 : v;
      }
    };
    f.follow = function (x, y, sig) {
      if (f.pmx < 0) { f.pmx = x; f.pmy = y; }
      var dx = x - f.pmx, dy = y - f.pmy, dl = Math.sqrt(dx * dx + dy * dy), steps = Math.max(1, Math.min(40, Math.round(dl / (f.cell * 0.8))));
      for (var s = 1; s <= steps; s++) { var q = s / steps; f.dep(f.pmx + dx * q, f.pmy + dy * q, 0.16, sig); }
      f.pmx = x; f.pmy = y; f.idle = 0;
    };
    /* A chomping disk that eats a row of pellets while the pointer is idle. */
    f.pacman = function () {
      var rad = f.cell * 3.4;
      if (!f.pac) { var dir = Math.random() < 0.5 ? 1 : -1; f.pac = { x: dir > 0 ? -rad : f.W + rad, y: f.H * (0.45 + Math.random() * 0.4), dir: dir, age: 0, start: 0 }; f.pac.start = f.pac.x; }
      var p = f.pac; p.age++; p.x += p.dir * 2.6;
      if (p.x > f.W + rad + 12 || p.x < -rad - 12) { f.pac = null; return; }
      var pr = Math.round(p.y / f.cell), k, px, pc;
      for (k = 1; k <= 90; k++) { px = p.start + p.dir * f.cell * 3.4 * k; if (px < -20 || px > f.W + 20) continue; if (p.dir * (px - p.x) > rad * 0.7) { pc = Math.round(px / f.cell); if (pc >= 0 && pr >= 0 && pc < f.cols && pr < f.rows && f.heat[pr * f.cols + pc] < 0.7) f.heat[pr * f.cols + pc] = 0.7; } }
      var mouth = 0.05 + 0.6 * Math.abs(Math.sin(p.age * 0.16)), ang = p.dir > 0 ? 0 : Math.PI;
      var c0 = Math.floor((p.x - rad) / f.cell), c1 = Math.ceil((p.x + rad) / f.cell), r0 = Math.floor((p.y - rad) / f.cell), r1 = Math.ceil((p.y + rad) / f.cell);
      for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
        if (c < 0 || r < 0 || c >= f.cols || r >= f.rows) continue;
        var dx = (c + 0.5) * f.cell - p.x, dy = (r + 0.5) * f.cell - p.y;
        if (dx * dx + dy * dy > rad * rad) continue;
        var da = Math.abs((((Math.atan2(dy, dx) - ang) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
        if (da < mouth) continue;
        var id = r * f.cols + c; if (f.heat[id] < 0.72) f.heat[id] = 0.72;
      }
    };
    f.draw = function (t, once) {
      f.lastT = t;
      var cols = f.cols, rows = f.rows, cell = f.cell, heat = f.heat, s = f.seed, kind2 = f.kind;
      ctx.clearRect(0, 0, f.W, f.H);
      if (!heat) return;
      var intro = once || reduced ? 1 : clamp((t - f.born) / 1.6, 0, 1);
      if (kind2 === 'hero' && !reduced && !once) { f.idle++; if (f.idle > 150 && !f.hover) f.pacman(); else if (f.idle <= 150) f.pac = null; }
      var fade = kind2 === 'hero' ? 1 - clamp(f.scroll * 1.15, 0, 1) : 1;
      if (fade <= 0.01) { for (var z = 0; z < heat.length; z++) heat[z] *= 0.9; if (!once) return; }
      var size = cell - 2;
      for (var r = 0; r < rows; r++) {
        var ny = r / rows;
        for (var c = 0; c < cols; c++) {
          var nx = c / cols, id = r * cols + c, hv = heat[id], v, p;
          if (kind2 === 'hero') {
            var n = noise(nx, ny, t, s);
            var cy = 0.64 + 0.1 * Math.sin(nx * 4.2 + s) + 0.05 * Math.sin(nx * 11 - t * 0.35);
            var wd = 0.2 + 0.07 * Math.sin(nx * 3 + s * 2);
            var env = Math.exp(-Math.pow((ny - cy) / wd, 2)) * sstep(0.28, 0.46, ny);
            p = env * (0.04 + 0.62 * n * n) * (f.W < 600 ? 1.7 : 1) * fade * (nx < intro * 1.25 ? 1 : 0);
            v = n * 0.55 + env * 0.1 + nx * 0.1 - 0.06;
          } else if (kind2 === 'flow') {
            var wob = f.variant ? 0.9 : 1.1;
            var cy2 = 0.5 + 0.12 * Math.sin(nx * 4.4 + s) * wob + 0.04 * Math.sin(nx * 13 + t * 0.3);
            var w2 = 0.12 + 0.2 * sstep(0, 0.45, nx) * (1 - 0.55 * sstep(0.7, 1, nx)) + 0.05 * Math.sin(nx * 7 + s);
            var env2 = Math.exp(-Math.pow((ny - cy2) / w2, 2));
            var n2 = noise(nx * 1.2, ny * 1.2, t * 0.5, s);
            var dens = (0.28 + 0.72 * sstep(0, 0.5, nx)) * env2 * (0.5 + 0.8 * n2);
            p = dens * (nx < intro * 1.1 ? 1 : 0);
            v = nx * 0.78 + (n2 - 0.5) * 0.22;
            if (nx > 0.72 && ny > cy2 + w2 * 0.9 && ny < cy2 + w2 * 2 && hash(c, r, s + 3) < 0.05) { p = 1; v = 0.7; }
          } else { v = 0; p = 0; }
          if (hv > 0.02) { p = Math.max(p, hv * 1.15); v = Math.max(v, 0.3 + hv * 0.5); }
          if (p <= 0.02) continue;
          if (hash(c, r, s) >= p) continue;
          ctx.fillStyle = band(v);
          ctx.fillRect(c * cell + 1, r * cell + 1, size, size);
        }
      }
      if (!once && !reduced) for (var h2 = 0; h2 < heat.length; h2++) heat[h2] *= 0.93;
    };
    cv.__pp = f; fields.push(f);
    return f;
  }

  /* Plate art for work cards: deterministic from the item's own id. */
  function makePlate(cv) {
    var seed = seedOf(cv.getAttribute('data-seed') || 'x');
    var ctx = cv.getContext('2d'); if (!ctx) return null;
    var f = { cv: cv, kind: 'plate', visible: false, hover: false, phase: 0, W: 0, H: 0, drawn: false };
    var shape = seed % 3, cell = 12;
    var order = [seed % 5, (seed + 2) % 5, (seed + 3) % 5];
    var dark = seed % 4 === 1;
    f.resize = function () {
      var r = cv.getBoundingClientRect(); f.W = Math.max(1, r.width); f.H = Math.max(1, r.height);
      cv.width = Math.round(f.W * DPR); cv.height = Math.round(f.H * DPR); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); f.draw(0, true);
    };
    f.draw = function (t, once) {
      var cols = Math.ceil(f.W / cell), rows = Math.ceil(f.H / cell);
      ctx.fillStyle = dark ? '#1c2541' : '#f1f1ec'; ctx.fillRect(0, 0, f.W, f.H);
      var ph = f.phase;
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        var nx = c / cols, ny = r / rows, v;
        if (shape === 0) { var dx = (nx - 0.5) * (f.W / f.H), dy = ny - 0.5, d = Math.sqrt(dx * dx + dy * dy); v = 1 - Math.abs(d - (0.3 + 0.04 * Math.sin(ph * 2 + nx * 8))) * 5; }
        else if (shape === 1) { v = 0.5 + 0.5 * Math.sin((nx * 1.4 + ny) * 9 - ph * 2.4 + seed); v = v * (0.35 + 0.65 * Math.sin(nx * 3.1 + seed) * Math.sin(nx * 3.1 + seed)); }
        else { var a = Math.exp(-(Math.pow(nx - 0.32 - 0.04 * Math.sin(ph + seed), 2) + Math.pow(ny - 0.55, 2)) * 14), b = Math.exp(-(Math.pow(nx - 0.7, 2) + Math.pow(ny - 0.4 + 0.04 * Math.cos(ph * 1.3), 2)) * 18); v = a + b * 0.9; }
        v += (noise(nx, ny, ph * 0.4, seed) - 0.5) * 0.35;
        if (v <= 0.12) continue;
        if (hash(c, r, seed) > v * 1.25) continue;
        var k = v > 0.8 ? 2 : v > 0.5 ? 1 : 0;
        ctx.fillStyle = PAL[order[k]];
        ctx.fillRect(c * cell + 1, r * cell + 1, cell - 2, cell - 2);
      }
    };
    cv.__pp = f; fields.push(f);
    return f;
  }

  var heroF = null, heroEl = doc.querySelector('.pp-hero');
  Array.prototype.forEach.call(doc.querySelectorAll('[data-pp-field]'), function (cv, i) {
    var kind = cv.getAttribute('data-pp-field');
    var f = makeField(cv, kind, { cell: kind === 'hero' ? 9 : 11, seed: Math.random() * 900 + i * 7, variant: parseInt(cv.getAttribute('data-variant') || '0', 10) });
    if (f && kind === 'hero') heroF = f;
  });
  Array.prototype.forEach.call(doc.querySelectorAll('[data-pp-plate]'), function (cv) { makePlate(cv); });

  function resizeAll() { fields.forEach(function (f) { f.resize(); }); }
  var lastW = win.innerWidth;
  win.addEventListener('resize', function () { if (win.innerWidth !== lastW) { lastW = win.innerWidth; resizeAll(); } });
  resizeAll();

  if ('IntersectionObserver' in win) {
    var vio = new IntersectionObserver(function (es) { es.forEach(function (e) { var f = e.target.__pp; if (f) { f.visible = e.isIntersecting; if (e.isIntersecting && f.born === 0) f.born = (win.performance.now() / 1000); } }); }, { rootMargin: '80px' });
    fields.forEach(function (f) { vio.observe(f.cv); });
  } else fields.forEach(function (f) { f.visible = true; f.born = 0.0001; });

  /* Pointer: hero field follows the cursor; cards animate while hovered. */
  if (heroF && heroEl) {
    var onMove = function (e) { var r = heroF.cv.getBoundingClientRect(); heroF.follow(e.clientX - r.left, e.clientY - r.top, 5.5); };
    heroEl.addEventListener('pointermove', onMove, { passive: true });
    heroEl.addEventListener('pointerenter', function () { heroF.hover = true; });
    heroEl.addEventListener('pointerleave', function () { heroF.hover = false; heroF.pmx = -1; });
    heroEl.addEventListener('pointerdown', function (e) { var r = heroF.cv.getBoundingClientRect(); for (var i = 0; i < 6; i++) heroF.dep(e.clientX - r.left + (Math.random() - 0.5) * 60, e.clientY - r.top + (Math.random() - 0.5) * 60, 0.9, 4); });
  }
  Array.prototype.forEach.call(doc.querySelectorAll('.pp-slide'), function (sl) {
    var cv = sl.querySelector('canvas'); var f = cv && cv.__pp; if (!f) return;
    sl.addEventListener('pointerenter', function () { f.hover = true; }); sl.addEventListener('pointerleave', function () { f.hover = false; });
    sl.addEventListener('focusin', function () { f.hover = true; }); sl.addEventListener('focusout', function () { f.hover = false; });
  });

  /* ---------- Footer: falling pixel blocks that stack and melt ---------- */
  var tetCv = doc.querySelector('[data-pp-tetris]'), tet = null;
  if (tetCv) {
    var tctx = tetCv.getContext('2d');
    var SHAPES = [[[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0], [1, 1]], [[1, 0], [2, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [1, 1], [2, 1]], [[0, 0], [0, 1], [1, 1], [2, 1]], [[2, 0], [0, 1], [1, 1], [2, 1]]];
    tet = { visible: false, kind: 'tetris', cell: 14, cols: 0, rows: 0, grid: null, piece: null, magnet: -1, acc: 0, melt: 0 };
    var rot = function (cells) { var out = cells.map(function (p) { return [-p[1], p[0]]; }); var mx = Math.min.apply(null, out.map(function (p) { return p[0]; })), my = Math.min.apply(null, out.map(function (p) { return p[1]; })); return out.map(function (p) { return [p[0] - mx, p[1] - my]; }); };
    tet.spawn = function () {
      var cells = SHAPES[(Math.random() * SHAPES.length) | 0]; var n = (Math.random() * 4) | 0; while (n--) cells = rot(cells);
      var w = Math.max.apply(null, cells.map(function (p) { return p[0]; })) + 1;
      var x = tet.magnet >= 0 && Math.random() < 0.7 ? clamp(tet.magnet - ((w / 2) | 0), 0, tet.cols - w) : (Math.random() * (tet.cols - w + 1)) | 0;
      tet.piece = { cells: cells, x: x, y: -2, col: 1 + ((Math.random() * 5) | 0) };
    };
    tet.fits = function (cells, x, y) { for (var i = 0; i < cells.length; i++) { var cx = x + cells[i][0], cy = y + cells[i][1]; if (cx < 0 || cx >= tet.cols || cy >= tet.rows) return false; if (cy >= 0 && tet.grid[cy * tet.cols + cx]) return false; } return true; };
    tet.lock = function () {
      var p = tet.piece; p.cells.forEach(function (q) { var cy = p.y + q[1]; if (cy >= 0) tet.grid[cy * tet.cols + p.x + q[0]] = p.col; });
      for (var r = tet.rows - 1; r >= 0; r--) { var full = true; for (var c = 0; c < tet.cols; c++) if (!tet.grid[r * tet.cols + c]) { full = false; break; } if (full) { for (var rr = r; rr > 0; rr--) for (var cc = 0; cc < tet.cols; cc++) tet.grid[rr * tet.cols + cc] = tet.grid[(rr - 1) * tet.cols + cc]; for (var c2 = 0; c2 < tet.cols; c2++) tet.grid[c2] = 0; r++; } }
      tet.piece = null;
    };
    tet.height = function () { for (var r = 0; r < tet.rows; r++) for (var c = 0; c < tet.cols; c++) if (tet.grid[r * tet.cols + c]) return tet.rows - r; return 0; };
    tet.step = function () {
      if (tet.melt > 0) { tet.melt--; for (var r = tet.rows - 1; r > 0; r--) for (var c = 0; c < tet.cols; c++) tet.grid[r * tet.cols + c] = tet.grid[(r - 1) * tet.cols + c]; for (var c3 = 0; c3 < tet.cols; c3++) tet.grid[c3] = 0; return; }
      if (!tet.piece) { tet.spawn(); return; }
      var p = tet.piece;
      if (tet.magnet >= 0) { var mid = p.x + 1, dir = tet.magnet > mid ? 1 : tet.magnet < mid ? -1 : 0; if (dir && Math.random() < 0.55 && tet.fits(p.cells, p.x + dir, p.y)) p.x += dir; }
      if (tet.fits(p.cells, p.x, p.y + 1)) p.y++;
      else { if (p.y < 0) { tet.melt = tet.rows; tet.piece = null; return; } tet.lock(); if (tet.height() > tet.rows * 0.62) tet.melt = (tet.rows * 0.5) | 0; }
    };
    tet.resize = function () {
      var r = tetCv.getBoundingClientRect(); var W = Math.max(1, r.width), H = Math.max(1, r.height);
      tetCv.width = Math.round(W * DPR); tetCv.height = Math.round(H * DPR); tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      tet.W = W; tet.H = H; tet.cell = W < 560 ? 11 : 14; tet.cols = Math.floor(W / tet.cell); tet.rows = Math.floor(H / tet.cell);
      tet.grid = new Uint8Array(tet.cols * tet.rows); tet.piece = null;
      { var fill = reduced ? 70 : 16; for (var i = 0; i < fill; i++) { tet.spawn(); while (tet.piece && tet.fits(tet.piece.cells, tet.piece.x, tet.piece.y + 1)) tet.piece.y++; if (tet.piece) tet.lock(); } }
      tet.draw();
    };
    tet.draw = function () {
      tctx.clearRect(0, 0, tet.W, tet.H); var cell = tet.cell, ox = ((tet.W - tet.cols * cell) / 2) | 0, oy = tet.H - tet.rows * cell;
      for (var r = 0; r < tet.rows; r++) for (var c = 0; c < tet.cols; c++) { var v = tet.grid[r * tet.cols + c]; if (!v) continue; tctx.fillStyle = PAL[v - 1]; tctx.fillRect(ox + c * cell + 1, oy + r * cell + 1, cell - 2, cell - 2); }
      if (tet.piece) { tctx.fillStyle = PAL[tet.piece.col - 1]; tet.piece.cells.forEach(function (q) { var y = tet.piece.y + q[1]; if (y >= 0) tctx.fillRect(ox + (tet.piece.x + q[0]) * cell + 1, oy + y * cell + 1, cell - 2, cell - 2); }); }
    };
    tetCv.addEventListener('pointermove', function (e) { var r = tetCv.getBoundingClientRect(); tet.magnet = clamp(Math.floor((e.clientX - r.left) / tet.cell), 0, tet.cols - 1); }, { passive: true });
    tetCv.addEventListener('pointerleave', function () { tet.magnet = -1; });
    tetCv.addEventListener('pointerdown', function () { if (tet.piece) while (tet.fits(tet.piece.cells, tet.piece.x, tet.piece.y + 1)) tet.piece.y++; });
    tetCv.__pp = tet; tet.resize();
    win.addEventListener('resize', function () { tet.resize(); });
    if ('IntersectionObserver' in win) new IntersectionObserver(function (es) { tet.visible = es[0].isIntersecting; }).observe(tetCv); else tet.visible = true;
  }

  /* ---------- Frame loop (about 30 fps, only for what is on screen) ---------- */
  var last = 0, tetAcc = 0;
  function frame(ts) {
    win.requestAnimationFrame(frame);
    if (doc.hidden || ts - last < 33) return;
    var dt = ts - last; last = ts; var t = ts / 1000;
    if (heroF && heroEl) { var hr = heroEl.getBoundingClientRect(); heroF.scroll = clamp(-hr.top / Math.max(1, hr.height), 0, 1); }
    fields.forEach(function (f) {
      if (!f.visible) return;
      if (f.kind === 'plate') { if (f.hover) { f.phase += 0.06; f.draw(t); f.drawn = true; } else if (!f.drawn) { f.draw(t, true); f.drawn = true; } return; }
      if (f.kind === 'tetris') return;
      f.draw(t, false);
    });
    if (tet && tet.visible) { tetAcc += dt; while (tetAcc > 70) { tetAcc -= 70; tet.step(); } tet.draw(); }
  }
  if (!reduced) win.requestAnimationFrame(frame);

  /* ---------- Headline decode ---------- */
  var h1 = doc.querySelector('[data-pp-decode]');
  if (h1 && !reduced) {
    var GL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#+=/';
    Array.prototype.forEach.call(h1.querySelectorAll('.pp-ln > span'), function (sp, li) {
      var finalText = sp.textContent, w = sp.getBoundingClientRect().width, start = win.performance.now() + 150 + li * 170, dur = 950;
      sp.style.minWidth = w + 'px'; sp.textContent = finalText.replace(/[^ ]/g, ' ');
      (function tick(now) {
        var p = (now - start) / dur;
        if (p < 0) { win.requestAnimationFrame(tick); return; }
        if (p >= 1) { sp.textContent = finalText; sp.style.minWidth = ''; return; }
        var out = ''; for (var i = 0; i < finalText.length; i++) { var ch = finalText.charAt(i); out += ch === ' ' || i / finalText.length < p * 1.1 - 0.05 ? ch : GL.charAt((Math.random() * GL.length) | 0); }
        sp.textContent = out; win.requestAnimationFrame(tick);
      })(win.performance.now());
    });
  }

  /* ---------- Status line: typed once, then the load readout stays live ---------- */
  var st = doc.querySelector('[data-pp-status] .pp-status-t'), stWrap = doc.querySelector('[data-pp-status]');
  var load = 42.4;
  function setLoad() { Array.prototype.forEach.call(doc.querySelectorAll('[data-pp-load]'), function (b) { b.textContent = load.toFixed(1); }); }
  if (st && !reduced) {
    var html = st.innerHTML, full = st.textContent, i = 0;
    st.textContent = ''; stWrap.classList.add('is-typing');
    var timer = win.setInterval(function () { i++; st.textContent = full.slice(0, i); if (i >= full.length) { win.clearInterval(timer); st.innerHTML = html; stWrap.classList.remove('is-typing'); setLoad(); } }, 20);
  }
  if (!reduced) win.setInterval(function () { load = 38 + Math.random() * 24; setLoad(); }, 2500);

  /* ---------- Reveal on scroll ---------- */
  Array.prototype.forEach.call(doc.querySelectorAll('.pp-lead .pp-w'), function (w, i) { w.style.setProperty('--i', i); });
  var revealEls = doc.querySelectorAll('.pp-r, .pp-lead');
  if ('IntersectionObserver' in win && !reduced) {
    var rio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); } }); }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    Array.prototype.forEach.call(revealEls, function (el) { rio.observe(el); });
  } else Array.prototype.forEach.call(revealEls, function (el) { el.classList.add('in'); });

  /* ---------- Chip nav: scrolled state, current section, progress meter ---------- */
  var chip = doc.querySelector('.pp-chip'), meter = doc.querySelector('.pp-meter span');
  var links = Array.prototype.slice.call(doc.querySelectorAll('.pp-chip-link'));
  var ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    win.requestAnimationFrame(function () {
      ticking = false; var y = win.pageYOffset || root.scrollTop;
      if (chip) chip.classList.toggle('is-scrolled', y > 40);
      var max = Math.max(1, root.scrollHeight - win.innerHeight); if (meter) meter.style.setProperty('--sp', clamp(y / max, 0, 1).toFixed(4));
    });
  }
  win.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  if ('IntersectionObserver' in win) {
    var map = {}; links.forEach(function (a) { map[(a.getAttribute('href') || '').slice(1)] = a; });
    var cio = new IntersectionObserver(function (es) { es.forEach(function (e) { var a = map[e.target.id]; if (!a) return; if (e.isIntersecting) { links.forEach(function (l) { l.removeAttribute('aria-current'); }); a.setAttribute('aria-current', 'true'); } }); }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(map).forEach(function (id) { var el = doc.getElementById(id); if (el) cio.observe(el); });
  }

  /* ---------- Process steps: a pixel line that follows the pointer ---------- */
  Array.prototype.forEach.call(doc.querySelectorAll('[data-pp-step]'), function (el) {
    el.addEventListener('pointermove', function (e) { var r = el.getBoundingClientRect(); el.style.setProperty('--lx', clamp(e.clientX - r.left - 31, 0, r.width - 62).toFixed(0) + 'px'); }, { passive: true });
  });

  /* ---------- Carousel ---------- */
  var track = doc.querySelector('[data-pp-track]');
  if (track) {
    var slides = Array.prototype.slice.call(track.querySelectorAll('[data-pp-slide]'));
    var countEl = doc.querySelector('[data-pp-count]'), idx = 0, lockUntil = 0, drag = null, moved = false;
    var two = function (n) { return (n < 10 ? '0' : '') + n; };
    function show(i) { idx = clamp(i, 0, slides.length - 1); track.setAttribute('data-index', String(idx)); slides.forEach(function (s, k) { if (k === idx) s.setAttribute('aria-current', 'true'); else s.removeAttribute('aria-current'); }); if (countEl) countEl.textContent = two(idx + 1) + ' / ' + two(slides.length); }
    function go(i) {
      show(i); lockUntil = win.performance.now() + 700;
      var target = slides[idx].offsetLeft - slides[0].offsetLeft;
      if (track.scrollTo) track.scrollTo({ left: target, behavior: reduced ? 'auto' : 'smooth' }); else track.scrollLeft = target;
    }
    function fromScroll() { if (win.performance.now() < lockUntil) return; var best = 0, bd = 1e9; slides.forEach(function (s, k) { var d = Math.abs((s.offsetLeft - slides[0].offsetLeft) - track.scrollLeft); if (d < bd) { bd = d; best = k; } }); if (best !== idx) show(best); }
    track.addEventListener('scroll', fromScroll, { passive: true });
    var nextB = doc.querySelector('[data-pp-next]'), prevB = doc.querySelector('[data-pp-prev]');
    if (nextB) nextB.addEventListener('click', function () { go(idx + 1); });
    if (prevB) prevB.addEventListener('click', function () { go(idx - 1); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
      else if (e.key === 'Home') { e.preventDefault(); go(0); } else if (e.key === 'End') { e.preventDefault(); go(slides.length - 1); }
    });
    track.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse' || e.button !== 0) return; drag = { x: e.clientX, left: track.scrollLeft }; moved = false; });
    win.addEventListener('pointermove', function (e) { if (!drag) return; var dx = e.clientX - drag.x; if (Math.abs(dx) > 4) { moved = true; track.classList.add('is-drag'); } if (moved) track.scrollLeft = drag.left - dx; });
    win.addEventListener('pointerup', function () { if (!drag) return; var was = moved; drag = null; track.classList.remove('is-drag'); if (was) { lockUntil = 0; fromScroll(); go(idx); } });
    track.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    show(0);
  }

  /* ---------- Footer year ---------- */
  Array.prototype.forEach.call(doc.querySelectorAll('[data-pp-year]'), function (el) { el.textContent = String(new Date().getFullYear()); });

  win.requestAnimationFrame(function () { root.classList.add('pp-ready'); });
}

installPaperSite(document);
