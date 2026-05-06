import { crossfade } from 'svelte/transition';
import { quintOut } from 'svelte/easing';

// Shared crossfade pair: when a team is added or removed from the ranking, its
// card flies between the pool and the ranked list (rather than fading in/out
// independently). Items in pool and ranked components match by FIFA code via
// the `key` parameter.
export const [send, receive] = crossfade({
  duration: 300,
  easing: quintOut,
});
