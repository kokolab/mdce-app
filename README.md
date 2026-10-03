# Muse Dash Chart Editor

A browser editor for Muse Dash BMS charts. Open a `.bms` file and a song, edit notes, then save `.bms` and `info.json`.

Charts and the loaded song stay in the browser (`localStorage` key `stagepen.v1`). The server only serves the page. You do not need Postgres.

## Deploy with Portainer

Docker already runs on the Proxmox VM **services** (VM 103). Portainer on that VM can build and start this app. Do not install Docker on the Proxmox host.

1. Open Portainer.
2. Select the **services** environment.
3. Go to **Stacks** → **Add stack**.
4. Name it `Muse Dash Chart Editor`. If Portainer rejects the spaces, use `muse-dash-chart-editor`.
5. Choose **Git repository**.
6. Repository URL: `https://github.com/kokolab/mdce`
7. Repository reference: `refs/heads/main`
8. Compose path: `docker-compose.yml`
9. Turn on **Authentication** if the repo is private, and use a GitHub personal access token with repository read access.
10. Click **Deploy the stack**.

The first build takes a few minutes. Then open `http://<services-vm-ip>:8090`.

If port 8090 is already taken, change the left number in `docker-compose.yml` (`"8090:8080"`) before deploying. The right number stays 8080.

To pick up later edits, push to `main` and use **Pull and redeploy** on that stack. Turn on **GitOps updates** if you want Portainer to do that by itself.

Fonts load from `fonts.bunny.net`, so the VM needs outbound internet.

## Custom note icons

Right-click a note in the palette and choose **Import PNG**. That image is saved in this browser and used everywhere that note appears. **Use plain icon** removes it. Notes without an imported PNG keep the built-in icon.

## Keep editing with another LLM

This project is plain TypeScript. Claude Code, Cursor, Aider, Continue, or Cline can keep working on the same GitHub repo.

1. Clone `https://github.com/kokolab/mdce`.
2. Tell the agent to read `README.md` and `CLAUDE.md` before changing anything.
3. Install Node 22, then `npm ci` and `npm run dev`.
4. Push to `main`. Portainer redeploys from that branch.

`AGENTS.md` is only for the Grok preview sandbox. Ignore it on the homelab.

## What not to break

- Note keys and names in `src/lib/md/catalog.ts` must stay aligned with the `#WAV` header. The game looks up sounds by those keys.
- Air lanes are `air` and `air2`. Ground lanes are `gnd` and `gnd2`.
- A gear (`0H`) is a full icon on air and the top half on ground. A boss gear (`18`) is the same, with the word BOSS under it.
- Holds (`0F`) are a circle with a star and four lines. Mashers (`0G`, `16`, `17`) use the glove and a zigzag.
- The music note (`10`) is a vertical bar labeled `music`, with its left edge on the grid line.
- Default music volume and note-sound volume are `0.25`. OLED dark mode is on unless the browser stored `stagepen-dark` as `0`.

## Layout

```text
src/components/editor/   the page
src/lib/md/              chart format, playback, state
public/sfx/              note sounds
public/glove.png         masher icon
```
