<script lang="ts">
  import { onMount } from 'svelte';
  import { PersistedState } from 'runed';
  import { teams } from '$lib/teams';
  import { encodeRanking, decodeRanking } from '$lib/ranking';
  import UnrankedPool from '$lib/components/UnrankedPool.svelte';
  import RankedList from '$lib/components/RankedList.svelte';
  import { Button } from '$lib/components/ui/button';

  // Persistent storage of the user's own ranking.
  const ranking = new PersistedState<string[]>('wc26.ranking', []);

  // What the page shows. Equal to ranking.current except in preview mode (when a
  // shared link is opened on top of an existing saved list — we display the shared
  // ranking without writing it to storage until [Save as mine] is clicked).
  let displayed = $state<string[]>([]);
  let previewMode = $state(false);
  let copiedAt = $state(0);

  // Outside preview mode, displayed mirrors storage.
  $effect(() => {
    if (!previewMode) displayed = ranking.current;
  });

  // Mirror displayed → URL hash so the address bar always reflects what's on screen.
  $effect(() => {
    const encoded = encodeRanking(displayed);
    const next = encoded ? `#r=${encoded}` : '';
    if (typeof location !== 'undefined' && location.hash !== next) {
      history.replaceState(null, '', `${location.pathname}${location.search}${next}`);
    }
  });

  // Boot: if URL hash is present, decide between adopt and preview.
  onMount(() => {
    if (!location.hash.startsWith('#r=')) return;
    const incoming = decodeRanking(location.hash.slice(3));
    if (incoming.length === 0) return;
    if (ranking.current.length === 0) {
      ranking.current = incoming; // adopt directly into storage
    } else {
      displayed = incoming;
      previewMode = true;
    }
  });

  let unrankedTeams = $derived(teams.filter((t) => !displayed.includes(t.code)));

  function add(code: string) {
    if (previewMode) displayed = [...displayed, code];
    else ranking.current = [...ranking.current, code];
  }
  function remove(code: string) {
    if (previewMode) displayed = displayed.filter((c) => c !== code);
    else ranking.current = ranking.current.filter((c) => c !== code);
  }
  function reorder(next: string[]) {
    if (previewMode) displayed = next;
    else ranking.current = next;
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

<main class="mx-auto max-w-5xl p-4">
  <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
    <h1 class="text-2xl font-semibold">World Cup 2026 — My Teams</h1>
    <div class="flex items-center gap-2">
      {#if copiedAt > 0}
        <span class="text-muted-foreground text-sm">Link copied!</span>
      {/if}
      <Button variant="outline" size="sm" onclick={share}>Share</Button>
      <Button variant="outline" size="sm" onclick={printPage}>Print</Button>
      <Button variant="ghost" size="sm" onclick={confirmReset}>Reset</Button>
    </div>
  </header>

  {#if previewMode}
    <div
      class="bg-muted mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
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

  <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
    <UnrankedPool teams={unrankedTeams} onAdd={add} />
    <RankedList ranking={displayed} onReorder={reorder} onRemove={remove} />
  </div>
</main>
