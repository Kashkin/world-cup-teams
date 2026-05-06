import { TeamSchema, type Team } from './types';
import raw from '../../data/teams.json';

export const teams: readonly Team[] = Object.freeze(raw.map((t) => TeamSchema.parse(t)));

export const teamsByCode: ReadonlyMap<string, Team> = new Map(teams.map((t) => [t.code, t]));
