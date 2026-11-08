'use client';

import type {
  GameDto,
  MeDto,
  MyRegistrationDto,
  Paginated,
  ParticipantDto,
  TeamDto,
  TournamentDto,
  TournamentListQuery,
  TournamentSummaryDto,
} from '@arenahub/shared';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from './api';

export const qk = {
  me: ['me'] as const,
  providers: ['auth', 'providers'] as const,
  games: ['games'] as const,
  tournaments: (q: TournamentListQuery) => ['tournaments', q] as const,
  tournament: (slug: string) => ['tournament', slug] as const,
  participants: (slug: string) => ['tournament', slug, 'participants'] as const,
  myRegistration: (slug: string) => ['tournament', slug, 'mine'] as const,
  myTeams: ['teams', 'mine'] as const,
  team: (id: string) => ['team', id] as const,
  adminTournaments: (page: number) => ['admin', 'tournaments', page] as const,
};

/** Текущий пользователь; null — не вошёл. */
export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: async () => {
      try {
        return await api<MeDto>('/auth/me');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 60_000,
  });
}

export function useAuthProviders() {
  return useQuery({
    queryKey: qk.providers,
    queryFn: () => api<{ steam: boolean; devLogin: boolean }>('/auth/providers'),
    staleTime: Infinity,
  });
}

export function useGames() {
  return useQuery({
    queryKey: qk.games,
    queryFn: () => api<GameDto[]>('/games'),
    staleTime: 10 * 60_000,
  });
}

export function useTournaments(q: TournamentListQuery) {
  const params = new URLSearchParams(
    Object.entries(q).flatMap(([k, v]) => (v === undefined || v === '' ? [] : [[k, String(v)]])),
  );
  return useQuery({
    queryKey: qk.tournaments(q),
    queryFn: () => api<Paginated<TournamentSummaryDto>>(`/tournaments?${params}`),
    placeholderData: (prev) => prev,
  });
}

export function useTournament(slug: string) {
  return useQuery({
    queryKey: qk.tournament(slug),
    queryFn: () => api<TournamentDto>(`/tournaments/${slug}`),
  });
}

export function useParticipants(slug: string) {
  return useQuery({
    queryKey: qk.participants(slug),
    queryFn: () => api<ParticipantDto[]>(`/tournaments/${slug}/participants`),
  });
}

export function useMyRegistration(slug: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.myRegistration(slug),
    queryFn: async () =>
      (
        await api<{ registration: MyRegistrationDto | null }>(
          `/tournaments/${slug}/registrations/mine`,
        )
      ).registration,
    enabled,
  });
}

export function useMyTeams(enabled = true) {
  return useQuery({ queryKey: qk.myTeams, queryFn: () => api<TeamDto[]>('/teams/mine'), enabled });
}

export function useTeam(id: string) {
  return useQuery({ queryKey: qk.team(id), queryFn: () => api<TeamDto>(`/teams/${id}`) });
}
