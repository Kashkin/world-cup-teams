<script lang="ts">
  import { onMount } from 'svelte';
  import { PersistedState } from 'runed';
  import { teams } from '$lib/teams';
  import { encodeRanking, decodeRanking } from '$lib/ranking';
  import UnrankedPool from '$lib/components/UnrankedPool.svelte';
  import RankedList from '$lib/components/RankedList.svelte';

  const ranking = new PersistedState<string[]>('wc26.ranking', []);

  // Mirror ranking → URL hash whenever it changes (after mount).
  $effect(() => {
    const encoded = encodeRanking(ranking.current);
    const next = encoded ? `#r=${encoded}` : '';
    if (typeof location !== 'undefined' && location.hash !== next) {
      history.replaceState(null, '', `${location.pathname}${location.search}${next}`);
    }
  });

  // Boot: if URL hash is present and storage is empty, adopt it.
  onMount(() => {
    if (!location.hash.startsWith('#r=')) return;
    const incoming = decodeRanking(location.hash.slice(3));
    if (incoming.length === 0) return;
    if (ranking.current.length === 0) {
      ranking.current = incoming;
    }
    // If storage already has a list, the shared link is ignored for now —
    // preview-mode banner is added in Task 18.
  });

  let unrankedTeams = $derived(teams.filter((t) => !ranking.current.includes(t.code)));

  function add(code: string) {
    ranking.current = [...ranking.current, code];
  }
  function remove(code: string) {
    ranking.current = ranking.current.filter((c) => c !== code);
  }
  function reorder(next: string[]) {
    ranking.current = next;
  }
</script>

<main class="mx-auto max-w-5xl p-4">
  <h1 class="mb-4 text-2xl font-semibold">World Cup 2026 — My Teams</h1>
  <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
    <UnrankedPool teams={unrankedTeams} onAdd={add} />
    <RankedList ranking={ranking.current} onReorder={reorder} onRemove={remove} />
  </div>
</main>
