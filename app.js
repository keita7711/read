/* FOMO desk app · STEP 10. Plain JS. Never shows a made-up number: missing = "—". No secrets live in this file. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var BOTS = ["scanner", "analyst", "brain", "executor", "risk"];
  var BOT_COLOR = { scanner: "#64d2ff", analyst: "#ffd60a", brain: "#bf5af2", executor: "#00d35a", risk: "#ff6b9a" };
  var cap = function (s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ---------- config: #t=TOKEN&api=BASE&snap=BASE&tab=… -> localStorage, then cleaned from the URL ---------- */
  var cfg = { token: localStorage.getItem("desk.t") || "", api: localStorage.getItem("desk.api") || "", snap: localStorage.getItem("desk.snap") || "" };
  var startTab = "home";
  (function () {
    var h = location.hash.replace(/^#/, ""); if (!h) return;
    var p = new URLSearchParams(h);
    if (p.get("t")) { cfg.token = p.get("t"); localStorage.setItem("desk.t", cfg.token); }
    if (p.has("api")) { cfg.api = p.get("api"); localStorage.setItem("desk.api", cfg.api); }
    if (p.has("snap")) { cfg.snap = p.get("snap"); localStorage.setItem("desk.snap", cfg.snap); }
    if (p.get("tab")) startTab = p.get("tab");
    history.replaceState(null, "", location.pathname + location.search + (p.get("tab") ? "#tab=" + p.get("tab") : ""));
  })();
  var planB = function () { return !!cfg.snap && !cfg.api; };
  var apiBase = function () { return cfg.api ? cfg.api.replace(/\/+$/, "") + "/api" : "api"; };
  var snapBase = function () { return cfg.snap.replace(/\/+$/, ""); };

  function req(path, opts) {
    opts = opts || {};
    var url = apiBase() + path, headers = { "Accept": "application/json" };
    if (cfg.token) headers.Authorization = "Bearer " + cfg.token;
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    return fetch(url, { method: opts.method || "GET", headers: headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined, cache: "no-store" })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
          if (!r.ok) { var err = new Error((j && j.detail) || ("HTTP " + r.status)); err.status = r.status; throw err; }
          return j;
        });
      });
  }
  function snap(file) {
    return fetch(snapBase() + "/" + file, { cache: "no-store" }).then(function (r) {
      if (!r.ok) { var e = new Error("HTTP " + r.status); e.status = r.status; throw e; } return r.json();
    });
  }
  var get = {
    state: function () { return planB() ? snap("state.json") : req("/state"); },
    chart: function (rg) { return planB() ? snap("chart.json") : req("/chart?range=" + encodeURIComponent(rg)); },
    activity: function (before) { return planB() ? snap("activity.json") : req("/activity" + (before ? "?before=" + before : "")); },
    orders: function () { return planB() ? Promise.resolve(null) : req("/orders"); },
    coin: function (m) { return planB() ? snap("coin/" + encodeURIComponent(m) + ".json") : req("/coin/" + encodeURIComponent(m)); },
    audit: function (m) { return req("/audit/" + encodeURIComponent(m)); },
    decisions: function (n) { return req("/bots/" + n + "/decisions"); },
    account: function () { return req("/account"); }
  };

  /* ---------- formatting (only real values; null -> "—") ---------- */
  var DASH = "—";
  function usd(n, d) {
    if (n == null || !isFinite(n)) return DASH;
    var neg = n < 0; n = Math.abs(+n);
    return (neg ? "-$" : "$") + n.toLocaleString("en-US", { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d });
  }
  function price(n) {
    if (n == null || !isFinite(n)) return DASH;
    if (n >= 1) return usd(n, n >= 1000 ? 0 : 2);
    return "$" + Number(n).toPrecision(4).replace(/0+$/, "").replace(/\.$/, "");
  }
  function pct(n, d) { if (n == null || !isFinite(n)) return DASH; return (n >= 0 ? "+" : "") + Number(n).toFixed(d == null ? 2 : d) + "%"; }
  function compact(n) { if (n == null || !isFinite(n)) return DASH; return n >= 1e6 ? "$" + (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? "$" + (n / 1e3).toFixed(1) + "K" : usd(n, 0); }
  function hm(ts) { if (!ts) return DASH; var d = new Date(ts * 1000); return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }); }
  function hms(ms) { return ms ? new Date(ms).toLocaleTimeString([], { hour12: false }) : DASH; }
  function age(ts) { if (!ts) return null; var s = Date.now() / 1000 - ts; if (s < 3600) return Math.max(1, Math.round(s / 60)) + "m old"; if (s < 86400 * 2) return Math.round(s / 3600) + "h old"; return Math.round(s / 86400) + "d old"; }
  function short(m) { return m ? m.slice(0, 4) + "…" + m.slice(-4) : ""; }

  /* ---------- state ---------- */
  var S = { state: null, chart: null, activity: null, orders: null, account: null, range: "LIVE", lastOk: 0, fails: 0, retryAt: 0, timer: null, sym: {}, decisions: {}, tab: "home" };
  function symOf(m) { return (m && S.sym[m]) || short(m); }
  function learnSymbols() {
    var st = S.state || {};
    (st.positions || []).forEach(function (p) { if (p.symbol) S.sym[p.mint] = p.symbol; });
    ((S.activity && S.activity.rows) || []).forEach(function (r) { var m = /^(?:Bought|Sold|Stopped|Rejected)\s+(.+)$/.exec(r.title || ""); if (r.mint && m && !S.sym[r.mint]) S.sym[r.mint] = m[1]; });
  }

  /* ---------- odometer: changed digits roll 600ms ease-out, 30ms stagger ---------- */
  function odometer(el, text) {
    var chars = text.split(""), cols = $$(".odo-col, .odo-ch", el);
    var same = cols.length === chars.length && chars.every(function (c, i) { return /\d/.test(c) === cols[i].classList.contains("odo-col"); });
    if (!same) {
      el.innerHTML = chars.map(function (c) {
        if (!/\d/.test(c)) return '<span class="odo-ch">' + esc(c) + "</span>";
        var strip = ""; for (var i = 0; i < 10; i++) strip += "<span>" + i + "</span>";
        return '<span class="odo-col"><span class="odo-strip" style="transition:none;transform:translateY(-' + c + 'em)">' + strip + "</span></span>";
      }).join("");
      el.dataset.v = text; return;
    }
    var k = 0;
    chars.forEach(function (c, i) {
      var col = cols[i];
      if (!col.classList.contains("odo-col")) { col.textContent = c; return; }
      var s = col.firstChild, want = "translateY(-" + c + "em)";
      if (s.style.transform !== want) {
        s.style.transition = reduce ? "none" : "transform 600ms ease-out " + (k++ * 30) + "ms";
        s.style.transform = want;
      }
    });
    el.dataset.v = text;
  }

  /* ---------- error / retry ---------- */
  function showError() {
    var row = $("#error-row"), n = Math.max(0, Math.ceil((S.retryAt - Date.now()) / 1000));
    row.textContent = "Desk offline · retrying in " + n + "s · last update " + (S.lastOk ? hms(S.lastOk) : DASH);
    row.classList.remove("hidden");
  }
  setInterval(function () { if (S.fails) showError(); }, 1000);

  function refresh() {
    clearTimeout(S.timer);
    return Promise.all([get.state(), get.chart(S.range), get.activity(), get.orders().catch(function () { return null; })])
      .then(function (res) {
        S.state = res[0]; S.chart = res[1]; S.activity = res[2]; S.orders = res[3];
        S.lastOk = Date.now(); S.fails = 0; $("#error-row").classList.add("hidden");
        learnSymbols(); render();
        S.timer = setTimeout(refresh, planB() ? 15000 : 5000);
      })
      .catch(function () {
        S.fails++;
        var wait = Math.min(30, 5 * Math.pow(2, S.fails - 1));
        S.retryAt = Date.now() + wait * 1000; showError();
        if (!S.state) renderLoading(); // keep skeletons, never a blank screen; keep last good numbers otherwise
        S.timer = setTimeout(refresh, wait * 1000);
      });
  }
  var soon = null;
  function refreshSoon() { clearTimeout(soon); soon = setTimeout(refresh, 300); }

  function startStream() {
    if (planB() || !cfg.token || !window.EventSource) return;
    var es = new EventSource(apiBase() + "/stream?t=" + encodeURIComponent(cfg.token));
    ["order", "balance", "exit", "scan", "score", "size", "audit_layer"].forEach(function (ev) { es.addEventListener(ev, refreshSoon); });
    es.onerror = function () { /* browser retries by itself; polling covers the gap */ };
  }

  /* ---------- render ---------- */
  function renderLoading() {
    if (!$("#bot-carousel").children.length) $("#bot-carousel").innerHTML = BOTS.map(function () { return '<div class="sk sk-bot"></div>'; }).join("");
    if (!$("#home-activity").children.length) $("#home-activity").outerHTML = '<div class="list" id="home-activity" style="background:none">' + '<span class="sk sk-row"></span>'.repeat(3) + "</div>";
    if (!$("#bots-list").children.length) $("#bots-list").innerHTML = '<span class="sk sk-card" style="height:180px"></span>'.repeat(5);
    if (!$("#activity-list").children.length) { $("#activity-list").innerHTML = '<span class="sk sk-row"></span>'.repeat(6); $("#activity-list").style.background = "none"; }
    if (!$("#account-body").children.length) $("#account-body").innerHTML = '<span class="sk sk-card"></span>'.repeat(4) + connectionGroup();
    bindConnection();
  }

  function render() {
    var st = S.state; if (!st) return;
    var live = st.mode === "LIVE";
    $("#paper-badge").classList.toggle("hidden", live);
    odometer($("#balance"), usd(st.balance)); $("#balance").setAttribute("aria-label", usd(st.balance));
    var tp = $("#today-pct");
    tp.innerHTML = st.todayPct == null ? '<span class="muted">' + DASH + " today</span>" : esc(pct(st.todayPct)) + ' <span class="muted">today</span>';
    tp.className = "today num " + (st.todayPct == null ? "" : st.todayPct >= 0 ? "green" : "red");
    var mp = $("#mult-pill");
    if (st.multiplier != null) { mp.textContent = Number(st.multiplier).toFixed(2) + "×"; mp.classList.remove("hidden"); } else mp.classList.add("hidden");
    renderChart(); renderScreenMeta(); renderCarousel(); renderHomeActivity(); renderBotsTab(); renderActivityTab();
    if (S.tab === "account") loadAccount();
    var seen = +localStorage.getItem("desk.seen") || 0, top = ((S.activity && S.activity.rows) || [])[0];
    $("#bell-dot").classList.toggle("hidden", !(top && top.id > seen));
  }

  function nightStartValue() {
    var st = S.state; if (!st || st.multiplier == null || !st.multiplier) return null;
    return st.balance / st.multiplier;
  }
  function renderChart() {
    var c = S.chart, pts = (c && c.points) || [];
    $("#chart-sk").classList.add("hidden");
    $("#chart-empty").classList.toggle("hidden", pts.length > 0);
    var cv = $("#main-chart");
    if (!pts.length) { var x = cv.getContext("2d"); x.clearRect(0, 0, cv.width, cv.height); return; }
    Charts.lineAnimated(cv, { points: pts, marks: (c.marks || []).map(markLabel), start: S.range === "LIVE" ? nightStartValue() : null, t0: S.range === "LIVE" ? S.state.nightStart : null });
  }
  function markLabel(m) {
    var label = m.label;
    if (m.kind === "bought" && !/^Bought/.test(label)) label = "Bought " + label;
    return { ts: m.ts, label: label, color: m.color };
  }

  /* LIVE SCREEN: double-buffered, 1s (plan B 15s) */
  var scr = { front: "a", lastFrame: 0, busy: false };
  function screenTick() {
    if (scr.busy || document.hidden || S.tab !== "home") return;
    scr.busy = true;
    var p = planB() ? fetch(snapBase() + "/screen.jpg?ts=" + Date.now(), { cache: "no-store" })
      : fetch(apiBase() + "/screen.jpg", { headers: cfg.token ? { Authorization: "Bearer " + cfg.token } : {}, cache: "no-store" });
    p.then(function (r) {
      if (!r.ok) throw new Error(r.status);
      var lm = Date.parse(r.headers.get("last-modified") || "");
      return r.blob().then(function (b) { return { b: b, lm: isFinite(lm) ? lm : Date.now() }; });
    }).then(function (o) {
      var back = $("#screen-" + (scr.front === "a" ? "b" : "a")), front = $("#screen-" + scr.front);
      var url = URL.createObjectURL(o.b);
      back.onload = function () {
        back.classList.add("front"); front.classList.remove("front");
        if (front.dataset.url) URL.revokeObjectURL(front.dataset.url);
        back.dataset.url = url; scr.front = scr.front === "a" ? "b" : "a"; scr.url = url;
        $("#screen-none").classList.add("hidden");
      };
      back.src = url; scr.lastFrame = o.lm;
    }).catch(function () {}).then(function () { scr.busy = false; renderScreenAge(); });
  }
  function renderScreenAge() {
    var fresh = scr.lastFrame && Date.now() - scr.lastFrame < 5000;
    $("#screen-dot").className = "sdot " + (fresh ? "red" : "grey");
    $("#screen-age").textContent = fresh ? "Live · Bot's computer" : scr.lastFrame ? "Last frame " + hms(scr.lastFrame) : "No frame yet";
  }
  function lastOrder() {
    if (S.orders && S.orders.rows && S.orders.rows.length) return S.orders.rows[0];
    var ex = S.state && (S.state.bots || []).filter(function (b) { return b.name === "executor"; })[0];
    return ex && ex.last ? Object.assign({ checks: { screen: ex.last.screen_ok, api: ex.last.api_ok, chain: ex.last.chain_ok } }, ex.last) : null;
  }
  function renderScreenMeta() {
    var o = lastOrder(), lane = $("#screen-lane");
    if (o && (o.status === "clicking" || o.status === "verifying")) {
      var who = o.bot === "risk" || (o.side === "sell" && /stop|risk/i.test(o.reason || "")) ? "risk" : "executor";
      lane.textContent = cap(who) + " · " + (o.side === "buy" ? "buying" : "selling"); lane.style.color = BOT_COLOR[who];
    } else { lane.textContent = "Idle"; lane.style.color = ""; }
    var box = $("#screen-order");
    if (!o) { box.innerHTML = '<span class="muted">No orders yet</span>'; return; }
    var verb = o.side === "buy" ? "Bought" : "Sold", st = o.status === "done" ? "verified" : o.status;
    var ck = o.checks || {};
    var dot = function (v, n) { return '<span class="check ' + (v ? "ok" : v === 0 || v === false ? "bad" : "") + '" title="' + n + '">' + (v ? "✓" : v === 0 || v === false ? "✕" : "·") + "</span>"; };
    box.innerHTML = '<span class="num">' + esc(verb + " " + symOf(o.mint) + " · " + (o.usd != null ? usd(o.usd) : o.pct != null ? o.pct + "%" : DASH) + " · " + st) + '</span><span class="checks">' + dot(ck.screen, "screen") + dot(ck.api, "api") + dot(ck.chain, "chain") + "</span>";
  }

  /* BOT CARDS */
  function botBody(b) {
    var h = "";
    if (b.name === "scanner") {
      var feed = (b.feed || []).slice(0, 4);
      h = feed.length ? feed.map(function (f) {
        return f.verdict === "pass" ? '<div class="feed-row"><span class="mint">' + esc(symOf(f.mint)) + '</span><span class="green">→ Analyst</span></div>'
          : '<div class="feed-row killed"><span class="mint">' + esc(symOf(f.mint)) + "</span><span>" + esc(f.reason || f.verdict) + "</span></div>";
      }).join("") : '<div class="muted">No pools yet tonight</div>';
    } else if (b.name === "analyst") {
      var L = b.layers || [], strips = "";
      for (var i = 0; i < 8; i++) { var l = L[i]; strips += '<span class="strip ' + (l ? (l.pass ? "ok" : "bad") : "") + '"></span>'; }
      var last = b.last || {};
      h = '<div style="display:flex;gap:12px;align-items:center"><div class="layer-strips">' + strips + '</div><div class="ring"><canvas data-score="' + (last.score == null ? "" : last.score) + '"></canvas><b>' + (last.score == null ? DASH : Math.round(last.score)) + "</b></div></div>" +
        '<div class="muted" style="margin-top:8px">' + (last.social_pts != null ? "Social +" + Math.round(last.social_pts) : "Social: off") + (last.mint ? " · " + esc(symOf(last.mint)) : "") + "</div>";
    } else if (b.name === "brain") {
      h = '<div class="big-line">' + (b.sizeUsd != null ? esc(usd(b.sizeUsd)) + (b.pctOfCash != null ? ' <span class="muted" style="font-size:17px">· ' + Number(b.pctOfCash).toFixed(0) + "% of cash</span>" : "") : '<span class="muted" style="font-size:17px">No sizing yet</span>') + '</div><div class="muted">' + esc(b.hint || "") + "</div>";
    } else if (b.name === "executor") {
      h = '<div class="bar' + (/Bought/.test(b.bar) ? " green" : "") + '">' + esc(b.bar || "Idle") + "</div>";
    } else if (b.name === "risk") {
      h = '<div class="pills">' + (b.pills || []).map(function (p) { return '<span class="pill mono ' + p.color + '">' + esc(p.text) + "</span>"; }).join("") + "</div>" + (b.open ? '<div class="muted" style="margin-top:8px">' + b.open + " open</div>" : "");
    }
    if (b.status === "offline") h += '<div class="ter" style="margin-top:8px">Offline</div>';
    return h;
  }
  function botHead(b) {
    return '<span class="bdot ' + b.status + '"></span><span class="bot-name" style="color:' + b.color + '">' + cap(b.name) + '</span><span class="bot-label">' + esc(b.label || "") + "</span>";
  }
  function paintRings(root) { $$(".ring canvas", root).forEach(function (c) { Charts.ring(c, c.dataset.score === "" ? null : +c.dataset.score); }); }
  function renderCarousel() {
    var bots = S.state.bots || [], running = bots.filter(function (b) { return b.status === "running"; }).length;
    $("#bots-head").textContent = "Bots · " + running + " running";
    var el = $("#bot-carousel");
    el.innerHTML = bots.map(function (b) { return '<button class="bot-card" data-bot="' + b.name + '"><div class="bot-head">' + botHead(b) + '</div><div class="bot-body">' + botBody(b) + "</div></button>"; }).join("");
    paintRings(el);
  }

  /* ACTIVITY rows */
  function actRow(r) {
    var bot = cap(r.bot || (r.kind === "rejected" ? "analyst" : r.kind === "stopped" ? "risk" : "executor"));
    var title = r.title || (cap(r.kind) + " " + symOf(r.mint));
    var sub = (r.subtitle || bot) + " · " + hm(r.ts);
    var val = r.kind === "rejected" ? "Skipped" : (r.value || DASH);
    var cls = r.kind === "sold" ? "green" : r.kind === "stopped" ? "red" : r.kind === "rejected" ? "muted" : "";
    var link = r.mint ? '<a class="fomo" href="' + esc(Links.coinUrl(r.mint)) + '" target="_blank" rel="noopener">Open on FOMO</a>' : "";
    return '<div class="row tap" role="button" data-mint="' + esc(r.mint || "") + '" data-kind="' + r.kind + '"><div class="row-main"><div class="row-title">' + esc(title) + '</div><div class="row-sub">' + esc(sub) + '</div></div><div class="row-val"><span class="' + cls + '">' + esc(val) + "</span>" + link + "</div></div>";
  }
  function renderHomeActivity() {
    var rows = ((S.activity && S.activity.rows) || []).slice(0, 5), el = $("#home-activity");
    el.style.background = "";
    el.outerHTML = rows.length ? '<div class="list" id="home-activity">' + rows.map(actRow).join("") + "</div>" : '<div class="list" id="home-activity" style="background:none"><div class="empty">Waiting for the first trade</div></div>';
  }
  function renderActivityTab() {
    var rows = (S.activity && S.activity.rows) || [], el = $("#activity-list");
    el.style.background = rows.length ? "" : "none";
    el.innerHTML = rows.length ? rows.map(actRow).join("") : '<div class="empty">Nothing yet tonight</div>';
    $("#activity-more").classList.toggle("hidden", !(S.activity && S.activity.next) || planB());
  }

  /* BOTS TAB */
  function decText(d) {
    if (d.bot === "scanner") return (d.verdict === "pass" ? "Passed → Analyst" : "Killed · " + (d.reason || d.verdict));
    if (d.bot === "analyst") return "Score " + (d.score == null ? DASH : Math.round(d.score)) + " · " + (d["pass"] ? "taken" : (d.reason || "rejected"));
    if (d.bot === "executor" && d.side) return cap(d.side) + " · " + (d.usd != null ? usd(d.usd) : d.pct != null ? d.pct + "%" : DASH) + " · " + d.status;
    return d.title ? d.title + (d.subtitle ? " · " + d.subtitle : "") : (d.event || "decision");
  }
  function renderBotsTab() {
    var st = S.state, openN = (st.positions || []).length;
    $("#bots-list").innerHTML = (st.bots || []).map(function (b) {
      var locked = b.name === "risk" && openN > 0;
      var decs = S.decisions[b.name], decHtml;
      if (planB()) decHtml = '<div class="note">Decisions need the live API (plan B shows the card only).</div>';
      else if (!decs) decHtml = '<span class="sk sk-row" style="height:36px"></span>';
      else if (!decs.length) decHtml = '<div class="note">No decisions yet.</div>';
      else decHtml = decs.slice(0, 20).map(function (d) {
        return '<div class="dec"><span class="t">' + hm(d.ts) + '</span><span class="d">' + esc((d.mint ? symOf(d.mint) + " · " : "") + decText(d)) + "</span>" + (d.mint ? '<a href="' + esc(Links.coinUrl(d.mint)) + '" target="_blank" rel="noopener">FOMO</a>' : "") + "</div>";
      }).join("");
      return '<div class="bot-full" id="bot-' + b.name + '"><div class="bot-head"><span class="bdot ' + b.status + '"></span><span class="bot-name" style="color:' + b.color + '">' + cap(b.name) + '</span><span class="count">' + esc(b.label || "") + '</span><label class="switch" title="' + (locked ? "Locked while a position is open" : "Pause") + '"><input type="checkbox" data-pause="' + b.name + '"' + (b.paused ? "" : " checked") + (locked || planB() ? " disabled" : "") + '><span></span></label></div>' +
        (locked ? '<div class="note">Locked while a position is open</div>' : "") +
        '<div class="bot-body">' + botBody(b) + '</div><div class="decisions">' + decHtml + '</div><button class="link tap" data-settings="' + b.name + '">Settings</button></div>';
    }).join("");
    paintRings($("#bots-list"));
  }
  function loadDecisions() {
    if (planB() || !S.state) return;
    Promise.all(BOTS.map(function (n) { return get.decisions(n).then(function (r) { S.decisions[n] = r.rows || []; }).catch(function () {}); })).then(function () { if (S.state) renderBotsTab(); });
  }

  /* ---------- layers & sheets ---------- */
  function openLayer(title, right, html, cls) {
    $("#layer").className = "layer " + (cls || ""); $("#layer-title").textContent = title; $("#layer-right").innerHTML = right || ""; $("#layer-body").innerHTML = html;
    $("#layer").scrollTop = 0;
  }
  function closeLayer() { $("#layer").className = "layer hidden"; $("#layer-body").innerHTML = ""; }
  function sheet(html) { $("#sheet").innerHTML = html; $("#sheet-scrim").classList.remove("hidden"); }
  function closeSheet() { $("#sheet-scrim").classList.add("hidden"); }
  function toast(t) { var e = $("#toast"); e.textContent = t; e.classList.remove("hidden"); clearTimeout(e._t); e._t = setTimeout(function () { e.classList.add("hidden"); }, 2400); }
  var paperPill = function () { return S.state && S.state.mode !== "LIVE" ? '<span class="pill paper">PAPER</span>' : ""; };

  /* COIN */
  function openCoin(mint) {
    openLayer(symOf(mint), "", '<span class="sk sk-card" style="height:120px"></span><span class="sk sk-card" style="height:220px"></span><span class="sk sk-card"></span>');
    get.coin(mint).then(function (c) {
      if (c.symbol) S.sym[mint] = c.symbol;
      var pos = c.position, ago = age(c.created_at);
      var since = c.sinceEntryPct;
      var mcap = c.marketCap != null ? c.marketCap : c.market_cap != null ? c.market_cap : null;
      $("#layer-title").textContent = c.symbol || short(mint);
      $("#layer-body").innerHTML =
        '<div class="coin-head"><div class="coin-name">' + esc(c.name || c.symbol || short(mint)) + ' <span class="shield">🛡 ' + esc(c.shield || "0/8") + "</span>" + paperPill() + '</div><div class="coin-sub">' + esc([c.symbol || short(mint), "Solana", ago].filter(Boolean).join(" · ")) + "</div>" +
        '<div class="price-big" style="font-size:' + (price(c.price).length > 11 ? 40 : price(c.price).length > 8 ? 52 : 66) + 'px">' + esc(price(c.price)) + "</div>" +
        (since != null ? '<div class="' + (since >= 0 ? "green" : "red") + '" style="font-weight:600">' + (since >= 0 ? "▲ " : "▼ ") + Math.abs(since).toFixed(2) + "% since entry</div>" : "") + "</div>" +
        '<div class="candle-wrap">' + ((c.candles || []).length ? '<canvas id="candles"></canvas>' : '<div class="chart-empty">No price data yet</div>') + "</div>" +
        '<div class="stats"><div class="stat"><div class="k">Market cap</div><div class="v">' + compact(mcap) + '</div></div><div class="stat"><div class="k">Liquidity</div><div class="v">' + compact(c.liquidityUsd) + '</div></div><div class="stat"><div class="k">Holders</div><div class="v">' + (c.holders != null ? Number(c.holders).toLocaleString("en-US") : DASH) + "</div></div></div>" +
        (pos ? '<div class="card"><div>Your position · ' + esc(usd(pos.size_usd)) + ' in · <span style="color:' + BOT_COLOR.executor + '">Executor</span></div><div class="muted num" style="margin-top:4px;font-size:15px">Now ' + esc(usd(pos.value_usd)) + " · " + esc(pos.pnl_usd != null ? (pos.pnl_usd >= 0 ? "+" : "") + usd(pos.pnl_usd) : DASH) + "</div></div>" : '<div class="card muted">No open position</div>') +
        '<div class="two"><a class="btn blue" href="' + esc(Links.coinUrl(mint)) + '" target="_blank" rel="noopener">Open on FOMO</a><button class="btn danger" id="sell-now"' + (pos && !planB() ? "" : " disabled") + ">Sell now</button></div>" +
        (planB() ? "" : '<button class="btn" id="open-audit">Audit</button>');
      var cv = $("#candles"); if (cv) Charts.candles(cv, { candles: c.candles, exit: c.stopPrice });
      var sb = $("#sell-now"); if (sb) sb.onclick = function () { sellSheet(mint); };
      var ab = $("#open-audit"); if (ab) ab.onclick = function () { openAudit(mint); };
    }).catch(function (e) {
      $("#layer-body").innerHTML = '<div class="empty">' + (e.status === 404 ? "This coin isn't in the data yet." : "Desk offline · couldn't load this coin.") + '</div><a class="btn blue" href="' + esc(Links.coinUrl(mint)) + '" target="_blank" rel="noopener">Open on FOMO</a>';
    });
  }
  function sellSheet(mint) {
    var chosen = null;
    sheet('<h3>Sell ' + esc(symOf(mint)) + '</h3><div class="seg" id="sell-seg"><button data-p="25">25%</button><button data-p="50">50%</button><button data-p="100">100%</button></div><button class="btn danger" id="confirm-sell" disabled>Confirm sell</button><button class="btn" id="cancel-sheet">Cancel</button>');
    $$("#sell-seg button").forEach(function (b) { b.onclick = function () { chosen = +b.dataset.p; $$("#sell-seg button").forEach(function (x) { x.classList.toggle("on", x === b); }); $("#confirm-sell").disabled = false; }; });
    $("#confirm-sell").onclick = function () {
      this.disabled = true;
      req("/sell/" + encodeURIComponent(mint), { method: "POST", body: { pct: chosen, confirm: true } })
        .then(function () { closeSheet(); toast("Sell " + chosen + "% queued · Executor clicks it"); refreshSoon(); })
        .catch(function (e) { closeSheet(); toast("Sell failed: " + e.message); });
    };
  }

  /* AUDIT: 8 discs, a cyan beam reads each layer */
  function openAudit(mint) {
    openLayer("Audit · " + symOf(mint), "", '<span class="sk sk-card" style="height:300px"></span><span class="sk sk-card" style="height:300px"></span>');
    if (planB()) { $("#layer-body").innerHTML = '<div class="empty">The audit needs the live API.</div>'; return; }
    get.audit(mint).then(function (a) {
      var L = a.layers || [], discs = "", rows = "";
      L.forEach(function (l, i) {
        discs += '<div class="disc" id="disc-' + i + '" style="top:' + (i * 34 + 12) + 'px">' + esc(l.name || "Layer " + l.n) + "</div>";
        rows += '<div class="row layer-row"><span class="ico" id="ico-' + i + '">·</span><div class="row-main"><div class="row-title" style="font-size:15px">' + esc(l.name || "Layer " + l.n) + '</div></div><div class="row-val">' + esc(l.value == null ? DASH : l.value) + "</div></div>";
      });
      var soc = a.social || {}, s = soc.social, sline;
      if (soc.enabled && s) { var so = typeof s === "string" ? (function () { try { return JSON.parse(s); } catch (e) { return {}; } })() : s; sline = soc.label + " · " + (so.u15 != null ? so.u15 : DASH) + " accounts in 15m · " + (so.smart != null ? so.smart : DASH) + " top traders hold"; }
      else sline = "Social: off";
      var score = a.score && a.score.score;
      $("#layer-body").innerHTML = '<div style="display:flex;align-items:center;gap:12px;margin:8px 0"><div class="ring"><canvas data-score="' + (score == null ? "" : score) + '"></canvas><b>' + (score == null ? DASH : Math.round(score)) + '</b></div><div><div style="font-weight:600">' + esc(symOf(mint)) + '</div><div class="muted" style="font-size:13px">Score 0-100 · green from 70</div></div></div>' +
        '<div class="discs"><div class="beam" id="beam"></div>' + discs + '</div><div class="list">' + rows + '<div class="row"><div class="row-main"><div class="row-title" style="font-size:15px">' + esc(sline) + "</div></div></div></div>" +
        '<a class="btn blue" href="' + esc(Links.coinUrl(mint)) + '" target="_blank" rel="noopener">Open on FOMO</a>';
      paintRings($("#layer-body"));
      var i = 0;
      (function step() {
        if (i >= L.length || !$("#disc-" + i)) { var bm = $("#beam"); if (bm) bm.style.opacity = 0; return; }
        var l = L[i], st = l.pass === true || l.pass === 1 ? "ok" : l.pass === false || l.pass === 0 ? "bad" : "";
        $("#beam").style.top = (i * 34 + 27) + "px";
        $("#disc-" + i).classList.add(st || "x"); var ic = $("#ico-" + i); ic.className = "ico " + st; ic.textContent = st === "ok" ? "✓" : st === "bad" ? "✕" : "·";
        i++; setTimeout(step, reduce ? 0 : 260);
      })();
    }).catch(function () { $("#layer-body").innerHTML = '<div class="empty">Desk offline · couldn\'t load the audit.</div>'; });
  }

  /* LIVE SCREEN full screen: pinch to zoom, landscape allowed */
  function openScreenFull() {
    var o = lastOrder(), pos = S.state && (S.state.positions || [])[0];
    var mint = (o && o.mint) || (pos && pos.mint);
    openLayer("Bot's computer", "", '<div class="zoom-box" id="zoom-box">' + (scr.url ? '<img id="zoom-img" src="' + scr.url + '" alt="Bot\'s computer">' : '<div class="muted">No frame yet</div>') + "</div>" +
      (mint ? '<a class="btn blue" href="' + esc(Links.coinUrl(mint)) + '" target="_blank" rel="noopener">Open on FOMO</a>' : '<button class="btn" disabled>Open on FOMO</button>'), "screen-full");
    var img = $("#zoom-img"); if (!img) return;
    var pts = {}, scale = 1, base = 0, tx = 0, ty = 0, lx = 0, ly = 0;
    var box = $("#zoom-box"), apply = function () { img.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + scale + ")"; };
    box.onpointerdown = function (e) { pts[e.pointerId] = e; lx = e.clientX; ly = e.clientY; box.setPointerCapture(e.pointerId); };
    box.onpointermove = function (e) {
      if (!pts[e.pointerId]) return; pts[e.pointerId] = e; var ids = Object.keys(pts);
      if (ids.length === 2) { var a = pts[ids[0]], b = pts[ids[1]], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); if (base) scale = Math.max(1, Math.min(5, scale * d / base)); base = d; apply(); }
      else if (scale > 1) { tx += e.clientX - lx; ty += e.clientY - ly; lx = e.clientX; ly = e.clientY; apply(); }
    };
    box.onpointerup = box.onpointercancel = function (e) { delete pts[e.pointerId]; base = 0; };
    box.ondblclick = function () { scale = 1; tx = ty = 0; apply(); };
    var iv = setInterval(function () { if (!$("#zoom-img")) return clearInterval(iv); if (scr.url) img.src = scr.url; }, 1000);
  }

  /* SEARCH: name, symbol or mint */
  function openSearch() {
    sheet('<h3>Search</h3><input type="text" id="q" placeholder="Name, symbol or mint" autocomplete="off" autocapitalize="off"><div class="list" id="q-res" style="margin-top:10px"></div><button class="btn" id="cancel-sheet">Close</button>');
    var q = $("#q"); q.focus();
    q.oninput = function () {
      var v = q.value.trim(), lv = v.toLowerCase(), seen = {}, out = [];
      var add = function (mint, label) { if (!mint || seen[mint]) return; seen[mint] = 1; out.push({ mint: mint, label: label }); };
      if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)) add(v, "Open coin " + short(v));
      if (lv) Object.keys(S.sym).forEach(function (m) { if (m.toLowerCase().indexOf(lv) >= 0 || (S.sym[m] || "").toLowerCase().indexOf(lv) >= 0) add(m, S.sym[m] + " · " + short(m)); });
      ((S.state && S.state.positions) || []).forEach(function (p) { if (lv && ((p.name || "").toLowerCase().indexOf(lv) >= 0)) add(p.mint, (p.name || p.symbol) + " · " + short(p.mint)); });
      $("#q-res").innerHTML = out.slice(0, 12).map(function (o) { return '<div class="row tap" role="button" data-mint="' + esc(o.mint) + '" data-kind="coin"><div class="row-main"><div class="row-title">' + esc(o.label) + "</div></div></div>"; }).join("") || (lv ? '<div class="empty">No match</div>' : "");
    };
  }

  /* ---------- ACCOUNT ---------- */
  function connectionGroup() {
    return '<div class="group-title">Connection</div><div class="group">' +
      '<div class="cell col"><div class="set-top"><span class="grow">Desk API</span></div><input type="url" id="c-api" placeholder="Same origin" value="' + esc(cfg.api) + '"></div>' +
      '<div class="cell col"><div class="set-top"><span class="grow">Snapshot URL (plan B)</span></div><input type="url" id="c-snap" placeholder="Not set" value="' + esc(cfg.snap) + '"></div>' +
      '<div class="cell col"><div class="set-top"><span class="grow">App token</span><span class="val">' + (cfg.token ? "Set" : "Not set") + '</span></div><input type="password" id="c-token" placeholder="Paste to replace" autocomplete="off"></div>' +
      '<button class="cell tap" id="c-save" style="color:var(--blue)">Save and reconnect</button></div>';
  }
  function bindConnection() {
    var b = $("#c-save"); if (!b) return;
    b.onclick = function () {
      cfg.api = $("#c-api").value.trim(); cfg.snap = $("#c-snap").value.trim();
      var t = $("#c-token").value.trim(); if (t) cfg.token = t;
      localStorage.setItem("desk.api", cfg.api); localStorage.setItem("desk.snap", cfg.snap); localStorage.setItem("desk.t", cfg.token);
      toast("Saved"); S.fails = 0; refresh(); loadAccount(true);
    };
  }
  var NICE = function (k) { return k.split(".").slice(1).join(".").replace(/_/g, " ").replace(/\bpct\b/, "%").replace(/\busd\b/, "$").replace(/\b(min|s|h)\b$/, "($1)"); };
  function settingCell(k, v, r) {
    r = r || {};
    if (r.type === "mode") return "";
    if (r.type === "number") {
      var step = (Number.isInteger(r.min) && Number.isInteger(r.max) && Number.isInteger(v)) ? 1 : 0.01;
      return '<div class="cell col"><div class="set-top"><span class="grow">' + esc(NICE(k)) + '</span><input type="number" data-k="' + k + '" value="' + esc(v) + '" min="' + r.min + '" max="' + r.max + '" step="' + step + '"></div><input type="range" data-k="' + k + '" min="' + r.min + '" max="' + r.max + '" step="' + step + '" value="' + esc(v) + '"></div>';
    }
    if (r.type === "bool") return '<div class="cell"><span class="grow">' + esc(NICE(k)) + '</span><label class="switch"><input type="checkbox" data-k="' + k + '"' + (v ? " checked" : "") + "><span></span></label></div>";
    if (r.type === "enum") return '<div class="cell col"><div class="set-top"><span class="grow">' + esc(NICE(k)) + '</span></div><select data-k="' + k + '">' + r.values.map(function (x) { return "<option" + (x === v ? " selected" : "") + ">" + esc(x) + "</option>"; }).join("") + "</select></div>";
    if (r.type === "time") return '<div class="cell"><span class="grow">' + esc(NICE(k)) + '</span><input type="time" data-k="' + k + '" value="' + esc(v) + '" style="width:120px"></div>';
    return '<div class="cell col"><div class="set-top"><span class="grow">' + esc(NICE(k)) + '</span></div><input type="text" data-k="' + k + '" value="' + esc(v) + '"></div>';
  }
  function loadAccount(force) {
    if (S.account && !force) return renderAccount();
    if (planB()) { S.account = null; return renderAccount(); }
    get.account().then(function (a) { S.account = a; renderAccount(); }).catch(function () { if (!S.account) renderAccount(); });
  }
  var standalone = function () { return navigator.standalone === true || (window.matchMedia && matchMedia("(display-mode: standalone)").matches); };
  function renderAccount() {
    var a = S.account, el = $("#account-body");
    if (!a) {
      el.innerHTML = (planB() ? '<div class="note">Plan B: read-only snapshot. Settings, mode and pushes need the live API.</div>' : '<span class="sk sk-card"></span>'.repeat(3)) +
        '<div class="group-title">FOMO</div><div class="group"><button class="cell tap" id="invite"><span class="grow">Invite a friend</span><span class="val">›</span></button></div>' + connectionGroup();
      bindConnection(); bindInvite(); return;
    }
    var live = a.mode === "LIVE", push = a.push || {};
    var order = ["scanner", "analyst", "social", "brain", "executor", "risk", "desk"], groups = a.groups || {};
    var setHtml = order.concat(Object.keys(groups).filter(function (g) { return order.indexOf(g) < 0; })).filter(function (g) { return groups[g]; }).map(function (g) {
      return '<div class="group-title" id="set-' + g + '"' + (BOT_COLOR[g] ? ' style="color:' + BOT_COLOR[g] + '"' : "") + ">" + cap(g) + '</div><div class="group">' + groups[g].map(function (k) { return settingCell(k, a.settings[k], a.ranges[k]); }).join("") + "</div>";
    }).join("");
    el.innerHTML =
      '<div class="group-title">Mode</div><div class="seg" id="mode-seg"><button data-m="PAPER" class="' + (live ? "" : "on") + '">PAPER</button><button data-m="LIVE" class="' + (live ? "on" : "") + '">LIVE</button></div>' +
      '<div class="group" style="margin-top:12px"><div class="cell"><span class="grow">Cash</span><span class="val">' + esc(usd(a.cash)) + '</span></div><div class="cell"><span class="grow">Balance</span><span class="val">' + esc(usd(a.balance)) + "</span></div></div>" +
      '<div class="group-title">FOMO</div><div class="group">' +
      (a.fomoHandle ? '<a class="cell tap" href="' + esc(Links.profileUrl(a.fomoHandle)) + '" target="_blank" rel="noopener"><span class="grow" style="color:#fff">Your FOMO profile</span><span class="val">@' + esc(String(a.fomoHandle).replace(/^@/, "")) + " ›</span></a>" : '<div class="cell"><span class="grow">Your FOMO profile</span><span class="val">Not set</span></div>') +
      '<button class="cell tap" id="invite"><span class="grow">Invite a friend</span><span class="val">›</span></button></div>' +
      '<div class="group-title">Copy picks</div><div class="group"><div class="cell col"><div class="seg"><button disabled>Off</button><button disabled>24h</button><button disabled>12h</button><button disabled>6h</button></div><div class="note">Scheduled by Grok Bot. Change it in the chat for now.</div></div></div>' +
      '<div class="group-title">Pushes</div><div class="group"><div class="cell"><span class="grow">Telegram</span><span class="val">' + (a.telegram ? "Connected" : "Not connected") + '</span></div>' +
      '<div class="cell"><span class="grow">Web push</span><span class="val">' + (push.webpush ? "Connected (" + push.subs + ")" : "Not connected") + "</span></div>" +
      (push.note ? '<div class="cell"><span class="grow muted" style="font-size:15px">Plan B: ' + esc(push.note) + "</span></div>" : "") +
      (standalone() ? '<button class="cell tap" id="enable-push" style="color:var(--blue)">Enable notifications</button>' : '<div class="cell"><span class="grow muted" style="font-size:15px">Enable notifications: add the app to your Home Screen first (Safari › Share › Add to Home Screen)</span></div>') +
      '<button class="cell tap" id="test-push" style="color:var(--blue)">Send test push</button>' +
      '<button class="cell tap" id="watch" style="color:var(--blue)">Watch in Grok Bot</button></div>' +
      setHtml + connectionGroup();
    bindConnection(); bindInvite();
    $$("#mode-seg button").forEach(function (b) { b.onclick = function () { setMode(b.dataset.m); }; });
    $$("[data-k]", el).forEach(function (inp) {
      var ev = inp.type === "range" ? "input" : "change";
      inp.addEventListener(ev, function () {
        var k = inp.dataset.k, v = inp.type === "checkbox" ? inp.checked : (inp.type === "number" || inp.type === "range") ? +inp.value : inp.value;
        $$('[data-k="' + k + '"]', el).forEach(function (o) { if (o !== inp && o.type !== "checkbox") o.value = v; });
        if (inp.type === "range") { clearTimeout(inp._t); inp._t = setTimeout(function () { saveSetting(k, v); }, 400); } else saveSetting(k, v);
      });
    });
    var ep = $("#enable-push"); if (ep) ep.onclick = enablePush;
    $("#test-push").onclick = function () { req("/push/test", { method: "POST", body: {} }).then(function () { toast("Test push sent"); }).catch(function (e) { toast(e.status === 404 ? "Test push isn't wired yet (STEP 11)" : "Test push failed: " + e.message); }); };
    $("#watch").onclick = function () { if (a.watchUrl) window.open(a.watchUrl, "_blank", "noopener"); else toast("Open the Grok Bot app to watch the bot's computer"); };
  }
  function bindInvite() {
    var b = $("#invite"); if (!b) return;
    b.onclick = function () {
      var url = Links.SIGNUP_URL;
      if (navigator.share) navigator.share({ title: "FOMO", url: url }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { toast("Link copied"); });
      else toast(url);
    };
  }
  function saveSetting(k, v) {
    req("/settings", { method: "POST", body: { key: k, value: v } }).then(function (r) { S.account = Object.assign(S.account || {}, { settings: r.settings }); toast("Saved"); })
      .catch(function (e) { toast("Not saved: " + e.message); loadAccount(true); });
  }
  function setMode(m) {
    if (m === "PAPER") return req("/mode", { method: "POST", body: { mode: "PAPER" } }).then(function () { toast("PAPER"); loadAccount(true); refreshSoon(); }).catch(function (e) { toast(e.message); });
    sheet('<h3>Switch to LIVE</h3><div class="note" style="text-align:center;padding-bottom:10px">LIVE trades real money. Type LIVE to confirm.</div><input type="text" id="live-in" autocapitalize="characters" autocomplete="off"><button class="btn danger" id="live-ok" disabled>Switch to LIVE</button><button class="btn" id="cancel-sheet">Cancel</button>');
    $("#live-in").oninput = function () { $("#live-ok").disabled = this.value !== "LIVE"; };
    $("#live-ok").onclick = function () {
      req("/mode", { method: "POST", body: { mode: "LIVE", confirm: "LIVE" } }).then(function () { closeSheet(); toast("LIVE"); loadAccount(true); refreshSoon(); }).catch(function (e) { closeSheet(); toast(e.message); });
    };
  }
  function enablePush() {
    var key = S.account && S.account.push && S.account.push.vapidPublic;
    if (!key) return toast("Push keys aren't set up yet (STEP 11)");
    if (!("serviceWorker" in navigator) || !window.PushManager) return toast("This browser can't receive web push");
    Notification.requestPermission().then(function (p) {
      if (p !== "granted") throw new Error("Notifications not allowed");
      return navigator.serviceWorker.ready;
    }).then(function (reg) {
      var raw = atob(key.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((key.length + 3) % 4)), arr = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
      return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: arr });
    }).then(function (sub) { return req("/push", { method: "POST", body: sub.toJSON() }); })
      .then(function () { toast("Notifications on"); loadAccount(true); })
      .catch(function (e) { toast(e.message); });
  }

  /* ---------- tabs & events ---------- */
  function setTab(t) {
    if (["home", "bots", "activity", "account"].indexOf(t) < 0) t = "home";
    S.tab = t;
    $$(".view").forEach(function (v) { v.classList.toggle("hidden", v.dataset.tab !== t); });
    $$(".tab").forEach(function (b) { b.classList.toggle("on", b.dataset.tab === t); });
    window.scrollTo(0, 0);
    if (t === "bots") loadDecisions();
    if (t === "account") loadAccount(true);
    if (t === "activity") { var top = ((S.activity && S.activity.rows) || [])[0]; if (top) { localStorage.setItem("desk.seen", top.id); $("#bell-dot").classList.add("hidden"); } }
    if (t === "home" && S.chart) setTimeout(renderChart, 0);
  }
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t.closest("a")) return;
    var tab = t.closest(".tab"); if (tab) return setTab(tab.dataset.tab);
    if (t.closest("#nav-avatar")) return setTab("account");
    if (t.closest("#nav-title")) return setTab("bots");
    if (t.closest("#nav-bell") || t.closest("#see-all")) return setTab("activity");
    if (t.closest("#nav-search")) return openSearch();
    if (t.closest("#layer-back")) return closeLayer();
    if (t.closest("#cancel-sheet") || t.id === "sheet-scrim") return closeSheet();
    if (t.closest("#screen-card")) return openScreenFull();
    var rb = t.closest("#range-switch button");
    if (rb) { S.range = rb.dataset.range; $$("#range-switch button").forEach(function (b) { b.classList.toggle("on", b === rb); }); get.chart(S.range).then(function (c) { S.chart = c; renderChart(); }).catch(function () {}); return; }
    var card = t.closest(".bot-card"); if (card) { setTab("bots"); var el = $("#bot-" + card.dataset.bot); if (el) el.scrollIntoView(); return; }
    var st = t.closest("[data-settings]"); if (st) { setTab("account"); var go = function () { var g = $("#set-" + st.dataset.settings); if (g) g.scrollIntoView(); }; setTimeout(go, 400); return; }
    var row = t.closest(".row[data-mint]");
    if (row && row.dataset.mint) { closeSheet(); return row.dataset.kind === "rejected" ? openAudit(row.dataset.mint) : openCoin(row.dataset.mint); }
  });
  document.addEventListener("change", function (e) {
    var inp = e.target; if (!inp.dataset || !inp.dataset.pause) return;
    var n = inp.dataset.pause, on = inp.checked;
    req("/bots/" + n + "/" + (on ? "resume" : "pause"), { method: "POST", body: {} }).then(function () { toast(cap(n) + (on ? " running" : " paused")); refreshSoon(); })
      .catch(function (err) { inp.checked = !on; toast(err.message); });
  });
  $("#activity-more").onclick = function () {
    var nxt = S.activity && S.activity.next; if (!nxt) return;
    get.activity(nxt).then(function (r) { S.activity.rows = S.activity.rows.concat(r.rows || []); S.activity.next = r.next; renderActivityTab(); });
  };
  window.addEventListener("resize", function () { if (S.chart) renderChart(); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) refreshSoon(); });

  /* ---------- boot ---------- */
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
  renderLoading();
  setTab(startTab);
  refresh();
  startStream();
  setInterval(screenTick, planB() ? 15000 : 1000); screenTick();
  setInterval(renderScreenAge, 1000);
  window.__desk = S;
})();
