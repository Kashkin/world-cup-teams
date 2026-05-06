<script lang="ts">
  import type { Team } from '$lib/types';
  import TeamCard from './TeamCard.svelte';
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';

  interface Props {
    teams: readonly Team[];
    onAdd: (code: string) => void;
  }
  let { teams, onAdd }: Props = $props();

  let query = $state('');

  let filtered = $derived(
    teams.filter((t) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        t.confederation.toLowerCase().includes(q)
      );
    }),
  );
</script>

<section class="flex flex-col gap-2">
  <Input bind:value={query} placeholder="Search teams" />
  {#if filtered.length === 0}
    <p class="text-muted-foreground py-2 text-sm">No teams match.</p>
  {:else}
    <ul class="flex flex-col gap-2">
      {#each filtered as team (team.code)}
        <li class="flex items-center gap-2">
          <div class="flex-1"><TeamCard {team} /></div>
          <Button
            size="icon-sm"
            variant="ghost"
            onclick={() => onAdd(team.code)}
            aria-label="Add {team.name}">+</Button
          >
        </li>
      {/each}
    </ul>
  {/if}
</section>
