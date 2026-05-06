<script lang="ts">
  import { teamsByCode } from '$lib/teams';
  import TeamCard from './TeamCard.svelte';
  import { Button } from '$lib/components/ui/button';

  interface Props {
    ranking: readonly string[];
    onReorder: (next: string[]) => void;
    onRemove: (code: string) => void;
  }
  let { ranking, onReorder, onRemove }: Props = $props();

  function move(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= ranking.length) return;
    const next = [...ranking];
    [next[i], next[j]] = [next[j], next[i]];
    onReorder(next);
  }
</script>

{#if ranking.length === 0}
  <p class="text-muted-foreground text-sm">Pick teams from the left to start your list.</p>
{:else}
  <ol class="flex flex-col gap-2">
    {#each ranking as code, i (code)}
      {@const team = teamsByCode.get(code)}
      {#if team}
        <li class="flex items-center gap-2">
          <div class="flex-1"><TeamCard {team} rank={i + 1} /></div>
          <Button
            size="icon-sm"
            variant="ghost"
            onclick={() => move(i, -1)}
            disabled={i === 0}
            aria-label="Move {team.name} up">↑</Button
          >
          <Button
            size="icon-sm"
            variant="ghost"
            onclick={() => move(i, 1)}
            disabled={i === ranking.length - 1}
            aria-label="Move {team.name} down">↓</Button
          >
          <Button
            size="icon-sm"
            variant="ghost"
            onclick={() => onRemove(code)}
            aria-label="Remove {team.name}">×</Button
          >
        </li>
      {/if}
    {/each}
  </ol>
{/if}
