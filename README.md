# VibratingCode

The official site for every VibratingCode game and program, plus the Hollowstone devlog, task board and changelog. A plain static site: no build step, nothing to install. GitHub Pages serves it as-is.

## Updating it (all from the GitHub web editor if you like)

| To... | Edit |
| --- | --- |
| Add or edit a project page | `data/projects.json` (images go in `assets/projects/<id>/`) |
| Confirm a project's roadmap | Edit its `roadmap` / `next` in `data/projects.json`, then set `roadmapDraft` to `false` to remove the Draft tags |
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
