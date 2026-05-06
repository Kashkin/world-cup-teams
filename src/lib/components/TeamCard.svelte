<script lang="ts">
  import type { Team, Confederation } from '$lib/types';

  interface Props {
    team: Team;
    rank?: number;
    /** When true, render the position pill (the "1.", "2." on the left). */
    showPosition?: boolean;
    /** When true, paint a magenta accent bar + tinted bg on the position pill (squad rows). */
    accent?: boolean;
  }
  let { team, rank, showPosition = false, accent = false }: Props = $props();

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
      parts.push(`${team.trophies}× Champion${team.lastTrophy ? ` (${team.lastTrophy})` : ''}`);
    } else if (team.bestFinish !== 'Group stage') {
      parts.push(`Best: ${team.bestFinish}`);
    }
    return parts.join(' • ');
  });
</script>

<article
  class="bg-card hover:bg-card/80 flex items-stretch gap-3 overflow-hidden rounded-xl border border-white/8 transition-colors"
  class:border-primary={accent}
  class:bg-card={!accent}
  data-code={team.code}
>
  {#if showPosition && rank != null}
    <div
      class="font-display flex w-12 shrink-0 items-center justify-center text-2xl tracking-wide tabular-nums"
      class:text-foreground={!accent}
      class:text-primary={accent}
      class:bg-primary={accent}
      class:!text-primary-foreground={accent}
      style={accent
        ? 'background: oklch(0.32 0.12 18); color: oklch(0.85 0.18 25);'
        : 'color: oklch(0.55 0.04 263);'}
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

  <div class="flex min-w-0 flex-1 items-center gap-3 py-3 pr-3">
    <div class="min-w-0 flex-1">
      <div class="text-foreground truncate text-base leading-snug font-semibold">{team.name}</div>
      <div class="text-foreground/55 truncate text-xs">{statsLine}</div>
    </div>
    <span
      class="shrink-0 text-xs font-bold tracking-wider {CONF_CLASS[team.confederation]}"
    >
      {team.confederation}
    </span>
  </div>
</article>
