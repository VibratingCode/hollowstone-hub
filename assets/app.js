/* Dev Hub: tiny no-build single-page site.
   Content lives in /data/*.json, /data/originality.md and /posts/*.md. */
(function () {
  "use strict";

  const app = document.getElementById("app");
  const cache = {};

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  async function load(path, asText) {
    if (cache[path]) return cache[path];
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error("Couldn't load " + path + " (" + res.status + ")");
    const data = asText ? await res.text() : await res.json();
    cache[path] = data;
    return data;
  }

  function fmtDate(d) {
    if (!d) return "";
    const dt = new Date(d + "T12:00:00");
    if (isNaN(dt)) return esc(d);
    return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }

  function bar(p, label) {
    return '<div class="bar" role="progressbar" aria-valuenow="' + p + '" aria-valuemin="0" aria-valuemax="100"' +
      (label ? ' aria-label="' + esc(label) + '"' : "") +
      '><span style="width:' + p + '%"></span></div>';
  }

  // ---------- markdown (small, safe: escapes HTML first) ----------
  function inline(s) {
    s = esc(s);
    const codes = [];
    s = s.replace(/`([^`]+)`/g, function (_, c) { codes.push(c); return "\u0000" + (codes.length - 1) + "\u0000"; });
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (_, alt, src) {
      return '<img src="' + safeUrl(src) + '" alt="' + alt + '" loading="lazy">';
    });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, txt, href) {
      const ext = /^https?:/i.test(href);
      return '<a href="' + safeUrl(href) + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ">" + txt + "</a>";
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<em>$2</em>");
    s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    s = s.replace(/\u0000(\d+)\u0000/g, function (_, i) { return "<code>" + codes[+i] + "</code>"; });
    return s;
  }

  function safeUrl(u) {
    // u is already HTML-escaped; block javascript:/data: style schemes
    return /^\s*(javascript|data|vbscript):/i.test(u) ? "#" : u;
  }

  function markdown(src) {
    const lines = src.replace(/\r\n?/g, "\n").split("\n");
    let html = "", i = 0;
    const isBlockStart = function (l) {
      return /^(#{1,6}\s|```|>\s?|\s*[-*+]\s|\s*\d+[.)]\s|\|)/.test(l) || /^(-{3,}|\*{3,})\s*$/.test(l);
    };
    while (i < lines.length) {
      let line = lines[i];
      if (!line.trim()) { i++; continue; }

      if (/^```/.test(line)) {
        const lang = line.slice(3).trim();
        const buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
        i++;
        html += '<pre><code' + (lang ? ' class="lang-' + esc(lang) + '"' : "") + ">" + esc(buf.join("\n")) + "</code></pre>";
        continue;
      }
      let m = line.match(/^(#{1,6})\s+(.*)$/);
      if (m) {
        const lvl = m[1].length;
        const id = m[2].toLowerCase().replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
        html += "<h" + lvl + ' id="' + id + '">' + inline(m[2]) + "</h" + lvl + ">";
        i++; continue;
      }
      if (/^(-{3,}|\*{3,})\s*$/.test(line)) { html += "<hr>"; i++; continue; }
      if (/^>\s?/.test(line)) {
        const buf = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
        html += "<blockquote>" + markdown(buf.join("\n")) + "</blockquote>";
        continue;
      }
      if (/^\|/.test(line) && i + 1 < lines.length && /^\|?\s*:?-{3,}/.test(lines[i + 1])) {
        const cells = function (l) { return l.trim().replace(/^\||\|$/g, "").split("|").map(function (c) { return c.trim(); }); };
        const head = cells(line);
        i += 2;
        let t = "<div class=\"table-wrap\"><table><thead><tr>" + head.map(function (h) { return "<th>" + inline(h) + "</th>"; }).join("") + "</tr></thead><tbody>";
        while (i < lines.length && /^\|/.test(lines[i])) {
          t += "<tr>" + cells(lines[i++]).map(function (c) { return "<td>" + inline(c) + "</td>"; }).join("") + "</tr>";
        }
        html += t + "</tbody></table></div>";
        continue;
      }
      m = line.match(/^\s*([-*+]|\d+[.)])\s+/);
      if (m) {
        const ordered = /\d/.test(m[1]);
        const re = ordered ? /^\s*\d+[.)]\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/;
        const items = [];
        while (i < lines.length && re.test(lines[i])) {
          let item = lines[i].match(re)[1];
          i++;
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !re.test(lines[i])) item += " " + lines[i++].trim();
          const task = item.match(/^\[([ xX])\]\s+(.*)$/);
          items.push(task
            ? '<li class="task-item"><input type="checkbox" disabled' + (task[1] !== " " ? " checked" : "") + "> " + inline(task[2]) + "</li>"
            : "<li>" + inline(item) + "</li>");
        }
        html += (ordered ? "<ol>" : "<ul>") + items.join("") + (ordered ? "</ol>" : "</ul>");
        continue;
      }
      const buf = [line];
      i++;
      while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) buf.push(lines[i++]);
      html += "<p>" + inline(buf.join(" ")) + "</p>";
    }
    return html;
  }

  // ---------- views ----------
  function tagList(tags) {
    return (tags || []).map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("");
  }

  function postCard(p) {
    return '<a class="card post-card" href="#/devlog/' + encodeURIComponent(p.slug) + '">' +
      '<div class="meta">' + fmtDate(p.date) + " " + tagList(p.tags) + "</div>" +
      "<h3>" + esc(p.title) + "</h3>" +
      (p.summary ? "<p>" + esc(p.summary) + "</p>" : "") + "</a>";
  }

  function stats(tasks) {
    const real = tasks.filter(function (t) { return t.status !== "idea"; });
    const done = real.filter(function (t) { return t.status === "done"; }).length;
    return { done: done, total: real.length, p: pct(done, real.length) };
  }

  async function viewHome(site) {
    const [posts, road, log] = await Promise.all([
      load("posts/index.json"), load("data/roadmap.json"), load("data/changelog.json")
    ]);
    const s = stats(road.tasks);
    const doing = road.tasks.filter(function (t) { return t.status === "doing"; });
    const latest = (log.releases || []).find(function (r) { return r.version !== "Unreleased"; });
    const current = road.milestones.find(function (m) {
      return road.tasks.some(function (t) { return t.milestone === m.id && t.status !== "done" && t.status !== "idea"; });
    });

    return '<section class="hero">' +
        '<div class="hero-cubes" aria-hidden="true">' + "<i></i>".repeat(9) + "</div>" +
        "<h1>" + esc(site.name) + "</h1>" +
        '<p class="tagline">' + esc(site.tagline) + "</p>" +
        '<div class="hero-actions">' +
          (site.play_url ? '<a class="btn primary" href="' + esc(site.play_url) + '">▶ Play</a>' : '<span class="btn disabled" title="No playable build yet">▶ Play (soon)</span>') +
          '<a class="btn" href="#/roadmap">Roadmap</a>' +
          '<a class="btn" href="#/devlog">Devlog</a>' +
        "</div>" +
      "</section>" +

      '<section class="grid-3">' +
        '<div class="card stat"><div class="label">Status</div><div class="value small">' + esc(site.status) + "</div></div>" +
        '<div class="card stat"><div class="label">Latest version</div><div class="value">' + (latest ? "v" + esc(latest.version) : "n/a") + '</div><div class="muted">' + (latest ? fmtDate(latest.date) : "") + "</div></div>" +
        '<div class="card stat"><div class="label">Overall progress</div><div class="value">' + s.p + '%</div>' + bar(s.p, "Overall progress") + '<div class="muted">' + s.done + " / " + s.total + " tasks</div></div>" +
      "</section>" +

      '<section class="grid-2">' +
        '<div class="card"><h2>Now building</h2>' +
          (current ? '<p class="muted">' + esc(current.name) + ": " + esc(current.goal) + "</p>" : "") +
          (doing.length ? '<ul class="doing-list">' + doing.map(function (t) { return '<li><span class="dot doing"></span>' + esc(t.title) + "</li>"; }).join("") + "</ul>" : '<p class="muted">Nothing in progress right now.</p>') +
          '<a class="more" href="#/roadmap">Full roadmap →</a></div>' +
        '<div class="card"><h2>Latest devlog</h2>' +
          (posts.posts.length ? posts.posts.slice(0, 3).map(function (p) {
            return '<a class="mini-post" href="#/devlog/' + encodeURIComponent(p.slug) + '"><span>' + esc(p.title) + '</span><span class="muted">' + fmtDate(p.date) + "</span></a>";
          }).join("") : '<p class="muted">No posts yet.</p>') +
          '<a class="more" href="#/devlog">All posts →</a></div>' +
      "</section>";
  }

  async function viewDevlog() {
    const posts = await load("posts/index.json");
    const tags = Array.from(new Set(posts.posts.flatMap(function (p) { return p.tags || []; }))).sort();
    return '<h1 class="page-title">Devlog</h1>' +
      '<div class="filters" data-filter-group="tag"><button class="chip active" data-val="">All</button>' +
      tags.map(function (t) { return '<button class="chip" data-val="' + esc(t) + '">' + esc(t) + "</button>"; }).join("") + "</div>" +
      '<div class="post-list">' + (posts.posts.length ? posts.posts.map(function (p) {
        return '<div data-tags="' + esc((p.tags || []).join(" ")) + '">' + postCard(p) + "</div>";
      }).join("") : '<p class="muted">No posts yet.</p>') + "</div>";
  }

  async function viewPost(slug) {
    const posts = await load("posts/index.json");
    const idx = posts.posts.findIndex(function (p) { return p.slug === slug; });
    if (idx < 0) return notFound();
    const p = posts.posts[idx];
    const md = await load("posts/" + p.file, true);
    const newer = posts.posts[idx - 1], older = posts.posts[idx + 1];
    document.title = p.title + " · " + (site ? site.name : "Dev Hub");
    return '<article class="prose post">' +
      '<a class="back" href="#/devlog">← Devlog</a>' +
      '<div class="meta">' + fmtDate(p.date) + " " + tagList(p.tags) + "</div>" +
      markdown(md) + "</article>" +
      '<nav class="post-nav">' +
        (older ? '<a href="#/devlog/' + encodeURIComponent(older.slug) + '">← ' + esc(older.title) + "</a>" : "<span></span>") +
        (newer ? '<a href="#/devlog/' + encodeURIComponent(newer.slug) + '">' + esc(newer.title) + " →</a>" : "<span></span>") +
      "</nav>";
  }

  const COLS = [
    { id: "idea", name: "Ideas" },
    { id: "todo", name: "To do" },
    { id: "doing", name: "Doing" },
    { id: "done", name: "Done" }
  ];

  async function viewRoadmap() {
    const road = await load("data/roadmap.json");
    const ms = {};
    road.milestones.forEach(function (m) { ms[m.id] = m; });

    const milestoneRows = road.milestones.map(function (m) {
      const s = stats(road.tasks.filter(function (t) { return t.milestone === m.id; }));
      return '<button class="ms-row" data-ms="' + esc(m.id) + '">' +
        '<div class="ms-head"><strong>' + esc(m.name) + '</strong><span class="muted">' + s.done + "/" + s.total + "</span></div>" +
        '<div class="muted ms-goal">' + esc(m.goal) + "</div>" + bar(s.p, m.name) + "</button>";
    }).join("");

    const board = COLS.map(function (c) {
      const items = road.tasks.filter(function (t) { return t.status === c.id; });
      return '<div class="col col-' + c.id + '"><div class="col-head"><span class="dot ' + c.id + '"></span>' + c.name + ' <span class="count">' + items.length + "</span></div>" +
        items.map(function (t) {
          const m = ms[t.milestone];
          return '<div class="task" data-ms="' + esc(t.milestone) + '">' +
            '<div class="task-title">' + esc(t.title) + "</div>" +
            (t.note ? '<div class="task-note">' + esc(t.note) + "</div>" : "") +
            '<div class="task-meta">' + (m ? '<span class="ms-pill">' + esc(m.name.split("·")[0].trim()) + "</span>" : "") +
            (t.tag ? '<span class="tag">' + esc(t.tag) + "</span>" : "") + "</div></div>";
        }).join("") + "</div>";
    }).join("");

    return '<h1 class="page-title">Roadmap</h1>' +
      '<section class="milestones">' + milestoneRows + "</section>" +
      '<div class="board-head"><h2>Board</h2><span class="muted" id="ms-filter-label">All milestones</span>' +
      '<button class="chip" id="ms-clear" hidden>Show all</button></div>' +
      '<section class="board">' + board + "</section>";
  }

  async function viewChangelog() {
    const log = await load("data/changelog.json");
    const order = ["added", "changed", "fixed", "removed"];
    return '<h1 class="page-title">Changelog</h1>' +
      (log.releases || []).map(function (r) {
        const groups = order.map(function (type) {
          const items = (r.items || []).filter(function (it) { return it.type === type; });
          if (!items.length) return "";
          return '<div class="cl-group"><span class="cl-type ' + type + '">' + type + "</span><ul>" +
            items.map(function (it) { return "<li>" + inline(it.text) + "</li>"; }).join("") + "</ul></div>";
        }).join("");
        const unreleased = r.version === "Unreleased";
        return '<section class="card release' + (unreleased ? " unreleased" : "") + '">' +
          '<div class="release-head"><h2>' + (unreleased ? "Unreleased" : "v" + esc(r.version)) +
          (r.title ? ' <span class="release-title">' + esc(r.title) + "</span>" : "") + "</h2>" +
          '<span class="muted">' + fmtDate(r.date) + "</span></div>" + groups + "</section>";
      }).join("");
  }

  async function viewOriginality() {
    const md = await load("data/originality.md", true);
    return '<article class="prose">' + markdown(md) + "</article>";
  }

  function notFound() {
    return '<div class="card"><h1>404: chunk not loaded</h1><p>That page doesn\'t exist. <a href="#/">Go home</a>.</p></div>';
  }

  // ---------- interactions ----------
  function wireDevlog() {
    app.querySelectorAll('[data-filter-group="tag"] .chip').forEach(function (btn) {
      btn.addEventListener("click", function () {
        const val = btn.dataset.val;
        app.querySelectorAll('[data-filter-group="tag"] .chip').forEach(function (b) { b.classList.toggle("active", b === btn); });
        app.querySelectorAll(".post-list > div").forEach(function (el) {
          el.hidden = !!val && el.dataset.tags.split(" ").indexOf(val) < 0;
        });
      });
    });
  }

  function wireRoadmap() {
    const label = document.getElementById("ms-filter-label");
    const clear = document.getElementById("ms-clear");
    function apply(id) {
      app.querySelectorAll(".ms-row").forEach(function (r) { r.classList.toggle("active", r.dataset.ms === id); });
      app.querySelectorAll(".task").forEach(function (t) { t.hidden = !!id && t.dataset.ms !== id; });
      app.querySelectorAll(".col").forEach(function (col) {
        col.querySelector(".count").textContent = col.querySelectorAll(".task:not([hidden])").length;
      });
      const row = id && app.querySelector('.ms-row[data-ms="' + id + '"] strong');
      label.textContent = row ? row.textContent : "All milestones";
      clear.hidden = !id;
    }
    app.querySelectorAll(".ms-row").forEach(function (r) {
      r.addEventListener("click", function () {
        apply(r.classList.contains("active") ? "" : r.dataset.ms);
        document.querySelector(".board-head").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    clear.addEventListener("click", function () { apply(""); });
  }

  // ---------- router ----------
  let site = null;

  async function route() {
    const hash = location.hash.replace(/^#\/?/, "");
    const parts = hash.split("/").filter(Boolean).map(decodeURIComponent);
    const page = parts[0] || "home";
    document.querySelectorAll(".nav a").forEach(function (a) {
      a.classList.toggle("active", a.dataset.route === page);
    });
    document.querySelector(".nav").classList.remove("open");
    document.title = (site ? site.name : "Dev Hub") + " · Dev Hub";

    try {
      let html;
      if (page === "home") html = await viewHome(site);
      else if (page === "devlog" && parts[1]) html = await viewPost(parts[1]);
      else if (page === "devlog") html = await viewDevlog();
      else if (page === "roadmap") html = await viewRoadmap();
      else if (page === "changelog") html = await viewChangelog();
      else if (page === "originality") html = await viewOriginality();
      else html = notFound();
      app.innerHTML = html;
      if (page === "devlog" && !parts[1]) wireDevlog();
      if (page === "roadmap") wireRoadmap();
      window.scrollTo(0, 0);
    } catch (err) {
      app.innerHTML = '<div class="card error"><h2>Something broke</h2><p>' + esc(err.message) +
        '</p><p class="muted">If you opened this file directly, serve it instead: <code>python3 -m http.server</code></p></div>';
      console.error(err);
    }
  }

  async function init() {
    try {
      site = await load("data/site.json");
    } catch (e) {
      site = { name: "Dev Hub", tagline: "", status: "", repo: "" };
    }
    document.querySelectorAll('[data-site="name"]').forEach(function (el) { el.textContent = site.name; });
    document.querySelectorAll('[data-site="repo"]').forEach(function (el) {
      if (site.repo) el.href = site.repo; else el.remove();
    });
    const toggle = document.querySelector(".nav-toggle");
    toggle.addEventListener("click", function () {
      const open = document.querySelector(".nav").classList.toggle("open");
      toggle.setAttribute("aria-expanded", open);
    });
    window.addEventListener("hashchange", route);
    route();
  }

  // expose renderer for tests
  if (typeof module !== "undefined") module.exports = { markdown: markdown };
  else init();
})();
