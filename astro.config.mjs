import fs from 'node:fs';
import { defineConfig } from 'astro/config';

const base = '/kolibri-reports';

// dev only: `astro dev` serves public/ verbatim and never resolves <dir>/ to index.html,
// so staged reports 404 locally even though the built site serves them fine.
const publicDirIndex = {
  name: 'public-dir-index',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      // astro may or may not have stripped `base` by now, so look up without it
      // but keep whatever prefix the request arrived with
      const [path, query] = req.url.split('?');
      const dir = path.replace(/\/$/, '');
      if (fs.existsSync(new URL('./public' + dir.replace(base, '') + '/index.html', import.meta.url))) {
        req.url = dir + '/index.html' + (query ? '?' + query : '');
      }
      next();
    });
  },
};

export default defineConfig({
  site: 'https://open.lokanetra.dev',
  base,
  trailingSlash: 'ignore', // dev 404s /<slug> under 'always'; output dirs are unchanged
  build: { format: 'directory' },
  vite: { plugins: [publicDirIndex] },
});
