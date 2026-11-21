/* Hand-drawn <canvas> charts, devicePixelRatio aware. No libraries. */
(function (root) {
  var COLORS = { blue: "#0a84ff", green: "#00d35a", red: "#ff453a", orange: "#ff9f0a", cyan: "#64d2ff" };
  var reduce = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setup(canvas) {
    var dpr = root.devicePixelRatio || 1;
    var w = canvas.clientWidth || canvas.parentNode.clientWidth || 300;
    var h = canvas.clientHeight || canvas.parentNode.clientHeight || 200;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h };
  }

  function overlaps(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }

  /* Line chart: points [{ts,value}], marks [{ts,label,color}], start = dashed start line value. */
  function line(canvas, opt, progress) {
    var s = setup(canvas), ctx = s.ctx, w = s.w, h = s.h;
    var pts = (opt.points || []).filter(function (p) { return p && p.value != null && isFinite(p.value); });
    if (pts.length === 0) return;
    if (progress != null && progress < 1 && pts.length >= 2) {
      // new point slides in: interpolate the newest point from the previous one
      var a = pts[pts.length - 2], b = pts[pts.length - 1];
      pts = pts.slice(0, -1).concat([{ ts: a.ts + (b.ts - a.ts) * progress, value: a.value + (b.value - a.value) * progress }]);
    }
    var padT = 46, padB = 12, padX = 16;
    var t0 = pts[0].ts, t1 = pts[pts.length - 1].ts;
    if (opt.t0 != null && opt.t0 < t0) t0 = opt.t0;
    if (t1 === t0) t1 = t0 + 1;
    var lo = Infinity, hi = -Infinity;
    pts.forEach(function (p) { lo = Math.min(lo, p.value); hi = Math.max(hi, p.value); });
    if (opt.start != null) { lo = Math.min(lo, opt.start); hi = Math.max(hi, opt.start); }
    if (hi === lo) { hi += 1; lo -= 1; }
    var X = function (t) { return padX + (w - 2 * padX) * (t - t0) / (t1 - t0); };
    var Y = function (v) { return padT + (h - padT - padB) * (1 - (v - lo) / (hi - lo)); };
    var color = opt.color || COLORS.green;

    if (opt.start != null) {
      ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = "rgba(235,235,245,0.3)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, Y(opt.start)); ctx.lineTo(w, Y(opt.start)); ctx.stroke(); ctx.restore();
    }
    // gradient under the line
    var grad = ctx.createLinearGradient(0, padT, 0, h);
    grad.addColorStop(0, "rgba(0,211,90,0.28)"); grad.addColorStop(1, "rgba(0,211,90,0)");
    ctx.beginPath();
    pts.forEach(function (p, i) { var x = X(p.ts), y = Y(p.value); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    if (pts.length === 1) ctx.lineTo(X(pts[0].ts) + 1, Y(pts[0].value));
    ctx.lineTo(X(pts[pts.length - 1].ts), h); ctx.lineTo(X(pts[0].ts), h); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath();
    pts.forEach(function (p, i) { var x = X(p.ts), y = Y(p.value); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke();
    var last = pts[pts.length - 1];
    ctx.beginPath(); ctx.arc(X(last.ts), Y(last.value), 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();

    // marks above the line; a later mark moves up a row, never overlaps
    var placed = [];
    function valueAt(t) {
      for (var i = 1; i < pts.length; i++) if (pts[i].ts >= t) {
        var a = pts[i - 1], b = pts[i], f = (t - a.ts) / ((b.ts - a.ts) || 1);
        return a.value + (b.value - a.value) * f;
      }
      return pts[pts.length - 1].value;
    }
    ctx.font = "600 11px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textBaseline = "middle";
    (opt.marks || []).slice().sort(function (a, b) { return a.ts - b.ts; }).forEach(function (m) {
      if (m.ts < t0 || m.ts > t1 + 1) return;
      var x = X(m.ts), yl = Y(valueAt(m.ts));
      var tw = ctx.measureText(m.label).width + 12, bh = 18;
      var bx = Math.max(2, Math.min(w - tw - 2, x - tw / 2));
      var r = 0, rect;
      for (; r < 12; r++) {
        rect = { x: bx, y: yl - 12 - bh - r * (bh + 3), w: tw, h: bh };
        if (!placed.some(function (p) { return overlaps(p, rect); })) break;
      }
      placed.push(rect);
      var c = COLORS[m.color] || m.color || COLORS.blue;
      ctx.strokeStyle = c; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, rect.y + bh); ctx.lineTo(x, yl - 3); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = c; roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 9); ctx.fill();
      ctx.fillStyle = m.color === "green" || m.color === "orange" ? "#000" : "#fff";
      ctx.fillText(m.label, rect.x + 6, rect.y + bh / 2 + 0.5);
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /* Animated line: slides the newest point in over 250ms when one was appended. */
  var lastLen = new WeakMap();
  function lineAnimated(canvas, opt) {
    var n = (opt.points || []).length, prev = lastLen.get(canvas);
    lastLen.set(canvas, n);
    if (reduce || prev == null || n !== prev + 1) return line(canvas, opt);
    var t0 = performance.now();
    (function frame(now) {
      var p = Math.min(1, (now - t0) / 250);
      line(canvas, opt, 1 - Math.pow(1 - p, 3));
      if (p < 1) root.requestAnimationFrame(frame);
    })(t0);
  }

  /* 1-minute candles + orange dashed exit line. */
  function candles(canvas, opt) {
    var s = setup(canvas), ctx = s.ctx, w = s.w, h = s.h;
    var cs = (opt.candles || []).slice(-90);
    if (!cs.length) return;
    var lo = Infinity, hi = -Infinity;
    cs.forEach(function (c) { lo = Math.min(lo, c.low); hi = Math.max(hi, c.high); });
    if (opt.exit != null) { lo = Math.min(lo, opt.exit); hi = Math.max(hi, opt.exit); }
    if (opt.entry != null) { lo = Math.min(lo, opt.entry); hi = Math.max(hi, opt.entry); }
    if (hi === lo) { hi *= 1.01; lo *= 0.99; if (hi === lo) { hi += 1; } }
    var padT = 12, padB = 12, padX = 16;
    var Y = function (v) { return padT + (h - padT - padB) * (1 - (v - lo) / (hi - lo)); };
    var step = (w - 2 * padX) / Math.max(cs.length, 20), bw = Math.max(2, step * 0.6);
    cs.forEach(function (c, i) {
      var x = padX + step * i + step / 2, up = c.close >= c.open;
      ctx.strokeStyle = ctx.fillStyle = up ? COLORS.green : COLORS.red;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, Y(c.high)); ctx.lineTo(x, Y(c.low)); ctx.stroke();
      var y1 = Y(Math.max(c.open, c.close)), y2 = Y(Math.min(c.open, c.close));
      ctx.fillRect(x - bw / 2, y1, bw, Math.max(1, y2 - y1));
    });
    if (opt.exit != null) {
      ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = COLORS.orange; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, Y(opt.exit)); ctx.lineTo(w, Y(opt.exit)); ctx.stroke(); ctx.restore();
    }
  }

  /* Score ring 0-100, green from 70. */
  function ring(canvas, score) {
    var s = setup(canvas), ctx = s.ctx, r = Math.min(s.w, s.h) / 2 - 4;
    ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.strokeStyle = "#2c2c2e"; ctx.beginPath(); ctx.arc(s.w / 2, s.h / 2, r, 0, Math.PI * 2); ctx.stroke();
    if (score == null) return;
    ctx.strokeStyle = score >= 70 ? COLORS.green : (score >= 50 ? COLORS.orange : COLORS.red);
    ctx.beginPath(); ctx.arc(s.w / 2, s.h / 2, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(100, score)) / 100); ctx.stroke();
  }

  root.Charts = { line: line, lineAnimated: lineAnimated, candles: candles, ring: ring };
})(window);
