<script lang="ts">
  import type { Team } from '$lib/types';

  interface Props {
    team: Team;
    rank?: number;
  }
  let { team, rank }: Props = $props();
</script>

<article
  class="bg-card flex items-center gap-3 rounded-lg border px-3 py-2 shadow-sm"
  data-code={team.code}
>
  {#if rank != null}
    <span class="text-muted-foreground w-6 text-right tabular-nums">{rank}.</span>
  {/if}
  <img src={team.flag} alt="" class="h-4 w-6 rounded-sm object-cover" />
  <span class="flex-1 font-medium">{team.name}</span>
  <span class="text-muted-foreground text-xs">{team.confederation}</span>
  {#if team.ranking != null}
    <span class="text-muted-foreground text-xs tabular-nums">#{team.ranking}</span>
  {/if}
</article>
