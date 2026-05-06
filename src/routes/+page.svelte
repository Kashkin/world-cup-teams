<script lang="ts">
  import { onMount } from 'svelte';
  import { replaceState } from '$app/navigation';
  import { PersistedState } from 'runed';
  import { teams } from '$lib/teams';
  import { encodeRanking, decodeRanking } from '$lib/ranking';
  import UnrankedPool from '$lib/components/UnrankedPool.svelte';
  import RankedList from '$lib/components/RankedList.svelte';
  import { Button } from '$lib/components/ui/button';
  import Share2 from '@lucide/svelte/icons/share-2';
  import Printer from '@lucide/svelte/icons/printer';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';

  const ranking = new PersistedState<string[]>('wc26.ranking', []);

  let displayed = $state<string[]>([]);
  let previewMode = $state(false);
  let copiedAt = $state(0);
  let booted = $state(false);

  $effect(() => {
    if (booted && !previewMode) {
      const next = [...ranking.current];
      console.log('[mirror-effect]', { next, prevDisplayed: [...displayed] });
      displayed = next;
      syncUrl(next);
    }
  });

  // Mirror displayed → URL hash. Uses SvelteKit's replaceState (not raw
  // history.replaceState) — SvelteKit's dev-mode router patches the raw call
  // and silently drops updates, breaking shared-URL persistence. Passing {}
  // for state because we don't use SvelteKit's shallow routing.
  function syncUrl(list: readonly string[]) {
    if (!booted) return;
    const encoded = encodeRanking(list);
    const next = encoded ? `#r=${encoded}` : '';
    if (location.hash !== next) {
      // Hash-only same-page update — resolve() isn't meaningful here because
      // path + search are reused verbatim from the current URL.
      // eslint-disable-next-line svelte/no-navigation-without-resolve
      replaceState(`${location.pathname}${location.search}${next}`, {});
    }
  }

  // Decide what to show based on the current URL hash + saved list. Re-run on
  // every hashchange — SvelteKit's client router treats same-path different-hash
  // as a same-page navigation, so onMount alone misses URL changes after first
  // mount (e.g. user pastes a different shared URL into the address bar).
  function bootFromHash() {
    const incoming = location.hash.startsWith('#r=') ? decodeRanking(location.hash.slice(3)) : [];
    const saved = [...ranking.current];
    const sameAsSaved =
      incoming.length === saved.length && incoming.every((c, i) => c === saved[i]);

    console.log('[bootFromHash]', { hash: location.hash, incoming, saved, sameAsSaved });

    if (incoming.length === 0 || sameAsSaved) {
      displayed = saved;
      previewMode = false;
    } else if (saved.length === 0) {
      ranking.current = incoming;
      displayed = incoming;
      previewMode = false;
    } else {
      displayed = incoming;
      previewMode = true;
    }
    console.log('[bootFromHash] post', { displayed: [...displayed], previewMode });
  }

  onMount(() => {
    bootFromHash();
    booted = true;
    syncUrl(displayed);
    const onHash = () => bootFromHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  });

  let unrankedTeams = $derived(teams.filter((t) => !displayed.includes(t.code)));

  // In preview mode, edit the previewed list (held in `displayed`). Outside
  // preview, edit `ranking.current` directly — reading `displayed` would be
  // stale on rapid clicks because the mirror effect hasn't propagated yet.
  function currentList(): readonly string[] {
    return previewMode ? displayed : [...ranking.current];
  }
  function add(code: string) {
    const next = [...currentList(), code];
    previewMode = false;
    ranking.current = next;
  }
  function remove(code: string) {
    const next = currentList().filter((c) => c !== code);
    previewMode = false;
    ranking.current = next;
  }
  function reorder(next: string[]) {
    previewMode = false;
    ranking.current = next;
  }

  function saveAsMine() {
    ranking.current = [...displayed];
    previewMode = false;
  }
  function restoreMine() {
    displayed = [...ranking.current];
    previewMode = false;
  }

  async function share() {
    await navigator.clipboard.writeText(location.href);
    copiedAt = Date.now();
    setTimeout(() => {
      if (Date.now() - copiedAt >= 1900) copiedAt = 0;
    }, 2000);
  }

  function confirmReset() {
    if (confirm('Clear your teams?')) {
      ranking.current = [];
      previewMode = false;
    }
  }

  function printPage() {
    window.print();
  }
