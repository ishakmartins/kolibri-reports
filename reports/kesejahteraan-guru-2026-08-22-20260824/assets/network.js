/* Kolibri report page — interactive engagement network map. Vendored, no CDN: copied
   verbatim into every reports/<slug>/assets/network.js by pipeline/reportpage.py.
   Canvas + vanilla JS, adapted from Lokanetra/Kestrel's own network map widget
   (kestrel-reports/assets/app.js, buildNetwork) — ported the applicable parts (pan/
   zoom, labels, reset view, isolate-by-hops, handle search, word search, playback,
   top-accounts list, node click -> tweet panel) and dropped what doesn't apply here:
   Tier 1/2/3 amplification evidence and X-ray mode (this pipeline runs no
   coordination/amplification detection), and verification badges (not a field this
   pipeline's CSV loader extracts). Edge colour is tie_type (reply/quote) — a future
   version may recolor edges by emotion label once Section 3's per-tie emotion
   classification covers full ties, not just the top-engagement sample (see
   CHANGELOG.md).

   Reads window.KOLIBRI_NETWORK (set by the co-located network_data.js — a plain
   script assignment, not JSON, because a report page opened via file:// can't
   fetch()). Mounts into #kolibri-network if both are present; index.html shows a
   static fallback (network_map.png) when a packet has zero surviving ties, so this
   file only needs to handle the "there is data" case.
*/
(function () {
  'use strict';
  var N = window.KOLIBRI_NETWORK;
  var root = document.getElementById('kolibri-network');
  if (!N || !root || !N.nodes || !N.nodes.length) return;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var el = function (t, cls, txt) {
    var n = document.createElement(t);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };
  var fmt = function (n) { return (n == null ? '—' : Number(n).toLocaleString('en-US')); };
  function cssv(name) { return getComputedStyle(document.body).getPropertyValue(name).trim(); }

  var nodes = N.nodes, edges = N.edges, tieTypes = N.tie_types || [], tieColors = N.tie_colors || [];
  var tweets = N.tweets || {}, userTweets = N.user_tweets || {};
  var idx = {};
  nodes.forEach(function (n, i) { idx[String(n[0]).toLowerCase()] = i; });

  function tw(id) {
    var r = tweets[id];
    if (!r) return null;
    return {
      id: id, user: r.u, text: r.x, likes: r.l, retweets: r.rt, replies: r.r, quotes: r.q,
      total: r.t, when: r.w, url: r.url || ('https://x.com/' + r.u + '/status/' + id)
    };
  }
  function tws(ids) {
    var out = [], i, c;
    for (i = 0; i < (ids || []).length; i++) { c = tw(ids[i]); if (c) out.push(c); }
    return out;
  }

  function tweetCard(c) {
    var t = el('div', 'kn-tweet');
    var h = el('div', 'kn-h');
    h.appendChild(el('span', 'kn-u', '@' + (c.user || '')));
    h.appendChild(el('span', 'kn-t', c.when || ''));
    t.appendChild(h);
    t.appendChild(el('p', null, c.text || ''));
    var s = el('div', 'kn-s');
    [['Likes', c.likes], ['Retweets', c.retweets], ['Replies', c.replies],
     ['Quotes', c.quotes], ['Total engagement', c.total]].forEach(function (kv) {
      var w = el('span');
      w.appendChild(el('b', null, fmt(kv[1])));
      w.appendChild(document.createTextNode(' ' + kv[0]));
      s.appendChild(w);
    });
    t.appendChild(s);
    if (c.url) {
      var go = el('a', 'kn-go', 'Open on X');
      go.href = c.url; go.target = '_blank'; go.rel = 'noopener';
      t.appendChild(go);
    }
    return t;
  }

  /* ---------- top accounts side panel ---------------------------------- */
  function buildAccountList(onSelect) {
    var box = el('div', 'kn-panel');
    var bar = el('div', 'kn-bar');
    bar.appendChild(el('h3', null, 'Top accounts'));
    bar.appendChild(el('div', 'kn-sp'));
    var mode = el('select');
    [['n100', 'Top 100'], ['pct', 'Top %']].forEach(function (o) {
      var opt = el('option', null, o[1]); opt.value = o[0]; mode.appendChild(opt);
    });
    bar.appendChild(mode);
    var pctInput = el('input');
    pctInput.type = 'number'; pctInput.min = 1; pctInput.max = 100; pctInput.value = 5;
    pctInput.style.width = '56px'; pctInput.hidden = true;
    bar.appendChild(pctInput);
    box.appendChild(bar);
    var list = el('div', 'kn-scroll');
    box.appendChild(list);

    function render() {
      var ranked = nodes.map(function (n, i) { return [i, n]; }).sort(function (a, b) { return b[1][3] - a[1][3]; });
      var n = mode.value === 'pct'
        ? Math.max(1, Math.round(ranked.length * (Number(pctInput.value) || 5) / 100))
        : 100;
      var top = ranked.slice(0, n);
      list.innerHTML = '';
      var t = el('table', 'kn-tbl');
      var tb = el('tbody');
      top.forEach(function (row) {
        var tr = el('tr');
        tr.appendChild(el('td', null, '@' + row[1][0]));
        tr.appendChild(el('td', null, fmt(row[1][3])));
        tr.onclick = function () { onSelect(row[1][0]); };
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      list.appendChild(t);
    }
    mode.onchange = function () { pctInput.hidden = mode.value !== 'pct'; render(); };
    pctInput.oninput = render;
    render();
    return box;
  }

  /* ---------- chrome: view/filter/nav bars ------------------------------ */
  var opts = { labels: false, iso: false, hops: N.isolate_hops || 3, tie: {}, prog: 1 };
  tieTypes.forEach(function (t) { opts.tie[t] = true; });

  var wrap = el('div', 'kn-wrap');
  var viewBar = el('div', 'kn-bar');
  var filterBar = el('div', 'kn-bar');
  var navBar = el('div', 'kn-bar');

  viewBar.appendChild(el('span', 'kn-note', 'View:'));
  var labelCount = nodes.filter(function (n) { return n[4]; }).length;
  var labelBtn = el('button', null, 'Labels (top ' + labelCount + ')');
  labelBtn.setAttribute('aria-pressed', 'false');
  labelBtn.onclick = function () {
    opts.labels = !opts.labels;
    labelBtn.setAttribute('aria-pressed', String(opts.labels));
    draw();
  };
  viewBar.appendChild(labelBtn);
  viewBar.appendChild(el('div', 'kn-sp'));
  var reset = el('button', null, 'Reset view');
  viewBar.appendChild(reset);

  filterBar.appendChild(el('span', 'kn-note', 'Tie type:'));
  tieTypes.forEach(function (t, ti) {
    var l = el('label', 'kn-chk');
    var c = el('input');
    c.type = 'checkbox'; c.checked = true;
    c.onchange = function () { opts.tie[t] = c.checked; draw(); };
    l.appendChild(c);
    var sw = el('i'); sw.style.background = tieColors[ti] || cssv('--bd');
    l.appendChild(sw);
    l.appendChild(document.createTextNode(t));
    filterBar.appendChild(l);
  });

  navBar.appendChild(el('span', 'kn-note', 'Find & isolate:'));
  var isoBox = el('input');
  isoBox.type = 'checkbox';
  var isoLabel = el('label', 'kn-chk');
  isoLabel.appendChild(isoBox);
  isoLabel.appendChild(document.createTextNode('Isolate selection'));
  navBar.appendChild(isoLabel);
  var hopSel = el('select');
  [1, 2, 3, 4, 5].forEach(function (h) {
    var o = el('option', null, h + ' hop' + (h > 1 ? 's' : ''));
    o.value = String(h);
    hopSel.appendChild(o);
  });
  hopSel.value = String(opts.hops);
  hopSel.onchange = function () { opts.hops = Number(hopSel.value); draw(); };
  isoBox.onchange = function () { opts.iso = isoBox.checked; draw(); };
  navBar.appendChild(hopSel);

  navBar.appendChild(el('div', 'kn-sp'));
  var search = el('input');
  search.type = 'search'; search.placeholder = 'find @handle';
  var findBtn = el('button', null, 'Find');
  navBar.appendChild(search); navBar.appendChild(findBtn);
  var wordSearch = el('input');
  wordSearch.type = 'search'; wordSearch.placeholder = 'find tweets by word';
  var wordBtn = el('button', null, 'Find text');
  navBar.appendChild(wordSearch); navBar.appendChild(wordBtn);

  wrap.appendChild(viewBar);
  wrap.appendChild(filterBar);
  wrap.appendChild(navBar);

  var play = el('div', 'kn-bar');
  var playBtn = el('button', null, '▶ Play');
  var scrub = el('input');
  scrub.type = 'range'; scrub.min = 0; scrub.max = 1000; scrub.value = 1000; scrub.step = 1;
  var clock = el('span', 'kn-note', '');
  play.appendChild(playBtn); play.appendChild(scrub); play.appendChild(clock);
  wrap.appendChild(play);

  var netwrap = el('div', 'kn-netwrap');
  var cv = el('canvas', 'kn-canvas');
  var side = el('div', 'kn-side');
  side.appendChild(buildAccountList(function (h) { findUser(h); }));
  var nodeInfo = el('div');
  side.appendChild(nodeInfo);
  nodeInfo.appendChild(el('div', 'kn-empty', 'Click a node, or search a handle or a word, to inspect ' +
                          'the account and its top-engagement tweets in this packet.'));
  netwrap.appendChild(cv);
  netwrap.appendChild(side);
  wrap.appendChild(netwrap);

  var legend = el('div', 'kn-legend');
  wrap.appendChild(legend);

  if (N.search_pool_size < N.total_tweets) {
    var note = el('div', 'kn-note');
    note.style.marginTop = '6px';
    note.textContent = 'Node click / word search cover the top ' + fmt(N.search_pool_size) +
      ' tweets by engagement in this packet (of ' + fmt(N.total_tweets) + ' total) — not the full corpus.';
    wrap.appendChild(note);
  }
  root.appendChild(wrap);

  /* ---------- view transform --------------------------------------------- */
  var xs = nodes.map(function (n) { return n[1]; }), ys = nodes.map(function (n) { return n[2]; });
  var bounds = { x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs),
                 y0: Math.min.apply(null, ys), y1: Math.max.apply(null, ys) };
  var view = { z: 1, px: 0, py: 0 }, W = 0, H = 0, base = 1, ctx = cv.getContext('2d');
  function resize() {
    var r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    base = 0.92 * Math.min(W / Math.max(bounds.x1 - bounds.x0, 1e-6),
                           H / Math.max(bounds.y1 - bounds.y0, 1e-6));
    draw();
  }
  function sx(x) { return (x - (bounds.x0 + bounds.x1) / 2) * base * view.z + W / 2 + view.px; }
  function sy(y) { return -(y - (bounds.y0 + bounds.y1) / 2) * base * view.z + H / 2 + view.py; }

  /* ---------- animation + isolate state ----------------------------------- */
  var span = N.span_minutes || 0;
  var visible = new Uint8Array(nodes.length);
  var cut = edges.length;
  var adj = null;
  function adjacency() {
    if (adj) return adj;
    adj = new Array(nodes.length);
    for (var i = 0; i < nodes.length; i++) adj[i] = [];
    edges.forEach(function (e) { adj[e[0]].push(e[1]); adj[e[1]].push(e[0]); });
    return adj;
  }
  function withinHops(start, k) {
    var a = adjacency(), seen = new Uint8Array(nodes.length);
    var queue = [start], dist = [0], head = 0;
    seen[start] = 1;
    while (head < queue.length) {
      var u = queue[head], du = dist[head];
      head++;
      if (du >= k) continue;
      var nb = a[u];
      for (var j = 0; j < nb.length; j++) {
        if (!seen[nb[j]]) { seen[nb[j]] = 1; queue.push(nb[j]); dist.push(du + 1); }
      }
    }
    return seen;
  }
  function recompute() {
    var minute = opts.prog * span, i;
    for (cut = 0; cut < edges.length && edges[cut][3] <= minute; cut++) {}
    if (opts.prog >= 1) {
      cut = edges.length;
      visible.fill(1);
    } else {
      visible.fill(0);
      for (i = 0; i < cut; i++) { visible[edges[i][0]] = 1; visible[edges[i][1]] = 1; }
    }
    if (opts.iso && sel != null) {
      var keep = withinHops(sel, opts.hops);
      for (i = 0; i < visible.length; i++) { if (!keep[i]) visible[i] = 0; }
    }
  }

  /* ---------- draw --------------------------------------------------------- */
  function draw() {
    recompute();
    var dim = cssv('--bd'), fg = cssv('--fg'), fg2 = cssv('--fg2'), i, e;
    ctx.clearRect(0, 0, W, H);

    var groups = {}, shown = 0;
    for (i = 0; i < cut; i++) {
      e = edges[i];
      if (!visible[e[0]] || !visible[e[1]]) continue;
      if (!opts.tie[tieTypes[e[2]]]) continue;
      shown++;
      var c = tieColors[e[2]] || dim;
      (groups[c] || (groups[c] = [])).push(e);
    }
    Object.keys(groups).forEach(function (c) {
      ctx.strokeStyle = c;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      groups[c].forEach(function (e) {
        ctx.moveTo(sx(nodes[e[0]][1]), sy(nodes[e[0]][2]));
        ctx.lineTo(sx(nodes[e[1]][1]), sy(nodes[e[1]][2]));
      });
      ctx.stroke();
    });

    ctx.globalAlpha = 1;
    var nshown = 0;
    ctx.fillStyle = fg2;
    ctx.beginPath();
    for (i = 0; i < nodes.length; i++) {
      if (!visible[i]) continue;
      nshown++;
      if (i === sel) continue; // drawn separately, on top
      var r = 1.2 + 1.5 * Math.sqrt(nodes[i][3]);
      r = Math.min(r, 9) * Math.min(1.6, Math.max(0.6, view.z));
      ctx.moveTo(sx(nodes[i][1]) + r, sy(nodes[i][2]));
      ctx.arc(sx(nodes[i][1]), sy(nodes[i][2]), r, 0, 6.2832);
    }
    ctx.fill();
    if (sel != null && visible[sel]) {
      ctx.fillStyle = cssv('--acc');
      var rs = Math.min(1.2 + 1.5 * Math.sqrt(nodes[sel][3]), 9) * Math.min(1.6, Math.max(0.6, view.z));
      ctx.beginPath();
      ctx.arc(sx(nodes[sel][1]), sy(nodes[sel][2]), rs, 0, 6.2832);
      ctx.fill();
    }

    if (opts.labels) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = fg;
      ctx.font = '10px ui-sans-serif, system-ui, Arial, sans-serif';
      for (i = 0; i < nodes.length; i++) {
        if (!nodes[i][4] || !visible[i]) continue;
        var lx = sx(nodes[i][1]), ly = sy(nodes[i][2]);
        if (lx < 0 || lx > W || ly < 0 || ly > H) continue;
        ctx.fillText(nodes[i][0], lx + 5, ly - 4);
      }
    }
    if (matched) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = cssv('--acc');
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      Object.keys(matched).forEach(function (k) {
        var i2 = Number(k);
        if (!visible[i2]) return;
        ctx.beginPath();
        ctx.arc(sx(nodes[i2][1]), sy(nodes[i2][2]), 7, 0, 6.2832);
        ctx.stroke();
      });
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
    clock.textContent = (opts.iso && sel != null
        ? '@' + nodes[sel][0] + ' + ' + opts.hops + ' hop' + (opts.hops > 1 ? 's' : '') +
          ' · ' + fmt(nshown) + ' accounts · ' + fmt(shown) + ' ties'
        : opts.prog >= 1
          ? 'full span · ' + fmt(edges.length) + ' ties'
          : '+' + Math.round(opts.prog * span) + ' min from ' + N.start + ' · ' + fmt(cut) + ' ties');
    drawLegend();
  }

  function drawLegend() {
    legend.innerHTML = '';
    tieTypes.forEach(function (t, i) {
      if (!opts.tie[t]) return;
      var s = el('span');
      var d = el('i'); d.style.background = tieColors[i] || cssv('--bd');
      s.appendChild(d);
      s.appendChild(document.createTextNode(t + ' tie'));
      legend.appendChild(s);
    });
  }

  /* ---------- interaction --------------------------------------------------- */
  var _drawPending = false;
  function requestDraw() {
    if (_drawPending) return;
    _drawPending = true;
    requestAnimationFrame(function () { _drawPending = false; draw(); });
  }
  var sel = null, drag = null, matched = null;
  cv.addEventListener('mousedown', function (ev) {
    drag = { x: ev.clientX, y: ev.clientY, px: view.px, py: view.py, moved: false };
  });
  window.addEventListener('mousemove', function (ev) {
    if (!drag) return;
    view.px = drag.px + (ev.clientX - drag.x);
    view.py = drag.py + (ev.clientY - drag.y);
    if (Math.abs(ev.clientX - drag.x) + Math.abs(ev.clientY - drag.y) > 3) drag.moved = true;
    requestDraw();
  });
  window.addEventListener('mouseup', function () { drag = null; });
  cv.addEventListener('wheel', function (ev) {
    ev.preventDefault();
    var f = Math.exp(-ev.deltaY * 0.0012), r = cv.getBoundingClientRect();
    var mx = ev.clientX - r.left - W / 2, my = ev.clientY - r.top - H / 2;
    view.px = mx - (mx - view.px) * f;
    view.py = my - (my - view.py) * f;
    view.z *= f;
    requestDraw();
  }, { passive: false });
  function hitTest(mx, my) {
    var best = null, bd2 = 16 * 16;
    for (var i = 0; i < nodes.length; i++) {
      if (!visible[i]) continue;
      var dx = sx(nodes[i][1]) - mx, dy = sy(nodes[i][2]) - my, d2 = dx * dx + dy * dy;
      if (d2 < bd2) { bd2 = d2; best = i; }
    }
    return best;
  }
  cv.addEventListener('click', function (ev) {
    if (drag && drag.moved) return;
    var r = cv.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
    var best = hitTest(mx, my);
    matched = null;
    sel = best;
    showNode(best);
    draw();
  });
  cv.addEventListener('mousemove', function (ev) {
    if (drag) return;
    var r = cv.getBoundingClientRect();
    cv.style.cursor = hitTest(ev.clientX - r.left, ev.clientY - r.top) != null ? 'pointer' : 'crosshair';
  });
  reset.onclick = function () { view = { z: 1, px: 0, py: 0 }; draw(); };

  function centreOn(i) {
    view.z = 3;
    view.px = -(nodes[i][1] - (bounds.x0 + bounds.x1) / 2) * base * view.z;
    view.py = (nodes[i][2] - (bounds.y0 + bounds.y1) / 2) * base * view.z;
  }
  function findUser(q) {
    q = String(q || '').trim().replace(/^@/, '').toLowerCase();
    if (!q) return;
    var exact = -1, prefix = -1, i, h;
    for (i = 0; i < nodes.length; i++) {
      h = String(nodes[i][0]).toLowerCase();
      if (h === q) { exact = i; break; }
      if (prefix < 0 && h.indexOf(q) === 0) prefix = i;
    }
    var hit = exact >= 0 ? exact : prefix;
    if (hit < 0) {
      nodeInfo.innerHTML = '';
      nodeInfo.appendChild(el('div', 'kn-empty', 'No account matching "' + q + '" in this map.'));
      return;
    }
    stop();
    opts.prog = 1;
    scrub.value = '1000';
    matched = null;
    sel = hit;
    centreOn(hit);
    showNode(hit);
    draw();
  }
  findBtn.onclick = function () { findUser(search.value); };
  search.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); findUser(search.value); }
  });

  function findByText(q) {
    q = String(q || '').trim().toLowerCase();
    if (!q) return;
    var matchIds = [], matchNodeSet = {}, id;
    for (id in tweets) {
      var r = tweets[id];
      if (r.x && r.x.toLowerCase().indexOf(q) >= 0) {
        matchIds.push(id);
        if (r.u && idx.hasOwnProperty(String(r.u).toLowerCase())) {
          matchNodeSet[idx[String(r.u).toLowerCase()]] = 1;
        }
      }
    }
    matchIds.sort(function (a, b) { return (tweets[b].t || 0) - (tweets[a].t || 0); });
    matched = matchNodeSet;
    sel = null;
    nodeInfo.innerHTML = '';
    var head = el('div', 'kn-panel');
    head.appendChild(el('h3', null, 'Tweets matching "' + q + '"'));
    head.appendChild(el('div', 'kn-note', fmt(matchIds.length) + ' tweet(s) · ' +
      fmt(Object.keys(matchNodeSet).length) + ' account(s) highlighted on the map'));
    var clear = el('button', null, 'Clear search');
    clear.onclick = function () { matched = null; findByTextClear(); };
    head.appendChild(clear);
    nodeInfo.appendChild(head);
    var shown = matchIds.slice(0, 50);
    tws(shown).forEach(function (c) { nodeInfo.appendChild(tweetCard(c)); });
    if (matchIds.length > shown.length) {
      nodeInfo.appendChild(el('div', 'kn-note',
        'Showing the top ' + shown.length + ' by engagement of ' + matchIds.length + ' matches.'));
    }
    draw();
  }
  function findByTextClear() {
    nodeInfo.innerHTML = '';
    nodeInfo.appendChild(el('div', 'kn-empty', 'Click a node, or search a handle or a word, to inspect ' +
                            'the account and its top-engagement tweets in this packet.'));
    draw();
  }
  wordBtn.onclick = function () { findByText(wordSearch.value); };
  wordSearch.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); findByText(wordSearch.value); }
  });

  function showNode(i) {
    nodeInfo.innerHTML = '';
    if (i == null) {
      nodeInfo.appendChild(el('div', 'kn-empty', 'No node there. Click closer to a dot.'));
      return;
    }
    var n = nodes[i];
    var head = el('div', 'kn-panel');
    head.appendChild(el('h3', null, '@' + n[0]));
    head.appendChild(el('div', 'kn-note', 'total engagement: ' + fmt(n[3])));
    nodeInfo.appendChild(head);
    var cs = tws(userTweets[i]);
    if (!cs.length) {
      nodeInfo.appendChild(el('div', 'kn-note', 'No tweet text for this account in the top-engagement ' +
                              'pool (it may appear only as the target of a reply/quote, or below the cutoff).'));
      return;
    }
    cs.forEach(function (c) { nodeInfo.appendChild(tweetCard(c)); });
  }

  /* ---------- playback ------------------------------------------------------ */
  var raf = null, t0 = 0, DUR = 20000;
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    playBtn.textContent = '▶ Play';
  }
  function step(ts) {
    if (!t0) t0 = ts;
    var p = Math.min(1, (ts - t0) / DUR);
    opts.prog = p;
    scrub.value = String(Math.round(p * 1000));
    draw();
    if (p < 1) raf = requestAnimationFrame(step); else stop();
  }
  playBtn.onclick = function () {
    if (raf) { stop(); return; }
    if (opts.prog >= 1) opts.prog = 0;
    t0 = 0;
    playBtn.textContent = '❚❚ Pause';
    raf = requestAnimationFrame(step);
  };
  scrub.oninput = function () {
    stop();
    opts.prog = Number(scrub.value) / 1000;
    draw();
  };

  window.addEventListener('resize', resize);
  setTimeout(resize, 0);
})();
