<script lang="ts">
  import { untrack } from 'svelte';
  import { dndzone, type DndEvent } from 'svelte-dnd-action';
  import { teamsByCode } from '$lib/teams';
  import TeamCard from './TeamCard.svelte';
  import { Button } from '$lib/components/ui/button';
  import { send, receive } from '$lib/transitions';

  interface Props {
    ranking: readonly string[];
    onReorder: (next: string[]) => void;
    onRemove: (code: string) => void;
  }
  let { ranking, onReorder, onRemove }: Props = $props();

  type DndItem = { id: string };
  let items = $state<DndItem[]>([]);

  // Mirror the ranking prop into local mutable items. dndzone mutates `items` mid-drag
  // (placeholder shadow row), so we MUST untrack the local read — otherwise the
  // mid-drag mutation re-fires this effect and clobbers the in-flight reorder.
  $effect(() => {
    const propIds = ranking.join('|');
    const localIds = untrack(() => items.map((i) => i.id).join('|'));
    if (propIds !== localIds) {
      items = ranking.map((id) => ({ id }));
    }
  });

  function consider(e: CustomEvent<DndEvent<DndItem>>) {
    items = e.detail.items;
  }
  function finalize(e: CustomEvent<DndEvent<DndItem>>) {
    items = e.detail.items;
    onReorder(items.map((i) => i.id));
  }

  function move(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= ranking.length) return;
    const next = [...ranking];
    [next[i], next[j]] = [next[j], next[i]];
    onReorder(next);
  }
</script>

{#if items.length === 0}
  <p class="text-muted-foreground text-sm">Pick teams from the left to start your list.</p>
{:else}
  <ol
    class="flex flex-col gap-2"
    use:dndzone={{ items, flipDurationMs: 150, type: 'teams' }}
    onconsider={consider}
    onfinalize={finalize}
  >
    {#each items as { id }, i (id)}
      {@const team = teamsByCode.get(id)}
      {#if team}
        <li
          class="flex items-center gap-2"
          in:receive={{ key: id }}
          out:send={{ key: id }}
        >
          <div class="flex-1"><TeamCard {team} rank={i + 1} /></div>
          <div class="flex gap-2 print:hidden">
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
              disabled={i === items.length - 1}
              aria-label="Move {team.name} down">↓</Button
            >
            <Button
              size="icon-sm"
              variant="ghost"
              onclick={() => onRemove(id)}
              aria-label="Remove {team.name}">×</Button
            >
          </div>
        </li>
      {/if}
    {/each}
  </ol>
{/if}
