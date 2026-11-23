# Hollowstone Dev Hub

Devlog, roadmap, and changelog for the project. A plain static site: no build step, nothing to install. GitHub Pages serves it as-is.

## Updating it (all from the GitHub web editor if you like)

| To... | Edit |
| --- | --- |
| Write a devlog post | Add `posts/YYYY-MM-DD-title.md`, then add an entry at the **top** of `posts/index.json` |
| Move a task / add a task | `data/roadmap.json`: set `status` to `idea`, `todo`, `doing`, or `done` |
| Log a release | Add an entry at the **top** of `data/changelog.json` (types: `added`, `changed`, `fixed`, `removed`) |
| Rename project / set play link | `data/site.json` |
| Originality rules | `data/originality.md` |

Posts support normal Markdown: headings, lists, `- [x]` checkboxes, **bold**, *italic*, `code`, code blocks, links, images, quotes, and tables. Put screenshots in `posts/img/` and link them as `![alt](posts/img/shot.png)`.

## Preview locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` directly from disk won't load the data, because browsers block that.

## GitHub Pages

Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)`.
