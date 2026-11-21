# FOMO desk

Static personal trading desk. Plain HTML, CSS, and JavaScript, with no build step.

Published URL, once GitHub Pages is serving this repository:

https://keita7711.github.io/read/

## Publish

`.github/workflows/pages.yml` deploys the repository root to GitHub Pages on every push to `main`.

Enabling the site is a one-time repository setting. `enablement: true` on `actions/configure-pages` needs a token other than the workflow `GITHUB_TOKEN`, which cannot create a Pages site. In **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**. With that source selected, the workflow publishes this directory to the URL above. If a run starts before the source is saved, re-run the workflow afterward.
