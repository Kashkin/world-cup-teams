<script lang="ts">
  import type { Team } from '$lib/types';

  interface Props {
    team: Team;
    rank?: number;
  }
  let { team, rank }: Props = $props();

  let statsLine = $derived.by(() => {
    if (team.appearances === 0) return 'First-time qualifier';

    const parts: string[] = [];
    parts.push(`${team.appearances} ${team.appearances === 1 ? 'appearance' : 'appearances'}`);
    if (team.matchWins > 0) {
      parts.push(`${team.matchWins} ${team.matchWins === 1 ? 'win' : 'wins'}`);
    }
    if (team.trophies > 0) {
      const trophyPart = `${team.trophies}× Champion${team.lastTrophy ? ` (${team.lastTrophy})` : ''}`;
      parts.push(trophyPart);
    } else if (team.bestFinish !== 'Group stage') {
      parts.push(`best: ${team.bestFinish}`);
    }
    return parts.join(' · ');
  });
</script>

<article
  class="bg-card flex items-center gap-3 rounded-lg border px-3 py-2 shadow-sm"
  data-code={team.code}
>
  {#if rank != null}
    <span class="text-muted-foreground w-6 self-center text-right tabular-nums">{rank}.</span>
  {/if}
  <img
    src={team.flag}
    alt=""
    class="h-6 w-9 self-center rounded-sm object-cover"
    width="36"
    height="24"
  />
  <div class="flex flex-1 flex-col gap-0.5">
    <div class="flex items-baseline gap-2">
      <span class="font-medium">{team.name}</span>
      <span class="text-muted-foreground ml-auto text-xs tabular-nums">
        {#if team.ranking != null}#{team.ranking} · {/if}{team.confederation}
      </span>
    </div>
    <div class="text-muted-foreground text-xs tabular-nums">
      {statsLine}
    </div>
  </div>
</article>
