<script lang="ts">
  import { onMount } from 'svelte';
  import { PersistedState } from 'runed';
  import { teams } from '$lib/teams';
  import { encodeRanking, decodeRanking } from '$lib/ranking';
  import UnrankedPool from '$lib/components/UnrankedPool.svelte';
  import RankedList from '$lib/components/RankedList.svelte';
  import { Button } from '$lib/components/ui/button';
  import Share2 from '@lucide/svelte/icons/share-2';
  import Printer from '@lucide/svelte/icons/printer';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Trophy from '@lucide/svelte/icons/trophy';

  const ranking = new PersistedState<string[]>('wc26.ranking', []);

  let displayed = $state<string[]>([]);
  let previewMode = $state(false);
  let copiedAt = $state(0);
  let booted = $state(false);

  $effect(() => {
    if (booted && !previewMode) displayed = ranking.current;
  });

  $effect(() => {
    if (!booted) return;
    const encoded = encodeRanking(displayed);
    const next = encoded ? `#r=${encoded}` : '';
    if (typeof location !== 'undefined' && location.hash !== next) {
      history.replaceState(null, '', `${location.pathname}${location.search}${next}`);
    }
  });

  onMount(() => {
    const incoming = location.hash.startsWith('#r=') ? decodeRanking(location.hash.slice(3)) : [];
    const saved = ranking.current;
    const sameAsSaved =
      incoming.length === saved.length && incoming.every((c, i) => c === saved[i]);

    if (incoming.length === 0 || sameAsSaved) {
      displayed = saved;
    } else if (saved.length === 0) {
      ranking.current = incoming;
      displayed = incoming;
    } else {
      displayed = incoming;
      previewMode = true;
    }
    booted = true;
  });

  let unrankedTeams = $derived(teams.filter((t) => !displayed.includes(t.code)));

  function add(code: string) {
    previewMode = false;
    ranking.current = [...displayed, code];
  }
  function remove(code: string) {
    previewMode = false;
    ranking.current = displayed.filter((c) => c !== code);
  }
  function reorder(next: string[]) {
    previewMode = false;
    ranking.current = next;
  }

  function saveAsMine() {
    ranking.current = displayed;
    previewMode = false;
  }
  function restoreMine() {
    displayed = ranking.current;
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
    if (confirm('Clear your ranking?')) {
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
  <header class="relative overflow-visible pt-8 sm:pt-12">
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto] lg:items-start">
      <div class="relative z-10">
        <h1 class="font-display text-6xl leading-none tracking-tight sm:text-7xl md:text-8xl">
          <span class="block text-foreground drop-shadow-[0_2px_0_oklch(0.4_0.18_260)]">
            WORLD CUP 2026
          </span>
          <span
            class="font-marker text-primary -mt-2 block text-5xl tracking-wider sm:text-6xl md:text-7xl"
            style="text-shadow: 0 1px 0 oklch(0.4 0.2 18), 0 0 28px oklch(0.65 0.22 15 / 0.45);"
          >
            my teams
          </span>
        </h1>
        <p class="text-foreground/85 mt-3 text-base">Build your squad. Chase the glory.</p>
      </div>

      <!-- Trophy hero block -->
      <div class="relative h-40 w-full sm:h-56 lg:h-64 lg:w-[28rem]" aria-hidden="true">
        <!-- Stadium light radial wash + confetti dots -->
        <div
          class="absolute inset-0 rounded-2xl"
          style="
            background:
              radial-gradient(circle at 50% 65%, oklch(0.78 0.18 80 / 0.55), transparent 55%),
              radial-gradient(circle at 30% 30%, oklch(0.55 0.2 250 / 0.35), transparent 60%),
              radial-gradient(circle at 80% 25%, oklch(0.55 0.22 25 / 0.3), transparent 55%);
          "
        ></div>
        <!-- Confetti specks -->
        <div class="pointer-events-none absolute inset-0">
          <span
            class="absolute h-1.5 w-3 rotate-12 rounded-sm bg-[oklch(0.7_0.22_25)]"
            style="top: 28%; left: 18%;"
          ></span>
          <span
            class="absolute h-1.5 w-3 -rotate-12 rounded-sm bg-[oklch(0.7_0.18_245)]"
            style="top: 52%; left: 22%;"
          ></span>
          <span
            class="absolute h-1 w-2 rotate-45 rounded-sm bg-[oklch(0.78_0.18_80)]"
            style="top: 18%; left: 38%;"
          ></span>
          <span
            class="absolute h-1.5 w-3 rotate-6 rounded-sm bg-[oklch(0.7_0.22_25)]"
            style="top: 72%; left: 30%;"
          ></span>
          <span
            class="absolute h-1 w-2 -rotate-12 rounded-sm bg-[oklch(0.7_0.18_245)]"
            style="top: 80%; left: 70%;"
          ></span>
          <span
            class="absolute h-1.5 w-3 rotate-30 rounded-sm bg-[oklch(0.78_0.18_80)]"
            style="top: 25%; left: 78%;"
          ></span>
        </div>
        <!-- Trophy glow + icon -->
        <div class="absolute inset-0 grid place-items-center">
          <div class="relative">
            <div
              class="absolute inset-0 -m-8 rounded-full blur-2xl"
              style="background: radial-gradient(circle, oklch(0.85 0.18 80 / 0.6), transparent 65%);"
            ></div>
            <Trophy
              class="relative size-32 sm:size-40 lg:size-48"
              style="color: oklch(0.85 0.16 80); filter: drop-shadow(0 4px 24px oklch(0.65 0.22 35 / 0.5));"
              strokeWidth={1.5}
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Buttons positioned absolute top-right of the hero -->
    <div class="absolute top-8 right-0 flex items-center gap-2 print:hidden sm:top-12">
      {#if copiedAt > 0}
        <span class="text-foreground/70 mr-2 text-xs">Link copied!</span>
      {/if}
      <Button variant="outline" size="sm" onclick={share}>
        <Share2 class="size-4" />
        Share
      </Button>
      <Button variant="outline" size="sm" onclick={printPage}>
        <Printer class="size-4" />
        Print
      </Button>
      <Button
        variant="outline"
        size="sm"
        onclick={confirmReset}
        class="border-primary/50 text-primary hover:bg-primary/10"
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
