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

  // ---------- studio home ----------
  function coverHtml(p, cls) {
    const style = "--accent:" + esc(p.accent || "#3fb6a8");
    if (p.cover) {
      return '<div class="' + cls + ' has-img" style="' + style + '"><img src="' + esc(p.cover) + '" alt="" loading="lazy"></div>';
    }
    return '<div class="' + cls + ' no-img" style="' + style + '">' +
      (p.icon ? '<img class="cover-icon" src="' + esc(p.icon) + '" alt="">' : '<span class="cover-letter">' + esc(p.name[0]) + "</span>") +
      "</div>";
  }

  function kindBadge(p) {
    return '<span class="kind kind-' + esc((p.kind || "").toLowerCase()) + '">' + esc(p.kind) + "</span>";
  }

  async function viewHome(site) {
    const data = await load("data/projects.json");
    const kinds = Array.from(new Set(data.projects.map(function (p) { return p.kind; })));
    return '<section class="studio-hero">' +
        '<div class="hero-cubes" aria-hidden="true">' + "<i></i>".repeat(9) + "</div>" +
        '<p class="eyebrow">' + data.projects.length + " projects</p>" +
        "<h1>" + esc(site.name) + "</h1>" +
        '<p class="tagline">' + esc(site.tagline) + "</p>" +
        (site.intro ? '<p class="intro">' + esc(site.intro) + "</p>" : "") +
      "</section>" +
      '<div class="filters" data-filter-group="kind"><button class="chip active" data-val="">All</button>' +
        kinds.map(function (k) { return '<button class="chip" data-val="' + esc(k) + '">' + esc(k) + "s</button>"; }).join("") +
      "</div>" +
      '<section class="project-grid">' + data.projects.map(function (p) {
        return '<a class="project-card" data-kind="' + esc(p.kind) + '" href="#/p/' + encodeURIComponent(p.id) + '" style="--accent:' + esc(p.accent || "#3fb6a8") + '">' +
          coverHtml(p, "pc-cover") +
          '<div class="pc-body">' +
            '<div class="pc-meta">' + kindBadge(p) + '<span class="status-pill">' + esc((p.facts && p.facts.Status) || "") + "</span>" +
              (p.private ? '<span class="private-pill" title="Source is in a private repository">Private</span>' : "") + "</div>" +
            "<h3>" + esc(p.name) + "</h3>" +
            "<p>" + esc(p.summary || p.tagline) + "</p>" +
            '<span class="pc-platform">' + esc((p.facts && p.facts.Platform) || "") + "</span>" +
          "</div></a>";
      }).join("") + "</section>";
  }

  // ---------- project page ----------
  function linkBtn(l) {
    const ext = /^https?:/i.test(l.url);
    return '<a class="btn' + (l.primary ? " primary" : "") + '" href="' + esc(l.url) + '"' +
      (ext ? ' target="_blank" rel="noopener"' : "") + ">" + (l.primary && /play/i.test(l.label) ? "▶ " : "") + esc(l.label) + (ext && !l.primary ? " ↗" : "") + "</a>";
  }

  async function hollowstoneRoadmap() {
    const [road, posts] = await Promise.all([load("data/roadmap.json"), load("posts/index.json")]);
    const items = road.milestones.map(function (m) {
      const tasks = road.tasks.filter(function (t) { return t.milestone === m.id && t.status !== "idea"; });
      const s = stats(tasks);
      const status = s.total && s.done === s.total ? "done" : tasks.some(function (t) { return t.status === "doing" || t.status === "done"; }) ? "doing" : "planned";
      return { title: m.name, text: m.goal, status: status, p: s.p };
    });
    const doing = road.tasks.filter(function (t) { return t.status === "doing"; });
    const todo = road.tasks.filter(function (t) { return t.status === "todo"; });
    const next = doing.concat(todo).slice(0, 4).map(function (t) { return t.title; });
    return { items: items, next: next, posts: posts.posts };
  }

  function roadmapHtml(items, draft) {
    const groups = [
      { id: "done", name: "Shipped" },
      { id: "doing", name: "In progress" },
      { id: "planned", name: "Planned" }
    ];
    const total = items.length, done = items.filter(function (i) { return i.status === "done"; }).length;
    return '<div class="rm-summary"><span><strong>' + done + "</strong> of " + total + " milestones shipped</span>" + bar(pct(done, total), "Roadmap progress") + "</div>" +
      '<div class="timeline">' + groups.map(function (g) {
        const list = items.filter(function (i) { return i.status === g.id; });
        if (!list.length) return "";
        return '<div class="tl-group tl-' + g.id + '"><h3><span class="dot ' + (g.id === "planned" ? "todo" : g.id) + '"></span>' + g.name +
          (g.id === "planned" && draft ? ' <span class="draft-tag" title="Not confirmed yet">Draft</span>' : "") + "</h3>" +
          "<ol>" + list.map(function (i) {
            return '<li><div class="tl-title">' + esc(i.title) + "</div>" +
              (i.text ? '<div class="tl-text">' + esc(i.text) + "</div>" : "") +
              (typeof i.p === "number" && g.id === "doing" ? bar(i.p) : "") + "</li>";
          }).join("") + "</ol></div>";
      }).join("") + "</div>";
  }

  async function viewProject(id) {
    const data = await load("data/projects.json");
    const idx = data.projects.findIndex(function (p) { return p.id === id; });
    if (idx < 0) return notFound();
    const p = data.projects[idx];
    document.title = p.name + " · " + (site ? site.name : "");
    const accent = esc(p.accent || "#3fb6a8");

    let roadItems = p.roadmap || [], next = p.next || [], hs = null;
    if (p.roadmapSource === "hollowstone") {
      hs = await hollowstoneRoadmap();
      roadItems = hs.items; next = hs.next;
    }

    const hero = '<section class="p-hero' + (p.cover ? " with-cover" : "") + '" style="--accent:' + accent + '">' +
      (p.cover ? '<img class="p-hero-bg" src="' + esc(p.cover) + '" alt="">' : '<div class="p-hero-glow"></div>') +
      '<div class="p-hero-inner">' +
        (p.icon ? '<img class="p-icon" src="' + esc(p.icon) + '" alt="">' : "") +
        '<div><div class="pc-meta">' + kindBadge(p) + '<span class="status-pill">' + esc((p.facts && p.facts.Status) || "") + "</span>" +
          (p.private ? '<span class="private-pill">Private source</span>' : "") + "</div>" +
        "<h1>" + esc(p.name) + "</h1>" +
        '<p class="p-tagline">' + esc(p.tagline) + "</p>" +
        '<div class="hero-actions">' + (p.links || []).map(linkBtn).join("") + "</div></div>" +
      "</div></section>";

    const subnav = '<nav class="p-subnav"><a href="#about" data-jump="about">About</a><a href="#features" data-jump="features">Features</a>' +
      '<a href="#roadmap" data-jump="roadmap">Roadmap</a><a href="#next" data-jump="next">Next up</a></nav>';

    const facts = p.facts ? '<aside class="card facts"><h2>At a glance</h2><dl>' + Object.keys(p.facts).map(function (k) {
      return "<dt>" + esc(k) + "</dt><dd>" + esc(p.facts[k]) + "</dd>";
    }).join("") + "</dl></aside>" : "";

    const about = '<section id="about" class="p-section p-about"><div class="prose-lite"><h2 class="sec-title">About</h2>' +
      (p.description || []).map(function (d) { return "<p>" + inline(d) + "</p>"; }).join("") + "</div>" + facts + "</section>";

    const gal = p.gallery || [];
    const gallery = gal.length
      ? '<div class="gallery" data-count="' + gal.length + '">' + gal.map(function (g, i) {
          return '<figure class="shot' + (i === 0 ? " main" : "") + '"><button class="shot-btn" data-src="' + esc(g.src) + '" data-cap="' + esc(g.caption || "") + '" aria-label="Enlarge: ' + esc(g.caption || "screenshot") + '">' +
            '<img src="' + esc(g.src) + '" alt="' + esc(g.caption || "") + '" loading="lazy"></button>' +
            (g.caption ? "<figcaption>" + esc(g.caption) + "</figcaption>" : "") + "</figure>";
        }).join("") + "</div>"
      : '<div class="no-shots" style="--accent:' + accent + '">' + (p.icon ? '<img src="' + esc(p.icon) + '" alt="">' : "") + "<p>" + esc(p.noShots || "Screenshots coming soon.") + "</p></div>";

    const features = '<section id="features" class="p-section"><h2 class="sec-title">Features</h2>' + gallery +
      '<div class="feature-grid">' + (p.features || []).map(function (f) {
        return '<div class="feature"><h3>' + esc(f.title) + "</h3><p>" + esc(f.text) + "</p></div>";
      }).join("") + "</div></section>";

    const roadmap = '<section id="roadmap" class="p-section"><div class="sec-head"><h2 class="sec-title">Roadmap</h2>' +
      (hs ? '<a class="more" href="#/roadmap">Full task board →</a>' : "") + "</div>" +
      (roadItems.length ? roadmapHtml(roadItems, p.roadmapDraft) : '<p class="muted">Roadmap coming soon.</p>') + "</section>";

    const nextUp = '<section id="next" class="p-section"><h2 class="sec-title">Next up' +
      (p.roadmapDraft ? ' <span class="draft-tag">Draft</span>' : "") + "</h2>" +
      (next.length ? '<div class="next-grid">' + next.map(function (n, i) {
        return '<div class="next-card' + (i === 0 ? " first" : "") + '" style="--accent:' + accent + '"><span class="next-num">' + (i === 0 ? "Up next" : "Then") + "</span><strong>" + esc(n) + "</strong></div>";
      }).join("") + "</div>" : '<p class="muted">To be decided.</p>') + "</section>";

    const devlog = hs && hs.posts.length ? '<section class="p-section"><div class="sec-head"><h2 class="sec-title">From the devlog</h2><a class="more" href="#/devlog">All posts →</a></div>' +
      '<div class="post-list">' + hs.posts.slice(0, 3).map(postCard).join("") + "</div></section>" : "";

    const prev = data.projects[(idx - 1 + data.projects.length) % data.projects.length];
    const nxt = data.projects[(idx + 1) % data.projects.length];
    const pager = '<nav class="post-nav wide"><a href="#/p/' + encodeURIComponent(prev.id) + '">← ' + esc(prev.name) + '</a><a href="#/">All projects</a><a href="#/p/' + encodeURIComponent(nxt.id) + '">' + esc(nxt.name) + " →</a></nav>";

    return '<div class="project-page" style="--accent:' + accent + '">' + hero + subnav + about + features + roadmap + nextUp + devlog + pager + "</div>";
  }

  function hsCrumb(label) {
    return '<div class="crumb"><a href="#/p/hollowstone">Hollowstone</a> <span>›</span> ' + esc(label) + "</div>";
  }

  async function viewDevlog() {
    const posts = await load("posts/index.json");
    const tags = Array.from(new Set(posts.posts.flatMap(function (p) { return p.tags || []; }))).sort();
    return hsCrumb("Devlog") + '<h1 class="page-title">Hollowstone Devlog</h1>' +
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
      '<div class="crumb"><a href="#/p/hollowstone">Hollowstone</a> <span>›</span> <a href="#/devlog">Devlog</a></div>' +
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

    return hsCrumb("Task board") + '<h1 class="page-title">Hollowstone Task Board</h1>' +
      '<section class="milestones">' + milestoneRows + "</section>" +
      '<div class="board-head"><h2>Board</h2><span class="muted" id="ms-filter-label">All milestones</span>' +
      '<button class="chip" id="ms-clear" hidden>Show all</button></div>' +
      '<section class="board">' + board + "</section>";
  }

  async function viewChangelog() {
    const log = await load("data/changelog.json");
    const order = ["added", "changed", "fixed", "removed"];
    return hsCrumb("Changelog") + '<h1 class="page-title">Hollowstone Changelog</h1>' +
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
    return '<article class="prose">' + hsCrumb("Originality rules") + markdown(md) + "</article>";
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

  function wireHome() {
    app.querySelectorAll('[data-filter-group="kind"] .chip').forEach(function (btn) {
      btn.addEventListener("click", function () {
        const val = btn.dataset.val;
        app.querySelectorAll('[data-filter-group="kind"] .chip').forEach(function (b) { b.classList.toggle("active", b === btn); });
        app.querySelectorAll(".project-card").forEach(function (el) { el.hidden = !!val && el.dataset.kind !== val; });
      });
    });
  }

  function wireProject() {
    app.querySelectorAll("[data-jump]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        const t = document.getElementById(a.dataset.jump);
        if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    const lb = document.getElementById("lightbox");
    const shots = Array.from(app.querySelectorAll(".shot-btn"));
    let cur = 0;
    function show(i) {
      cur = (i + shots.length) % shots.length;
      lb.querySelector("img").src = shots[cur].dataset.src;
      lb.querySelector("img").alt = shots[cur].dataset.cap;
      lb.querySelector(".lb-cap").textContent = shots[cur].dataset.cap;
      lb.hidden = false;
    }
    shots.forEach(function (b, i) { b.addEventListener("click", function () { show(i); }); });
    lb.onclick = function (e) { if (e.target === lb || e.target.classList.contains("lb-close")) lb.hidden = true; };
    document.onkeydown = function (e) {
      if (lb.hidden) return;
      if (e.key === "Escape") lb.hidden = true;
      if (e.key === "ArrowRight") show(cur + 1);
      if (e.key === "ArrowLeft") show(cur - 1);
    };
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
    const navKey = page === "p" ? (parts[1] === "hollowstone" ? "hollowstone" : "home")
      : (["roadmap", "changelog", "originality"].indexOf(page) >= 0 ? "hollowstone" : page);
    document.querySelectorAll(".nav a").forEach(function (a) {
      a.classList.toggle("active", a.dataset.route === navKey);
    });
    document.querySelector(".nav").classList.remove("open");
    const lbx = document.getElementById("lightbox"); if (lbx) lbx.hidden = true;
    document.title = site ? site.name : "VibratingCode";

    try {
      let html;
      if (page === "home") html = await viewHome(site);
      else if (page === "p" && parts[1]) html = await viewProject(parts[1]);
      else if (page === "devlog" && parts[1]) html = await viewPost(parts[1]);
      else if (page === "devlog") html = await viewDevlog();
      else if (page === "roadmap") html = await viewRoadmap();
      else if (page === "changelog") html = await viewChangelog();
      else if (page === "originality") html = await viewOriginality();
      else html = notFound();
      app.innerHTML = html;
      if (page === "home") wireHome();
      if (page === "p") wireProject();
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
      site = { name: "VibratingCode", tagline: "", repo: "" };
    }
    document.querySelectorAll('[data-site="name"]').forEach(function (el) { el.textContent = site.name; });
    document.querySelectorAll('[data-site="github"]').forEach(function (el) {
      if (site.github) el.href = site.github; else el.remove();
    });
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
