<script lang="ts">
  import './layout.css';
  // Hash-fingerprinted asset URLs for the two display fonts. Importing as ?url
  // gives us the post-build path, which lets us preload them — saves the
  // CSS-waterfall delay before the browser even sees the woff2 references.
  import bebasNeueWoff2 from '@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2?url';
  import permanentMarkerWoff2 from '@fontsource/permanent-marker/files/permanent-marker-latin-400-normal.woff2?url';

  let { children } = $props();

  // Update this when the site is deployed (e.g. https://world-cup-2026.vercel.app).
  // Used as the base for og:url, og:image, and the canonical link.
  const SITE_URL = 'https://world-cup-2026.vercel.app';

  const PAGE_TITLE = 'World Cup 2026 — My Teams';
  const PAGE_DESCRIPTION =
    'Pick your favourites from the 48 nations qualified for the 2026 FIFA World Cup. See each team’s appearances, wins, and championship history. Share your ranking with friends.';
  // The hero image is 1322×1190; social cards want ~1.91:1 (1200×630). Most platforms
  // centre-crop, which keeps the trophy roughly intact. Replace with a properly
  // aspected /og-image.png when you have one.
  const OG_IMAGE = `${SITE_URL}/world-cup-hero.png`;
  const OG_IMAGE_WIDTH = '1322';
  const OG_IMAGE_HEIGHT = '1190';
</script>

<svelte:head>
  <title>{PAGE_TITLE}</title>
  <meta name="description" content={PAGE_DESCRIPTION} />
  <link rel="canonical" href={SITE_URL} />

  <!-- Favicons + PWA manifest. theme-color matches site.webmanifest. -->
  <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="shortcut icon" href="/favicon.ico" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <meta name="apple-mobile-web-app-title" content="WC - My teams" />
  <link rel="manifest" href="/site.webmanifest" />
  <meta name="theme-color" content="#c1161c" />

  <!-- Preload the display fonts so the hero doesn't flash in the system fallback. -->
  <link rel="preload" href={bebasNeueWoff2} as="font" type="font/woff2" crossorigin="anonymous" />
  <link
    rel="preload"
    href={permanentMarkerWoff2}
    as="font"
    type="font/woff2"
    crossorigin="anonymous"
  />

  <!-- Open Graph (Facebook, iMessage, Slack, LinkedIn) -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="World Cup 2026" />
  <meta property="og:url" content={SITE_URL} />
  <meta property="og:title" content={PAGE_TITLE} />
  <meta property="og:description" content={PAGE_DESCRIPTION} />
  <meta property="og:image" content={OG_IMAGE} />
  <meta property="og:image:width" content={OG_IMAGE_WIDTH} />
  <meta property="og:image:height" content={OG_IMAGE_HEIGHT} />
  <meta
    property="og:image:alt"
    content="The FIFA World Cup trophy in front of stadium lights and confetti"
  />

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={PAGE_TITLE} />
  <meta name="twitter:description" content={PAGE_DESCRIPTION} />
  <meta name="twitter:image" content={OG_IMAGE} />
</svelte:head>

{@render children()}