</script>

<main class="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
  <!-- Hero band: title left, trophy + buttons right. Trophy lives in a gold glow. -->
  <header class="relative overflow-visible">
    <div class="flex flex-col items-start gap-6 lg:flex-row lg:gap-16">
      <div class="relative z-10 pt-8 sm:pt-12 shrink-0">
        <h1 class="font-display text-6xl leading-none tracking-wide sm:text-7xl md:text-8xl">
          <span class="block text-foreground drop-shadow-[0_2px_0_oklch(0.4_0.18_260)]">
            WORLD CUP <span class="tabular-nums">2026</span>
          </span>
          <span
            class="font-marker text-primary -mt-2 block text-4xl tracking-wider sm:text-6xl md:text-7xl"
            style="text-shadow: 0 1px 0 oklch(0.4 0.2 18), 0 0 28px oklch(0.65 0.22 15 / 0.45);"
          >
            my teams
          </span>
        </h1>
        <p class="text-foreground/85 mt-4 text-base print:hidden">
          Pick your favourites. Show your allegiances.
        </p>
      </div>

      <!-- Hero image: trophy + stadium composite. Faded into the page on the left
           with a CSS mask so it blends rather than sitting in a hard rectangle. -->
      <img
        src="/world-cup-hero.png"
        alt=""
        width="1322"
        height="1190"
        aria-hidden="true"
        class="h-44 w-full opacity-80 self-center object-cover object-top-right print:hidden sm:h-56 lg:h-72"
        style="
          mask-image: linear-gradient(to right, transparent 0%, black 25%, black 100%);
          -webkit-mask-image: linear-gradient(to right, transparent 0%, black 25%, black 100%);
        "
      />
    </div>

    <!-- Buttons positioned absolute top-right of the hero -->
    <div
      class="absolute max-lg:bottom-8 max-lg:left-4 lg:top-8 lg:right-6 flex items-center gap-2 print:hidden"
    >
      {#if copiedAt > 0}
        <span class="text-foreground/70 mr-2 text-xs">Link copied!</span>
      {/if}
      <Button
        variant="ghost"
        class="backdrop-blur-sm border-white/20 border"
        size="lg"
        onclick={share}
      >
        <Share2 class="size-4" />
        Share
      </Button>
      <Button
        variant="ghost"
        class="backdrop-blur-sm border-white/20 border"
        size="lg"
        onclick={printPage}
      >
        <Printer class="size-4" />
        Print
      </Button>
      <Button
        variant="ghost"
        size="lg"
        onclick={confirmReset}
        class="backdrop-blur-sm border-primary/50 text-primary hover:bg-primary/10"
      >
        <RotateCcw class="size-4" />
        Reset
      </Button>
    </div>
  </header>

  {#if previewMode}
    <div
      class="border-primary/30 bg-primary/10 mt-6 flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 print:hidden"
    >
      <p class="text-sm">
        You're viewing a shared list ({displayed.length}
        {displayed.length === 1 ? 'team' : 'teams'}).
      </p>
      <div class="flex gap-2">
        <Button size="sm" onclick={saveAsMine}>Save as mine</Button>
        <Button size="sm" variant="outline" onclick={restoreMine}>Restore mine</Button>
      </div>
    </div>
  {/if}

  <!-- Main grid: pool | squad -->
  <div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
    <UnrankedPool teams={unrankedTeams} onAdd={add} />
    <RankedList ranking={displayed} onReorder={reorder} onRemove={remove} />
  </div>
</main>
