<script lang="ts">
  import type { Team } from '$lib/types';
  import TeamCard from './TeamCard.svelte';
  import { Button } from '$lib/components/ui/button';
  import { send, receive } from '$lib/transitions';
  import Search from '@lucide/svelte/icons/search';
  import Plus from '@lucide/svelte/icons/plus';

  interface Props {
    teams: readonly Team[];
    onAdd: (code: string) => void;
  }
  let { teams, onAdd }: Props = $props();

  let query = $state('');
  let visibleCount = $state(10);

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
  let visible = $derived(query ? filtered : filtered.slice(0, visibleCount));
  let hasMore = $derived(!query && filtered.length > visibleCount);
</script>

<section class="flex flex-col gap-3 print:hidden">
  <!-- Search input -->
  <label class="relative block">
    <Search
      class="text-foreground/45 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
    />
    <input
      type="search"
      bind:value={query}
      placeholder="Search teams..."
      class="bg-card placeholder:text-foreground/40 focus:ring-primary/40 h-11 w-full rounded-xl border border-white/8 pr-3 pl-10 text-sm transition-all outline-none focus:border-white/15 focus:ring-2"
    />
  </label>

  {#if visible.length === 0}
    <p class="text-foreground/50 py-6 text-center text-sm">No teams match.</p>
  {:else}
    <ul class="flex flex-col gap-2">
      {#each visible as team, i (team.code)}
        <li in:receive={{ key: team.code }} out:send={{ key: team.code }}>
          <TeamCard {team} rank={i + 1} showPosition>
            {#snippet actions()}
              <button
                type="button"
                onclick={() => onAdd(team.code)}
                aria-label="Add {team.name}"
                class="bg-white/5 text-foreground/70 hover:bg-primary/20 hover:text-primary grid size-9 place-items-center rounded-full transition-colors"
              >
                <Plus class="size-4" />
              </button>
            {/snippet}
          </TeamCard>
        </li>
      {/each}
    </ul>
  {/if}

  {#if hasMore}
    <Button
      variant="ghost"
      onclick={() => (visibleCount += 10)}
      class="text-primary hover:bg-primary/10 hover:text-primary mt-1 h-12 rounded-xl border border-white/8"
    >
      <Plus class="size-4" />
      Show more teams
    </Button>
  {/if}
</section>
