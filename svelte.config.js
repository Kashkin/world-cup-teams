import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  compilerOptions: {
    // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
    runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true),
  },
  kit: {
    // No fallback — every route is prerendered (single-route SPA), and
    // setting `fallback: 'index.html'` would overwrite the prerendered home
    // page (with all the SEO meta tags) with the empty SPA shell.
    adapter: adapter(),
  },
};

export default config;
