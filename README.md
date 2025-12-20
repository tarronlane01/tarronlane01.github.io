# Tarron Lane Site

A React SPA for tarronlane01.github.io

## Development

```bash
cd budget-app
npm install
npm run dev
```

## Building for GitHub Pages

```bash
cd budget-app
npm run build
```

This outputs the built files to `/docs` so GitHub Pages can serve them at `tarronlane01.github.io`.

**GitHub Pages Settings:** Deploy from `main` branch, `/docs` folder.

## Build and Publish

To build, commit, and push in one command:

```bash
cd budget-app
npm run publish
```

Added to `budget-app/package.json`:
```json
"publish": "npm run build && cd .. && git add -A && git commit -m 'Build and publish' && git push"
```

## GitHub Pages SPA Routing

The app uses the [spa-github-pages](https://github.com/rafgraph/spa-github-pages) technique:
- `404.html` redirects deep links to the main page with encoded paths
- `index.html` decodes the path for React Router
- `pathSegmentsToKeep = 0` because the app lives at the root

## Firebase

```bash
cd budget-app
npm install firebase
```
