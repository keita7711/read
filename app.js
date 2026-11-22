/* FOMO desk app · STEP 10 · design v2 (desk-design-v2).  Plain JS. Never shows a made-up number: missing = "—". No secrets live in this file. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var BOTS = ["scanner", "analyst", "brain", "executor", "risk"];
  var BOT_COLOR = { scanner: "#30d5c8", analyst: "#8e8e93", brain: "#ff453a", executor: "#bf5af2", risk: "#ff9f0a", copy_picks: "#64d2ff" };
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
  function hostOf(u) {
    try { return new URL(u, location.href).hostname; } catch (e) { return ""; }
  }
  function isLoopback(h) { return h === "localhost" || h === "127.0.0.1"; }
  function onDeskHost() { return isLoopback(location.hostname); }
  function apiUnreachableFromHere() {
    if (!cfg.api) return !onDeskHost();
    return !onDeskHost() && isLoopback(hostOf(cfg.api));
  }
  var planB = function () {
    if (cfg.api && !apiUnreachableFromHere()) return false;
    return !!cfg.snap || (!onDeskHost() && location.protocol === "https:");
  };
  var apiBase = function () { return cfg.api ? cfg.api.replace(/\/+$/, "") + "/api" : "api"; };
  var snapBase = function () { return (cfg.snap || ".").replace(/\/+$/, "") || "."; };

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
    account: function () { return req("/account"); },
    agents: function () { return snap("agents.json"); },
    charts: function () { return snap("charts.json"); }
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
        Promise.all([get.agents().catch(function () { return S.agents; }), get.charts().catch(function () { return S.charts; })]).then(function (r) { S.agents = r[0] || null; S.charts = r[1] || null; if (S.state) render(); });
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
    /* Balance = REAL FOMO balance (agents.json realBalance: USDC cash + holdings at FOMO price). Never the desk PAPER ledger. */
    var rb = realBal(), balTxt = rb && rb.ok && rb.equityUsd != null ? usd(rb.equityUsd) : DASH;
    odometer($("#balance"), balTxt); $("#balance").setAttribute("aria-label", balTxt);
    var mp = $("#mult-pill"), base = rb && rb.baseline;
    if (rb && rb.ok && rb.equityUsd != null && base && base.equityUsd) { mp.textContent = (rb.equityUsd / base.equityUsd).toFixed(2) + "x"; mp.classList.remove("hidden"); } else mp.classList.add("hidden");
    renderChart(); renderScreenMeta(); renderCarousel(); renderHomeActivity(); renderBotsTab(); renderActivityTab(); renderDesign();
    if (S.tab === "account") loadAccount();
    var seen = +localStorage.getItem("desk.seen") || 0, top = ((S.activity && S.activity.rows) || [])[0];
    $("#bell-dot").classList.toggle("hidden", !(top && top.id > seen));
  }

  function nightStartValue() {
    var st = S.state; if (!st || st.multiplier == null || !st.multiplier) return null;
    return st.balance / st.multiplier;
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
  /* BOTS TAB */
  function dispName(nm) { return { analyst: "Auditor", brain: "Analyst · sizing" }[nm] || cap(nm); }
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
      return '<div class="bot-full" id="bot-' + b.name + '"><div class="bot-head"><span class="bdot ' + b.status + '"></span><span class="bot-name" style="color:' + (BOT_COLOR[b.name] || b.color) + '">' + dispName(b.name) + '</span><span class="count">' + esc(b.label || "") + '</span><label class="switch" title="' + (locked ? "Locked while a position is open" : "Pause") + '"><input type="checkbox" data-pause="' + b.name + '"' + (b.paused ? "" : " checked") + (locked || planB() ? " disabled" : "") + '><span></span></label></div>' +
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

  function minutesHHMM(s) {
    var p = String(s || "").split(":");
    if (p.length < 2) return null;
    var h = +p[0], m = +p[1];
    if (!isFinite(h) || !isFinite(m)) return null;
    return h * 60 + m;
  }
  function copyPicksScheduleHtml(a) {
    var st = (a && a.settings) || {};
    var fb = S.copyPicksSettings || {};
    var every = st["copy_picks.every"] || fb.every || "24h";
    var time = st["copy_picks.time"] || fb.time || "21:30";
    var night = st["desk.night_start"] || fb.night_start || "18:30";
    var opts = ["off", "24h", "12h", "6h"];
    var btns = opts.map(function (x) {
      return '<button type="button" data-cp-every="' + x + '" class="' + (x === every ? "on" : "") + '">' + (x === "off" ? "Off" : x) + "</button>";
    }).join("");
    var warn = "";
    var tm = minutesHHMM(time), nm = minutesHHMM(night);
    if (every !== "off" && tm != null && nm != null && tm >= nm) {
      warn = '<div class="note">Note: ' + esc(time) + " is after night_start (" + esc(night) + "). The setting should be before the night starts. Not changed.</div>";
    }
    return '<div class="group"><div class="cell col"><div class="seg" id="cp-every">' + btns + '</div></div>'
      + '<div class="cell"><span class="grow">Time</span><input type="time" data-k="copy_picks.time" value="' + esc(time) + '" style="width:120px"></div>'
      + warn + "</div>";
  }
  function copyPicksHtml(cp, a) {
    var sched = copyPicksScheduleHtml(a);
    if (!cp || !cp.entries || !cp.entries.length) {
      return '<div class="group-title">Copy picks</div>' + sched;
    }
    var cards = cp.entries.map(function (e) {
      var buy = e.button_url || (window.Links && Links.SIGNUP_URL) || "";
      var label = (e.button === "Open FOMO") ? "Open FOMO" : ("last buy: " + (e.coin || "") + " at " + (e.mcap || "mcap n/a"));
      return '<div class="cp-card"><div class="row"><b>#' + esc(e.rank) + " " + esc(e.handle) + '</b>'
        + '<a class="btn" href="' + esc(e.profile) + '" target="_blank" rel="noopener">Profile</a></div>'
        + '<div class="row"><span class="g">7d ' + esc(e.pnl7d) + '</span><span class="g">30d ' + esc(e.pnl30d) + '</span>'
        + "<span>" + esc(Number(e.trades).toLocaleString()) + ' trades</span><span>last trade ' + esc(e.last) + "</span></div>"
        + '<a class="buy" href="' + esc(buy) + '" target="_blank" rel="noopener">' + esc(label) + "</a>"
        + '<label class="sw"><span class="switch"><input type="checkbox" data-copy-trader="' + esc(e.handle) + '"><span></span></span> Copy on desk</label></div>';
    }).join("");
    var past = (cp.history || []).slice(0, 7).map(function (x) {
      return '<li class="cp-past">' + esc(x.date || "") + ": " + esc((x.handles || []).join(", ")) + "</li>";
    }).join("");
    return '<div class="group-title">Copy picks</div><div style="color:#888;font-size:15px;margin:0 4px 6px">' + esc(cp.date || "") + "</div>"
      + cards + '<h3 style="font-size:20px;margin:16px 4px 8px">Last 7 lists</h3><ul style="padding-left:18px;margin:0">' + past + "</ul>"
      + sched;
  }
  function bindCopyPicks(el) {
    /* STEP 5 wires the switch. Off by default; no action yet. */
    $$("[data-copy-trader]", el).forEach(function (inp) { inp.checked = false; });
    $$("[data-cp-every]", el).forEach(function (b) {
      b.onclick = function () {
        $$("[data-cp-every]", el).forEach(function (o) { o.classList.toggle("on", o === b); });
        saveSetting("copy_picks.every", b.getAttribute("data-cp-every"));
      };
    });
  }

  function renderAccount() {
    var a = S.account, el = $("#account-body");
    if (!a) {
      el.innerHTML = (planB() ? '<div class="note">Plan B: read-only snapshot. Settings, mode and pushes need the live API.</div>' : '<span class="sk sk-card"></span>'.repeat(3)) +
        '<div class="group-title">FOMO</div><div class="group"><button class="cell tap" id="invite"><span class="grow">Invite a friend</span><span class="val">›</span></button></div>' + connectionGroup();
      bindConnection(); bindInvite(); return;
    }
    var live = a.mode === "LIVE", push = a.push || {};
    var order = ["scanner", "analyst", "social", "brain", "executor", "risk", "desk"], groups = a.groups || {};
    var setHtml = order.concat(Object.keys(groups).filter(function (g) { return order.indexOf(g) < 0; })).filter(function (g) { return groups[g] && g !== "copy_picks"; }).map(function (g) {
      return '<div class="group-title" id="set-' + g + '"' + (BOT_COLOR[g] ? ' style="color:' + BOT_COLOR[g] + '"' : "") + ">" + cap(g) + '</div><div class="group">' + groups[g].map(function (k) { return settingCell(k, a.settings[k], a.ranges[k]); }).join("") + "</div>";
    }).join("");
    el.innerHTML =
      '<div class="group-title">Mode</div><div class="seg" id="mode-seg"><button data-m="PAPER" class="' + (live ? "" : "on") + '">PAPER</button><button data-m="LIVE" class="' + (live ? "on" : "") + '">LIVE</button></div>' +
      '<div class="group" style="margin-top:12px"><div class="cell"><span class="grow">Cash</span><span class="val">' + esc(usd(a.cash)) + '</span></div><div class="cell"><span class="grow">Balance</span><span class="val">' + esc(usd(a.balance)) + "</span></div></div>" +
      '<div class="group-title">FOMO</div><div class="group">' +
      (a.fomoHandle ? '<a class="cell tap" href="' + esc(Links.profileUrl(a.fomoHandle)) + '" target="_blank" rel="noopener"><span class="grow" style="color:#fff">Your FOMO profile</span><span class="val">@' + esc(String(a.fomoHandle).replace(/^@/, "")) + " ›</span></a>" : '<div class="cell"><span class="grow">Your FOMO profile</span><span class="val">Not set</span></div>') +
      '<button class="cell tap" id="invite"><span class="grow">Invite a friend</span><span class="val">›</span></button></div>' +
      copyPicksHtml(a.copyPicks || S.copyPicks, a) +
      '<div class="group-title">Pushes</div><div class="group"><div class="cell"><span class="grow">Telegram</span><span class="val">' + (a.telegram ? "Connected" : "Not connected") + '</span></div>' +
      '<div class="cell"><span class="grow">Web push</span><span class="val">' + (push.webpush ? "Connected (" + push.subs + ")" : "Not connected") + "</span></div>" +
      (push.note ? '<div class="cell"><span class="grow muted" style="font-size:15px">Plan B: ' + esc(push.note) + "</span></div>" : "") +
      (standalone() ? '<button class="cell tap" id="enable-push" style="color:var(--blue)">Enable notifications</button>' : '<div class="cell"><span class="grow muted" style="font-size:15px">Enable notifications: add the app to your Home Screen first (Safari › Share › Add to Home Screen)</span></div>') +
      '<button class="cell tap" id="test-push" style="color:var(--blue)">Send test push</button>' +
      '<button class="cell tap" id="watch" style="color:var(--blue)">Watch in Grok Bot</button></div>' +
      setHtml + connectionGroup();
    bindConnection(); bindInvite(); bindCopyPicks(el);
    if (!a.copyPicks && !S.copyPicks) {
      fetch("copy_picks_data.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (cp) {
        if (cp && cp.settings) S.copyPicksSettings = cp.settings;
        if (cp && cp.entries) { S.copyPicks = cp; renderAccount(); }
        else if (cp && cp.settings) { renderAccount(); }
      }).catch(function () {});
    }
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


  /* ---------- Market & Journal (read-only snapshot files: market.json, journal.json) ---------- */
  function big(n) { if (n == null || !isFinite(n)) return DASH; return n >= 1e12 ? "$" + (n / 1e12).toFixed(2) + "T" : n >= 1e9 ? "$" + (n / 1e9).toFixed(1) + "B" : compact(n); }
  function cls(n) { return n == null || !isFinite(n) ? "" : n >= 0 ? "green" : "red"; }
  function num(n, d) { return n == null || !isFinite(n) ? DASH : Number(n).toFixed(d == null ? 2 : d); }
  function ext(u, label) { return u && /^https:\/\/fomo\.family\//.test(u) ? '<a class="fomo" href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(label || "FOMO") + "</a>" : ""; }
  function taLine(ta) {
    if (!ta) return '<span class="muted">TA: no data (not enough candles)</span>';
    return "RSI " + num(ta.rsi14, 1) + " (" + esc(ta.rsiZone || DASH) + ") · MACD " + esc(ta.macdSide || DASH) +
      " · BB " + (ta.bbPos == null ? DASH : Math.round(ta.bbPos * 100) + "%") + " · EMA20/50 " + esc(ta.trend || DASH);
  }
  function stamp(ts, label) { return '<div class="row-sub">' + esc(label) + (ts ? " · " + esc(age(ts) || "") : "") + "</div>"; }
  function loadMarket() {
    snap("market.json").then(renderMarket).catch(function () { $("#market-body").innerHTML = '<div class="card muted">Market: no data yet</div>'; });
  }
  function renderMarket(m) {
    var h = [];
    h.push('<div class="card">' + stamp(m.fetchedTs, "Updated " + (m.fetchedAt || DASH)) + '<div class="row-sub">' + esc((m.sources || []).join(" · ")) + "</div></div>");
    var g = m.global;
    h.push('<div class="section-head"><h2>Crypto market</h2></div><div class="list">');
    if (g) h.push('<div class="row"><div class="row-main"><div class="row-title">Total mcap ' + big(g.mcapUsd) + '</div><div class="row-sub">24h vol ' + big(g.volUsd) + " · BTC dom " + num(g.btcDom, 1) + '%</div></div><div class="row-val ' + cls(g.mcapChg24h) + '">' + pct(g.mcapChg24h) + "</div></div>");
    (m.majors || []).forEach(function (x) {
      h.push('<div class="row"><div class="row-main"><div class="row-title">' + esc(x.symbol) + " " + price(x.price) + '</div><div class="row-sub">' + taLine(x.ta) + ' (1h)</div></div><div class="row-val ' + cls(x.chg24h) + '">' + pct(x.chg24h) + "</div></div>");
    });
    h.push("</div>");
    h.push('<div class="section-head"><h2>Held coins · TA</h2></div><div class="list">');
    if (!(m.held || []).length) h.push('<div class="row"><div class="row-main muted">No open positions</div></div>');
    (m.held || []).forEach(function (x) {
      h.push('<div class="row" data-mint="' + esc(x.mint) + '"><div class="row-main"><div class="row-title">' + esc(x.symbol || short(x.mint)) + ' <span class="pill mono">' + esc(x.mode) + '</span></div><div class="row-sub">' + taLine(x.ta) + (x.bars != null ? " · " + x.bars + " bars" : "") + '</div></div><div class="row-val">' + price(x.price) + '<span class="' + cls(x.chg24h) + '">' + pct(x.chg24h) + "</span>" + ext(x.link) + "</div></div>");
    });
    h.push("</div>");
    h.push('<div class="section-head"><h2>Solana trending pools</h2></div><div class="list">');
    if (!(m.solTrending || []).length) h.push('<div class="row"><div class="row-main muted">No data</div></div>');
    (m.solTrending || []).forEach(function (x) {
      h.push('<div class="row"><div class="row-main"><div class="row-title">' + esc(x.name) + '</div><div class="row-sub">Vol ' + compact(x.vol24h) + " · Liq " + compact(x.liq) + '</div></div><div class="row-val">' + price(x.price) + '<span class="' + cls(x.chg24h) + '">' + pct(x.chg24h, 1) + "</span>" + ext(x.link) + "</div></div>");
    });
    h.push("</div>");
    h.push('<div class="section-head"><h2>CoinGecko trending</h2></div><div class="list">');
    if (!(m.cgTrending || []).length) h.push('<div class="row"><div class="row-main muted">No data</div></div>');
    (m.cgTrending || []).forEach(function (x) {
      h.push('<div class="row"><div class="row-main"><div class="row-title">' + esc(x.name) + " · " + esc(x.symbol) + '</div><div class="row-sub">Rank ' + esc(x.rank == null ? DASH : x.rank) + '</div></div><div class="row-val">' + price(x.price) + '<span class="' + cls(x.chg24h) + '">' + pct(x.chg24h, 1) + "</span></div></div>");
    });
    h.push("</div>");
    var f = m.forecast || {};
    h.push('<div class="section-head"><h2>Forecast</h2></div><div class="card muted">TimesFM: not applicable · ' + esc(f.why || "") + "</div>");
    if ((m.errors || []).length) h.push('<div class="card muted">Fetch errors: ' + esc(m.errors.join(", ")) + "</div>");
    $("#market-body").innerHTML = h.join("");
  }
  function loadJournal() {
    snap("journal.json").then(renderJournal).catch(function () { $("#journal-body").innerHTML = '<div class="card muted">Journal: no data yet</div>'; });
  }
  function statRows(a) {
    var r = function (k, v, c) { return '<div class="row"><div class="row-main"><div class="row-title">' + k + '</div></div><div class="row-val ' + (c || "") + '">' + v + "</div></div>"; };
    var es = a.edgeScore || {};
    return '<div class="list">' +
      r("Closed trades", a.closedTrades + " (" + a.wins + "W / " + a.losses + "L / " + a.breakevens + "BE)") +
      r("Win rate", a.winRate == null ? DASH : num(a.winRate * 100, 1) + "%") +
      r("Net P&L", usd(a.netPnl), cls(a.netPnl)) +
      r("Profit factor", a.profitFactorInfinite ? "∞" : num(a.profitFactor)) +
      r("Avg win / loss", usd(a.avgWin) + " / " + usd(a.avgLoss)) +
      r("Expectancy / trade", usd(a.expectancy), cls(a.expectancy)) +
      r("Max drawdown", usd(a.maxDrawdown)) +
      r("Streaks (W / L)", a.maxWinStreak + " / " + a.maxLossStreak) +
      r("Avg hold", a.avgHoldMin == null ? DASH : num(a.avgHoldMin, 1) + " min") +
      r("Edge Score v2", es.score == null ? esc(es.note || DASH) : num(es.score)) + "</div>";
  }
  function renderJournal(j) {
    var h = [], a = j.all || {};
    h.push('<div class="card">' + stamp(j.updatedTs, "Updated " + (j.updatedAt || DASH)) + '<div class="row-sub">' + esc(j.source || "") + "</div></div>");
    h.push('<div class="section-head"><h2>All</h2></div>' + statRows(a));
    ["LIVE", "PAPER"].forEach(function (m) { var b = (j.byMode || {})[m]; if (b && b.closedTrades) h.push('<div class="section-head"><h2>' + m + "</h2></div>" + statRows(b)); });
    h.push('<div class="section-head"><h2>P&amp;L calendar (JST)</h2></div><div class="list">');
    if (!(a.calendar || []).length) h.push('<div class="row"><div class="row-main muted">No closed trades yet</div></div>');
    (a.calendar || []).slice().reverse().forEach(function (d) {
      h.push('<div class="row"><div class="row-main"><div class="row-title">' + esc(d.day) + '</div><div class="row-sub">' + d.trades + ' trades</div></div><div class="row-val ' + cls(d.pnl) + '">' + usd(d.pnl) + "</div></div>");
    });
    h.push("</div>");
    h.push('<div class="section-head"><h2>Trades</h2></div><div class="list">');
    if (!(j.trades || []).length) h.push('<div class="row"><div class="row-main muted">No closed trades yet</div></div>');
    (j.trades || []).forEach(function (t) {
      h.push('<div class="row" data-mint="' + esc(t.mint) + '"><div class="row-main"><div class="row-title">' + esc(symOf(t.mint)) + ' <span class="pill mono">' + esc(t.mode) + '</span></div><div class="row-sub">' + esc(t.closedAt || DASH) + " · " + esc(t.reason || DASH) + " · " + price(t.entry) + " → " + price(t.exit) + '</div></div><div class="row-val ' + cls(t.pnl) + '">' + usd(t.pnl) + '<span>' + pct(t.pnlPct, 1) + "</span>" + ext(t.link) + "</div></div>");
    });
    h.push("</div>");
    $("#journal-body").innerHTML = h.join("");
  }

  /* ---------- DESIGN v2 (redesign 2026-11-22): mascots, SVG equity chart, agent cards, messages, whale tracker, confetti.
     Every number comes from state.json / charts.json / agents.json / activity.json. Missing = "—". ---------- */
  var MASCOT = { grok: "#f2f2f7", risk: "#ff9f0a", executor: "#bf5af2", analyst: "#ff453a", auditor: "#8e8e93", scanner: "#30d5c8" };
  var AGENT_NAMES = { grok: "Grok Bot", risk: "Risk", executor: "Executor", analyst: "Analyst", auditor: "Auditor", scanner: "Scanner" };
  var AGENT_SRC = { scanner: "scanner", auditor: "analyst", analyst: "brain", executor: "executor", risk: "risk" };
  function mascot(bot, size) {
    var c = MASCOT[bot] || "#8e8e93", s = size || 32, eye = bot === "grok" ? "#000" : "#111";
    var extra = {
      grok: '<path d="M10 7 L16 3 L22 7" stroke="' + c + '" stroke-width="2" fill="none" stroke-linecap="round"/>',
      risk: '<path d="M16 2 L20 8 H12 Z" fill="' + c + '"/>',
      executor: '<circle cx="16" cy="4" r="2.6" fill="' + c + '"/><path d="M16 6.5 V9" stroke="' + c + '" stroke-width="2"/>',
      analyst: '<rect x="9" y="5" width="14" height="3" rx="1.5" fill="' + c + '"/>',
      auditor: '<circle cx="25" cy="21" r="4" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M28 24 L30 26" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
      scanner: '<path d="M8 6 Q16 0 24 6" stroke="' + c + '" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M11 8 Q16 4.5 21 8" stroke="' + c + '" stroke-width="2" fill="none" stroke-linecap="round"/>'
    }[bot] || "";
    return '<svg class="mascot" width="' + s + '" height="' + s + '" viewBox="0 0 32 32" aria-hidden="true">' + extra +
      '<rect x="5" y="9" width="22" height="19" rx="8" fill="' + c + '"/>' +
      '<ellipse cx="12.5" cy="18" rx="2.4" ry="3" fill="' + eye + '"/><ellipse cx="19.5" cy="18" rx="2.4" ry="3" fill="' + eye + '"/>' +
      '<circle cx="13.2" cy="16.9" r="0.8" fill="#fff"/><circle cx="20.2" cy="16.9" r="0.8" fill="#fff"/>' +
      '<path d="M13 23.5 Q16 25.5 19 23.5" stroke="' + eye + '" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>';
  }
  function coinAvatar(sym, mint, size) {
    var s = size || 20, label = (sym || (mint || "?")).replace(/^\$/, "").slice(0, 1).toUpperCase(), h = 0, k = mint || sym || "";
    for (var i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) % 360;
    return '<span class="coin-av" style="width:' + s + "px;height:" + s + "px;font-size:" + Math.round(s * 0.5) + "px;background:hsl(" + h + ',60%,45%)">' + esc(label) + "</span>";
  }
  function agSym(m) { var A = S.agents || {}; return (m && ((A.symbols || {})[m] || S.sym[m])) || short(m); }
  function hbRunning(src) { var h = ((S.agents || {}).heartbeats || {})[src]; if (h) return !!h.running; var b = ((S.state || {}).bots || []).filter(function (x) { return x.name === src; })[0]; return b ? b.status === "running" : null; }
  function sinceTxt(ts) { if (!ts) return DASH; var s = Date.now() / 1000 - ts; if (s < 60) return "now"; if (s < 3600) return Math.round(s / 60) + "m"; if (s < 86400) return Math.round(s / 3600) + "h"; return Math.round(s / 86400) + "d"; }
  function money(n) { if (n == null || !isFinite(n)) return DASH; return (n >= 0 ? "+" : "-") + "$" + Math.abs(n).toFixed(2); }

  /* balance change line: real FOMO equity vs first real reading this session (agents.realBalance.baseline) */
  function realBal() { return S.agents ? S.agents.realBalance || null : null; }
  function renderChange() {
    var rb = realBal(), tp = $("#today-pct"), src = $("#bal-src");
    if (!rb) { tp.innerHTML = '<span class="muted">' + DASH + "</span>"; tp.className = "today num"; src.textContent = S.agents ? "Real balance: no data" : "Loading real balance…"; return; }
    if (!rb.ok || rb.equityUsd == null) {
      tp.innerHTML = '<span class="muted">' + DASH + "</span>"; tp.className = "today num";
      src.textContent = "Real balance unavailable: " + (rb.reason || (rb.unpriced ? rb.unpriced + " holding(s) without a FOMO price" : "no data")) + " · " + hm(rb.ts);
      return;
    }
    var base = rb.baseline, d = base ? rb.equityUsd - base.equityUsd : null, p = base && base.equityUsd ? 100 * d / base.equityUsd : null;
    var lbl = !base ? "" : (/session start/.test(base.note || "") && !/first/.test(base.note || "") ? "this session" : "since " + hm(base.ts));
    if (d == null) { tp.innerHTML = '<span class="muted">' + DASH + "</span>"; tp.className = "today num"; }
    else { var up = d >= 0; tp.innerHTML = (up ? "▲ " : "▼ ") + esc(money(d)) + " (" + esc(pct(p)) + ') <span class="muted">' + esc(lbl) + "</span>"; tp.className = "today num " + (up ? "green" : "red"); }
    src.textContent = "Cash " + usd(rb.cashUsd) + " · Holdings " + usd(rb.holdingsUsd) + " · FOMO " + hm(rb.ts);
  }

  /* SVG equity chart: green gradient, dots, floating trade-PnL markers with coin avatars */
  var RANGE_S = { "1H": 3600, "4H": 14400, "1D": 86400, "1W": 604800 };
  function chartFor(rg) { /* real FOMO balance readings only (agents.realBalance.history) */
    var rb = realBal(); if (!rb) return null;
    var h = rb.history || [], now = Date.now() / 1000, cur = ((S.agents || {}).session || {}).current;
    var from = rg === "LIVE" ? (cur ? cur.started_at : 0) : rg === "ALL" ? 0 : now - RANGE_S[rg];
    return { range: rg, points: h.filter(function (p) { return p.ts >= from; }), marks: [] };
  }
  function renderChart() {
    var c = chartFor(S.range), el = $("#eq-chart"); if (!el) return;
    $("#chart-sk").classList.add("hidden");
    var pts = ((c && c.points) || []).filter(function (p) { return p && p.value != null && isFinite(p.value); });

    $("#chart-empty").classList.toggle("hidden", pts.length > 0);
    if (!pts.length) { el.innerHTML = ""; $("#chart-marks").innerHTML = ""; return; }
    var W = el.clientWidth || 360, H = el.clientHeight || 210, pl = 6, pr = 6, pt = 34, pb = 14;
    var t0 = pts[0].ts, t1 = pts[pts.length - 1].ts, lo = Infinity, hi = -Infinity;

    if (t1 <= t0) { t1 = t0 + 1; }
    pts.forEach(function (p) { lo = Math.min(lo, p.value); hi = Math.max(hi, p.value); });
    var minSpan = Math.max(0.5, Math.abs(hi) * 0.04); /* keep cents-level noise flat */
    if (hi - lo < minSpan) { var mid = (hi + lo) / 2; lo = mid - minSpan / 2; hi = mid + minSpan / 2; } else { var pad = (hi - lo) * 0.12; lo -= pad; hi += pad; }
    var X = function (t) { return pts.length === 1 ? W / 2 : pl + (W - pl - pr) * (t - t0) / (t1 - t0); };
    var Y = function (v) { return pt + (H - pt - pb) * (1 - (v - lo) / (hi - lo)); };
    var line = pts.map(function (p, i) { return (i ? "L" : "M") + X(p.ts).toFixed(1) + " " + Y(p.value).toFixed(1); }).join(" ");
    if (pts.length === 1) line = "M" + pl + " " + Y(pts[0].value).toFixed(1) + " L" + (W - pr) + " " + Y(pts[0].value).toFixed(1);
    var first = pts.length === 1 ? pl : X(pts[0].ts), last = pts.length === 1 ? W - pr : X(pts[pts.length - 1].ts);
    var area = line + " L" + last.toFixed(1) + " " + H + " L" + first.toFixed(1) + " " + H + " Z";
    var up = pts[pts.length - 1].value >= pts[0].value, col = up ? "var(--green)" : "var(--red)";
    var dots = pts.map(function (p) { return '<circle cx="' + (pts.length === 1 ? W / 2 : X(p.ts)).toFixed(1) + '" cy="' + Y(p.value).toFixed(1) + '" r="3" fill="' + col + '" stroke="#000" stroke-width="1.5"/>'; }).join("");
    el.innerHTML = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '"><defs><linearGradient id="eqg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + (up ? "#00d35a" : "#ff453a") + '" stop-opacity="0.38"/><stop offset="1" stop-color="' + (up ? "#00d35a" : "#ff453a") + '" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#eqg)"/><path class="eq-line" d="' + line + '" fill="none" stroke="' + col + '" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>' + dots + "</svg>";
    /* markers: real closed trades (agents.closedTrades) inside the range window */
    var trades = ((S.agents || {}).closedTrades || []).filter(function (t) { return t.ts >= t0 - 60 && t.ts <= Math.max(t1, Date.now() / 1000); }).slice(0, 4);
    var valAt = function (ts) { var best = pts[0]; pts.forEach(function (p) { if (Math.abs(p.ts - ts) < Math.abs(best.ts - ts)) best = p; }); return best.value; };
    $("#chart-marks").innerHTML = trades.map(function (t, i) {
      var x = Math.max(4, Math.min(W - 110, (pts.length === 1 ? W / 2 : X(Math.min(Math.max(t.ts, t0), t1))) - 40)), y = Math.max(0, Y(valAt(t.ts)) - 34 - (i % 2) * 18);
      return '<a class="pnl-mark ' + (t.pnl >= 0 ? "up" : "down") + '" href="' + esc(t.link) + '" target="_blank" rel="noopener" style="left:' + x + "px;top:" + y + 'px">' + coinAvatar(agSym(t.mint), t.mint, 18) + "<b>" + esc(money(t.pnl)) + "</b></a>";
    }).join("");
  }

  /* AGENTS carousel (5 cards, scroll-snap, page dots) */
  function cardWrap(key, label, body) {
    var run = hbRunning(AGENT_SRC[key]);
    return '<button class="ag-card" data-agent="' + key + '"><div class="ag-head">' + mascot(key, 30) + '<div class="ag-name">' + AGENT_NAMES[key] + '<span class="ag-state ' + (run ? "on" : run === false ? "off" : "") + '">' + (run ? "running" : run === false ? "offline" : DASH) + '</span></div><span class="ag-label num">' + esc(label) + '</span></div><div class="ag-body">' + body + "</div></button>";
  }
  function nv(v) { return v == null ? DASH : String(v); }
  function agentCards() {
    var A = S.agents || {}, st = S.state || {}, bots = {}; (st.bots || []).forEach(function (b) { bots[b.name] = b; });
    var sc = A.scanner || {}, au = A.auditor || {}, an = A.analyst || {}, ex = A.executor || {}, rk = A.risk || {};
    var cards = [];
    /* Scanner */
    var rec = (sc.recent || []).slice(0, 4);
    cards.push(cardWrap("scanner", nv(sc.poolsSession) + " pools",
      '<div class="ag-kv"><span>Rejected</span><b class="num">' + nv(sc.killedSession) + '</b><span>Passed</span><b class="num">' + nv(sc.passedSession) + "</b></div>" +
      (rec.length ? rec.map(function (r) { return '<div class="rej-row ' + (r.verdict === "pass" ? "pass" : "") + '">' + coinAvatar(agSym(r.mint), r.mint, 18) + '<s class="sym">' + esc(agSym(r.mint)) + '</s><span class="why">' + esc(r.verdict === "pass" ? "→ Auditor" : (r.reason || r.verdict)) + "</span></div>"; }).join("") : '<div class="muted sm">no data</div>')));
    /* Auditor */
    var L = (au.last && au.last.layers) || [], bars = "";
    for (var i = 0; i < 7; i++) { var l = L[i]; bars += '<div class="chk"><span class="chk-bar ' + (l ? (l.pass ? "ok" : "bad") : "") + '"></span><span class="chk-n">' + esc(l ? l.name : "—") + "</span></div>"; }
    cards.push(cardWrap("auditor", nv(au.takenApartSession) + " taken apart",
      '<div class="chk-list">' + bars + '</div><div class="ag-kv"><span>Top 10 hold</span><b class="num">' + (au.last && au.last.top10Pct != null ? Math.round(au.last.top10Pct) + "%" : DASH) + '</b><span>Rejected</span><b class="num">' + nv(au.rejectedSession) + "</b></div>" +
      '<div class="muted sm">Last: ' + (au.last ? esc(agSym(au.last.mint)) + " · " + hm(au.last.ts) : DASH) + " · all-time " + nv(au.takenApartAll) + "</div>"));
    /* Analyst (score ring) + Brain sizing */
    var last = an.last || {}, sz = bots.brain || {};
    cards.push(cardWrap("analyst", nv(an.scoredSession) + " scored",
      '<div class="an-row"><div class="ring"><canvas data-score="' + (last.score == null ? "" : last.score) + '"></canvas><b>' + (last.score == null ? DASH : Math.round(last.score)) + '</b></div><div class="an-txt"><div>' + (last.mint ? esc(agSym(last.mint)) : DASH) + '</div><div class="muted sm">' + esc(last.mint ? (last.pass ? "passed" : (last.reason || "rejected")) : "no score yet") + "</div></div></div>" +
      '<div class="ag-kv"><span>Next size</span><b class="num">' + (sz.sizeUsd != null ? usd(sz.sizeUsd) : DASH) + '</b><span>Of cash</span><b class="num">' + (sz.pctOfCash != null ? Math.round(sz.pctOfCash) + "%" : DASH) + "</b></div>"));
    /* Executor */
    var o = ex.last;
    cards.push(cardWrap("executor", nv(ex.ordersSession) + " orders",
      (o ? '<div class="ex-last">' + coinAvatar(agSym(o.mint), o.mint, 22) + "<div><div>" + esc((o.side === "buy" ? "Bought " : "Sold ") + agSym(o.mint)) + '</div><div class="muted sm">' + esc((o.usd != null ? usd(o.usd) : DASH) + " · " + (o.reason || "") + " · " + o.status + " · " + hm(o.ts)) + "</div></div></div>" : '<div class="muted sm">no orders yet</div>') +
      '<div class="bar' + (/Bought/.test((bots.executor || {}).bar || "") ? " green" : "") + '">' + esc((bots.executor || {}).bar || DASH) + "</div>"));
    /* Risk */
    var rb = bots.risk || {};
    cards.push(cardWrap("risk", nv(rk.open != null ? rk.open : rb.open) + " open",
      '<div class="pills">' + (rb.pills || []).map(function (p) { return '<span class="pill mono ' + esc(p.color) + '">' + esc(p.text) + "</span>"; }).join("") + "</div>" +
      (st.positions || []).slice(0, 2).map(function (p) { return '<div class="ex-last">' + coinAvatar(agSym(p.mint), p.mint, 22) + "<div><div>" + esc(p.symbol || agSym(p.mint)) + (p.origin === "adopted" ? ' <span class="muted sm">watch-only</span>' : "") + '</div><div class="sm ' + (p.pnl_pct >= 0 ? "green" : "red") + '">' + esc(usd(p.value_usd) + " · " + pct(p.pnl_pct, 1)) + "</div></div></div>"; }).join("")));
    return cards;
  }
  function renderCarousel() {
    var cards = agentCards(), run = 0;
    ["scanner", "auditor", "analyst", "executor", "risk"].forEach(function (k) { if (hbRunning(AGENT_SRC[k])) run++; });
    $("#bots-head").textContent = "Agents"; $("#agents-running").textContent = run + " running";
    var el = $("#bot-carousel"), keep = el.scrollLeft;
    el.innerHTML = cards.join(""); el.scrollLeft = keep;
    $("#carousel-dots").innerHTML = cards.map(function (_, i) { return '<span class="cdot' + (i === 0 ? " on" : "") + '"></span>'; }).join("");
    paintRings(el); syncDots();
  }
  function syncDots() {
    var el = $("#bot-carousel"), cs = el.children; if (!cs.length) return;
    var w = cs[0].offsetWidth + 12, i = Math.round(el.scrollLeft / w);
    $$("#carousel-dots .cdot").forEach(function (d, j) { d.classList.toggle("on", j === Math.min(i, cs.length - 1)); });
  }

  /* ACTIVITY: desk activity rows + real closed trades (Sold X · reason · time · +$ / %) */
  function mergedActivity() {
    var rows = ((S.activity && S.activity.rows) || []).map(function (r) { return { r: r, ts: r.ts }; });
    ((S.agents || {}).closedTrades || []).forEach(function (t) {
      var dup = rows.some(function (x) { return x.r.mint === t.mint && Math.abs(x.ts - t.ts) < 5 && /sold|stopped/.test(x.r.kind); });
      if (!dup) rows.push({ t: t, ts: t.ts });
    });
    rows.sort(function (a, b) { return b.ts - a.ts; });
    return rows;
  }
  function actRow2(x) {
    if (x.t) {
      var t = x.t, up = t.pnl >= 0;
      return '<div class="row tap" role="button" data-mint="' + esc(t.mint) + '" data-kind="sold"><div class="row-av">' + coinAvatar(agSym(t.mint), t.mint, 34) + '</div><div class="row-main"><div class="row-title">Sold ' + esc(agSym(t.mint)) + '</div><div class="row-sub">' + esc((t.reason || "") + " · " + (t.mode || "") + " · " + hm(t.ts)) + '</div></div><div class="row-val"><span class="' + (up ? "green" : "red") + ' num">' + esc(money(t.pnl)) + '</span><span class="sm num ' + (up ? "green" : "red") + '">' + esc(pct(t.pct, 1)) + '</span><a class="fomo" href="' + esc(t.link) + '" target="_blank" rel="noopener">FOMO</a></div></div>';
    }
    var r = x.r, bot = r.bot === "analyst" ? "auditor" : r.bot === "brain" ? "analyst" : (MASCOT[r.bot] ? r.bot : null);
    var title = r.title || (cap(r.kind) + " " + symOf(r.mint));
    var sub = (r.subtitle || cap(r.bot || "")) + " · " + hm(r.ts);
    var val = r.kind === "rejected" ? "Skipped" : (r.value || DASH);
    var cls = r.kind === "sold" ? "green" : r.kind === "stopped" ? "red" : r.kind === "rejected" ? "muted" : "";
    var link = r.link || (r.mint ? Links.coinUrl(r.mint) : "");
    return '<div class="row tap" role="button" data-mint="' + esc(r.mint || "") + '" data-kind="' + esc(r.kind) + '"><div class="row-av">' + (r.mint ? coinAvatar(agSym(r.mint), r.mint, 34) : mascot(bot || "grok", 34)) + '</div><div class="row-main"><div class="row-title">' + esc(title) + '</div><div class="row-sub">' + esc(sub) + '</div></div><div class="row-val"><span class="' + cls + ' sm">' + esc(val) + "</span>" + (link ? '<a class="fomo" href="' + esc(link) + '" target="_blank" rel="noopener">FOMO</a>' : "") + "</div></div>";
  }
  function renderHomeActivity() {
    var rows = mergedActivity().slice(0, 5), el = $("#home-activity");
    el.outerHTML = rows.length ? '<div class="list" id="home-activity">' + rows.map(actRow2).join("") + "</div>" : '<div class="list" id="home-activity" style="background:none"><div class="empty">no data</div></div>';
  }
  function renderActivityTab() {
    var rows = mergedActivity(), el = $("#activity-list");
    el.style.background = rows.length ? "" : "none";
    el.innerHTML = rows.length ? rows.map(actRow2).join("") : '<div class="empty">Nothing yet tonight</div>';
    $("#activity-more").classList.toggle("hidden", !(S.activity && S.activity.next) || planB());
  }

  /* MESSAGES (Agents tab): last real line per bot, blue dot = newer than last time you opened it */
  function botMessages() {
    var A = S.agents || {}, g = (A.grok || {}).nightReport, cur = (A.session || {}).current, out = [];
    var gtxt = g ? ("Night " + g.date + ": " + (g.empty ? "no trades" : (g.green + " green · " + g.red + " red · " + g.flat + " flat")) + (g.feesPaid != null ? " · fees " + usd(g.feesPaid) : "")) : null;
    if (cur) gtxt = (gtxt ? gtxt + " · " : "") + cur.mode + " session open since " + hm(cur.started_at);
    out.push({ bot: "grok", text: gtxt, ts: cur ? cur.started_at : (g && g.window ? g.window.ended_at : null) });
    var pick = function (bot, o) { var l = (o || {}).lastLog; out.push({ bot: bot, text: l ? l.text : null, ts: l ? l.ts : null }); };
    pick("risk", A.risk); pick("executor", A.executor); pick("analyst", A.analyst); pick("auditor", A.auditor); pick("scanner", A.scanner);
    return out;
  }
  function seenMap() { try { return JSON.parse(localStorage.getItem("desk.msgSeen") || "{}"); } catch (e) { return {}; } }
  function renderMessages() {
    var seen = seenMap(), el = $("#msg-list"); if (!el) return;
    el.innerHTML = botMessages().map(function (m) {
      var unread = m.ts && m.ts > (seen[m.bot] || 0);
      return '<button class="msg-row" data-msg="' + m.bot + '"><span class="msg-av">' + mascot(m.bot, 40) + '</span><span class="msg-main"><span class="msg-top"><b style="color:' + (m.bot === "grok" ? "#fff" : MASCOT[m.bot]) + '">' + AGENT_NAMES[m.bot] + '</b><span class="msg-time">' + (m.ts ? hm(m.ts) : "") + '</span></span><span class="msg-text">' + esc(m.text || "no data") + "</span></span>" + (unread ? '<span class="udot"></span>' : '<span class="udot off"></span>') + "</button>";
    }).join("");
  }

  /* WHALE TRACKER (copy desk, read-only) */
  function renderWhale() {
    var el = $("#whale"); if (!el) return;
    var W = (S.agents || {}).copyDesk;
    if (!W) { el.innerHTML = '<div class="wh-card"><div class="wh-title">🐋 Whale Tracker</div><div class="muted">no data</div></div>'; return; }
    el.innerHTML = '<div class="wh-card"><div class="wh-top"><div class="wh-title">🐋 Whale Tracker</div><span class="pill ' + (W.mode === "LIVE" ? "mult" : "paper") + '">' + esc(W.mode || DASH) + '</span></div>' +
      '<div class="wh-grid"><div><span>Accounts</span><b class="num">' + nv(W.accountsCount) + " / " + nv(W.maxAccounts) + '</b></div><div><span>Networks</span><b>' + esc((W.networks || []).join(", ") || DASH) + '</b></div><div><span>Min trade</span><b class="num">' + (W.minTradeUsd != null ? usd(W.minTradeUsd) : DASH) + '</b></div><div><span>Alerts</span><b>' + esc(W.alerts || DASH) + "</b></div></div>" +
      '<div class="wh-status"><span class="sdot ' + (W.running ? "green" : "grey") + '"></span>' + (W.running ? "Running" : "Offline") + " · open copies " + nv(W.openCopies) + " · heartbeat " + (W.heartbeatTs ? hm(W.heartbeatTs) : DASH) + "</div>" +
      '<div class="wh-btns">' + [["accounts", "Accounts"], ["filters", "Filters"], ["recent", "Recent Trades"], ["status", "Status"], ["alerts", "Pause Alerts"], ["language", "Language"]].map(function (b) { return '<button class="wh-btn" data-whale="' + b[0] + '">' + b[1] + "</button>"; }).join("") + "</div></div>";
  }
  function openWhale(kind) {
    var W = (S.agents || {}).copyDesk || {}, h = "";
    if (kind === "accounts") h = (W.accounts || []).length ? '<div class="list">' + W.accounts.map(function (a) { return '<div class="row"><div class="row-main"><div class="row-title">@' + esc(a.handle) + '</div><div class="row-sub">swaps seen ' + nv(a.swapsSeen) + '</div></div><div class="row-val"><a class="fomo" href="' + esc(a.profile) + '" target="_blank" rel="noopener">Profile</a></div></div>'; }).join("") + "</div>" : '<div class="empty">no data</div>';
    else if (kind === "filters") h = '<div class="card"><div class="ag-kv col"><span>Min trade</span><b>' + (W.minTradeUsd != null ? usd(W.minTradeUsd) : DASH) + '</b><span class="sm muted">' + esc(W.minTradeNote || "") + '</span><span>Copy delay</span><b>' + nv(W.delayS) + 's</b><span>Own stop</span><b>' + nv(W.stopPct) + '%</b><span>Poll</span><b>every ' + nv(W.pollS) + 's</b><span>Networks</span><b>' + esc((W.networks || []).join(", ") || DASH) + "</b></div></div>";
    else if (kind === "recent") h = (W.recent || []).length ? '<div class="list">' + W.recent.map(function (r) { return '<div class="row"><div class="row-main"><div class="row-title sm">' + esc(r.text) + '</div><div class="row-sub">' + esc(r.time) + "</div></div>" + (r.link ? '<div class="row-val"><a class="fomo" href="' + esc(r.link) + '" target="_blank" rel="noopener">FOMO</a></div>' : "") + "</div>"; }).join("") + "</div>" : '<div class="empty">no data</div>';
    else if (kind === "status") h = '<div class="card"><div class="ag-kv col"><span>Process</span><b>' + (W.running ? "running" : "offline") + '</b><span>Mode</span><b>' + esc(W.mode || DASH) + '</b><span>Open copies</span><b>' + nv(W.openCopies) + '</b><span>Heartbeat</span><b>' + (W.heartbeatTs ? hm(W.heartbeatTs) : DASH) + "</b></div></div>";
    else if (kind === "alerts") h = '<div class="card">Alerts: <b>' + esc(W.alerts || DASH) + '</b><div class="muted sm" style="margin-top:8px">The app is read-only here. Pausing or changing the copy desk is done by you through the desk settings (change_log, who = you).</div></div>';
    else if (kind === "language") h = '<div class="card">App language: <b>English</b><div class="muted sm" style="margin-top:8px">Display only. No desk setting changes from here.</div></div>';
    openLayer({ accounts: "Accounts", filters: "Filters", recent: "Recent Trades", status: "Status", alerts: "Pause Alerts", language: "Language" }[kind] || "Whale Tracker", "", h);
  }

  /* CONFETTI: only when the last closed session ended above its start cash (nights table), once per session id */
  function maybeConfetti() {
    var lc = ((S.agents || {}).session || {}).lastClosed; if (!lc || !lc.profit || reduce) return;
    var key = "desk.confetti." + lc.id; if (localStorage.getItem(key)) return; localStorage.setItem(key, "1");
    var cv = document.createElement("canvas"); cv.className = "confetti"; document.body.appendChild(cv);
    var W = cv.width = innerWidth, H = cv.height = innerHeight, x = cv.getContext("2d"), cols = ["#00d35a", "#ffd60a", "#0a84ff", "#ff9f0a", "#bf5af2", "#ff453a"], P = [];
    for (var i = 0; i < 140; i++) P.push({ x: Math.random() * W, y: -Math.random() * H * 0.5, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4, r: Math.random() * 6.28, c: cols[i % cols.length] });
    var t = 0; (function f() { x.clearRect(0, 0, W, H); P.forEach(function (p) { p.x += p.vx; p.y += p.vy; p.r += 0.1; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-4, -2, 8, 4); x.restore(); }); if (++t < 180) requestAnimationFrame(f); else cv.remove(); })();
    toast("Session closed in profit: " + money(lc.pnl));
  }
  function renderDesign() { renderChange(); renderMessages(); renderWhale(); maybeConfetti(); }

  /* ---------- tabs & events ---------- */
  function setTab(t) {
    if (["home", "bots", "activity", "market", "journal", "account"].indexOf(t) < 0) t = "home";
    S.tab = t;
    $$(".view").forEach(function (v) { v.classList.toggle("hidden", v.dataset.tab !== t); });
    $$(".tab").forEach(function (b) { b.classList.toggle("on", b.dataset.tab === t); });
    window.scrollTo(0, 0);
    if (t === "bots") loadDecisions();
    if (t === "account") loadAccount(true);
    if (t === "market") loadMarket();
    if (t === "journal") loadJournal();
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
    if (rb) { S.range = rb.dataset.range; $$("#range-switch button").forEach(function (b) { b.classList.toggle("on", b === rb); }); renderChart(); return; }
    var card = t.closest(".ag-card"); if (card) { setTab("bots"); var el = $("#bot-" + AGENT_SRC[card.dataset.agent]); if (el) setTimeout(function () { el.scrollIntoView(); }, 50); return; }
    var mr = t.closest(".msg-row"); if (mr) { var sm = seenMap(); sm[mr.dataset.msg] = Math.floor(Date.now() / 1000); localStorage.setItem("desk.msgSeen", JSON.stringify(sm)); renderMessages(); var src = AGENT_SRC[mr.dataset.msg]; var be = src && $("#bot-" + src); if (be) be.scrollIntoView({ behavior: "smooth" }); else setTab("activity"); return; }
    var wb = t.closest("[data-whale]"); if (wb) return openWhale(wb.dataset.whale);
    var go = t.closest("[data-go]"); if (go) return setTab(go.dataset.go);
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
  window.addEventListener("resize", function () { if (S.chart || S.charts) renderChart(); });
  $("#bot-carousel").addEventListener("scroll", function () { syncDots(); }, { passive: true });
  $("#avatar-letter").outerHTML = mascot("grok", 32);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) refreshSoon(); });

  /* ---------- boot ---------- */
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
  renderLoading();
  setTab(startTab);
  refresh();
  startStream();
  setInterval(screenTick, planB() ? 15000 : 1000); screenTick();
  setInterval(renderScreenAge, 1000);
  setInterval(function () { if (document.hidden) return; if (S.tab === "market") loadMarket(); if (S.tab === "journal") loadJournal(); }, 60000);
  window.__desk = S;
})();
