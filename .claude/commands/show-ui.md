---
description: Build the current app UI for web and open the all-screens board in the browser
allowed-tools: Bash(bash web/scripts/show.sh:*), Bash(web/scripts/show.sh:*)
---
Run `bash web/scripts/show.sh` from the repo root (SalinLens). It builds the web bundle, screenshots every screen with headless Chromium, restarts the preview server on port 5173 and opens http://127.0.0.1:5173/app, which shows every real screen (Scan camera/adjust, Save as, Saved, Item, Your scans) at a chosen phone size. Report only whether it built and the URL; do not take screenshots unless asked.
