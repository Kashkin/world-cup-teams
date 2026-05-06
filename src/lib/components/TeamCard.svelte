<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Team, Confederation } from '$lib/types';

  interface Props {
    team: Team;
    rank?: number;
    showPosition?: boolean;
    accent?: boolean;
    /** Action buttons rendered inside the card on the right (after the conf badge). */
    actions?: Snippet;
  }
  let { team, rank, showPosition = false, accent = false, actions }: Props = $props();

  const CONF_CLASS: Record<Confederation, string> = {
    AFC: 'text-conf-afc',
    CAF: 'text-conf-caf',
    CONCACAF: 'text-conf-concacaf',
    CONMEBOL: 'text-conf-conmebol',
    OFC: 'text-conf-ofc',
    UEFA: 'text-conf-uefa',
  };

  let statsLine = $derived.by(() => {
    if (team.appearances === 0) return 'First-time qualifier';
    const parts: string[] = [];
    parts.push(`${team.appearances} ${team.appearances === 1 ? 'appearance' : 'appearances'}`);
    if (team.matchWins > 0) {
      parts.push(`${team.matchWins} ${team.matchWins === 1 ? 'win' : 'wins'}`);
    }
    if (team.trophies > 0) {
      parts.push(`${team.trophies} × Champion${team.lastTrophy ? ` (${team.lastTrophy})` : ''}`);
    } else if (team.bestFinish !== 'Group stage') {
      parts.push(`Best: ${team.bestFinish}`);
    }
    return parts.join(' • ');
  });
</script>

<article
  class="bg-card hover:bg-card/80 flex items-stretch gap-3 overflow-hidden rounded-xl border border-white/8 transition-colors"
  class:border-primary={accent}
  data-code={team.code}
>
  {#if showPosition && rank != null}
    <div
      class="font-display flex w-12 shrink-0 items-center justify-center text-2xl tracking-wide tabular-nums"
      style={accent
        ? 'background-image: linear-gradient(135deg, oklch(0.85 0.04 263 / 0.2) 0%, oklch(0.45 0.14 263 / 0.5) 100%); color: oklch(0.95 0.04 263);'
        : 'color: oklch(0.85 0.04 263);'}
    >
      {rank}{accent ? '.' : ''}
    </div>
  {/if}

  <img
    src={team.flag}
    alt=""
    class="my-3 ml-1 h-9 w-12 shrink-0 self-center rounded-md object-cover ring-1 ring-white/10"
    width="48"
    height="36"
  />

  <div class="min-w-0 flex-1 self-center py-3">
    <div class="text-foreground truncate text-base leading-snug font-semibold">{team.name}</div>
    <div class="text-foreground/55 truncate text-xs">{statsLine}</div>
  </div>

  <div class="flex shrink-0 items-center gap-2 self-center pr-3">
    <span class="text-xs font-bold tracking-wider {CONF_CLASS[team.confederation]}">
      {team.confederation}
    </span>
    {#if actions}
      <div class="flex items-center gap-1.5 print:hidden">
        {@render actions()}
      </div>
    {/if}
  </div>
</article>
