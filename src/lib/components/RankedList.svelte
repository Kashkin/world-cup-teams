<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { dndzone, type DndEvent } from 'svelte-dnd-action';
  import { teamsByCode } from '$lib/teams';
  import { quotes, randomQuote, type Quote as QuoteData } from '$lib/quotes';
  import TeamCard from './TeamCard.svelte';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import X from '@lucide/svelte/icons/x';
  import Trophy from '@lucide/svelte/icons/trophy';
  import Quote from '@lucide/svelte/icons/quote';
  import SoccerBall from './SoccerBall.svelte';

  interface Props {
    ranking: readonly string[];
    onReorder: (next: string[]) => void;
    onRemove: (code: string) => void;
    /** Total team pool, for the "n/N" squad-size display. */
    totalTeams?: number;
  }
  let { ranking, onReorder, onRemove, totalTeams = 48 }: Props = $props();

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

  // Quote rotates on every page load. The aside is rendered with quotes[0] in the
  // prerendered HTML to reserve layout space, but kept invisible (opacity-0) until
  // onMount runs and assigns a random pick — so the user never sees the placeholder
  // get swapped out on hydration.
  let quote = $state<QuoteData>(quotes[0]);
  let quoteReady = $state(false);
  onMount(() => {
    quote = randomQuote();
    quoteReady = true;
  });

  function move(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= ranking.length) return;
    const next = [...ranking];
    [next[i], next[j]] = [next[j], next[i]];
    onReorder(next);
  }
</script>

<section class="flex flex-col gap-4 h-full">
  <!-- Squad header with magenta bar accent -->
  <div class="flex items-center justify-between">
    <h2
      class="font-display text-foreground/95 flex items-center gap-3 text-xl tracking-wider uppercase"
    >
      <span class="bg-primary inline-block h-5 w-1 rounded-sm"></span>
      My teams
      <span class="text-foreground/55 text-base font-normal normal-case tabular-nums">
        ({items.length}/{totalTeams})
      </span>
    </h2>
  </div>

  {#if items.length > 0}
    <ol
      class="flex flex-col gap-2"
      use:dndzone={{
        items,
        flipDurationMs: 150,
        type: 'teams',
        // Override the default rgba(255,255,102) yellow outline with a subtle
        // magenta dashed ring that matches the theme. outline (not box-shadow)
        // because the dndzone is a flex container and outline doesn't push siblings.
        dropTargetStyle: {
          outline: '2px dashed oklch(0.65 0.22 15 / 0.5)',
          'outline-offset': '6px',
          'border-radius': '12px',
        },
      }}
      onconsider={consider}
      onfinalize={finalize}
    >
      {#each items as { id }, i (id)}
        {@const team = teamsByCode.get(id)}
        <!--
          Always render an <li> for every item, including dndzone's transient
          shadow placeholder. The lib walks the container's children by index
          to apply styles, so missing children = wrong element gets hidden.
        -->
        <li>
          {#if team}
            <TeamCard {team} rank={i + 1} showPosition accent>
              {#snippet actions()}
                <button
                  type="button"
                  onclick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="Move {team.name} up"
                  class="bg-white/5 text-foreground/70 hover:bg-white/10 hover:text-foreground grid size-8 place-items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ArrowUp class="size-4" />
                </button>
                <button
                  type="button"
                  onclick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  aria-label="Move {team.name} down"
                  class="bg-white/5 text-foreground/70 hover:bg-white/10 hover:text-foreground grid size-8 place-items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ArrowDown class="size-4" />
                </button>
                <button
                  type="button"
                  onclick={() => onRemove(id)}
                  aria-label="Remove {team.name}"
                  class="bg-primary/20 hover:bg-primary/30 text-primary grid size-8 place-items-center rounded-full transition-colors"
                >
                  <X class="size-4" />
                </button>
              {/snippet}
            </TeamCard>
          {/if}
        </li>
      {/each}
    </ol>
  {/if}

  <!-- Empty state -->
  {#if items.length === 0}
    <div
      class="border-foreground/15 grid place-items-center rounded-2xl border-2 border-dashed px-6 py-16 text-center print:hidden"
    >
      <Trophy class="text-foreground mb-3 size-12" strokeWidth={1.5} />
      <p class="text-foreground/85 text-base font-medium">Add teams from the left</p>
      <p class="text-foreground/50 mt-1 text-sm">Start planning the teams you'll support!</p>
    </div>
  {/if}

  <!-- Quote callout — invisible until the random pick lands on mount, see above. -->
  <aside
    class="relative mt-auto flex items-center gap-4 overflow-hidden rounded-xl border border-white/8 p-5 transition-opacity duration-300 print:hidden"
    class:opacity-0={!quoteReady}
    style="background-image: linear-gradient(135deg, oklch(0.27 0.12 18 / 0.2) 0%, oklch(0.22 0.08 18 / 0.5) 100%);"
  >
    <Quote class="text-primary size-5 shrink-0 self-start" fill="currentColor" />
    <div class="flex-1">
      <p class="text-foreground/90 text-sm leading-relaxed">{quote.text}</p>
      {#if quote.person}
        <p class="text-foreground/55 mt-1.5 text-xs">
          — <strong>{quote.person}</strong>{quote.role ? `, ${quote.role}` : ''}
        </p>
      {/if}
    </div>
    <SoccerBall class="text-primary-foreground/80 size-12 shrink-0" />
  </aside>
</section>
