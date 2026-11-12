'use client';

import {
  BEST_OF_LABELS,
  BestOf,
  BRACKET_LABELS,
  BracketType,
  CATEGORY_LABELS,
  formatLabel,
  type GameDto,
  PRIZE_SOURCE_LABELS,
  type PrizeSource,
  rublesToKopecks,
  TournamentCategory,
  type TournamentDto,
} from '@arenahub/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { type FormEvent, type ReactNode, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Hint, Input, Label, Select, Textarea } from '@/components/ui/input';
import { api, errorText } from '@/lib/api';
import { isoToMoscowLocal, moscowLocalToIso } from '@/lib/format';
import { qk } from '@/lib/queries';

const HOUR = 3600_000;

function slugify(s: string): string {
  const map: Record<string, string> = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'h',
    ц: 'c',
    ч: 'ch',
    ш: 'sh',
    щ: 'sch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya',
  };
  return s
    .toLowerCase()
    .split('')
    .map((c) => map[c] ?? c)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function initialForm(game: GameDto) {
  const now = Date.now();
  return {
    title: '',
    slug: '',
    gameCode: game.code as string,
    teamSize: game.policy.allowedTeamSizes[0]!,
    maxSubstitutes: 0,
    bracketType: 'SINGLE_ELIMINATION',
    bestOf: 'BO1',
    finalsBestOf: '',
    category: 'OPEN',
    maxSlots: 16,
    minAge: '',
    entryFeeRub: 0,
    prizePoolRub: 0,
    prizeSource: 'NONE' as PrizeSource,
    registrationOpensAt: isoToMoscowLocal(new Date(now).toISOString()),
    registrationClosesAt: isoToMoscowLocal(new Date(now + 72 * HOUR).toISOString()),
    startsAt: isoToMoscowLocal(new Date(now + 96 * HOUR).toISOString()),
    description: '',
    rules: '',
    publish: true,
  };
}
type FormState = ReturnType<typeof initialForm>;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">{children}</CardContent>
    </Card>
  );
}

/**
 * Форма турнира. staff — модератор создаёт турнир (и может сразу опубликовать),
 * proposal — пользователь отправляет предложение на рассмотрение.
 */
export function TournamentForm({
  games,
  mode,
  onDone,
}: {
  games: GameDto[];
  mode: 'staff' | 'proposal';
  onDone?: () => void;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [f, setF] = useState(() => initialForm(games[0]!));
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setF((prev) => ({ ...prev, [key]: value }));

  const game = games.find((g) => g.code === f.gameCode)!;
  const policy = game.policy;

  // Подстраиваем форму под политику выбранной игры (UX; окончательная проверка — в API)
  function changeGame(code: string) {
    const p = games.find((g) => g.code === code)!.policy;
    setF((prev) => ({
      ...prev,
      gameCode: code,
      teamSize: p.allowedTeamSizes.includes(prev.teamSize) ? prev.teamSize : p.allowedTeamSizes[0]!,
      maxSubstitutes: Math.min(prev.maxSubstitutes, p.maxSubstitutes),
      entryFeeRub: p.paidEntryAllowed ? prev.entryFeeRub : 0,
      prizeSource: p.allowedPrizeSources.includes(prev.prizeSource) ? prev.prizeSource : 'NONE',
    }));
  }

  const create = useMutation({
    mutationFn: async () => {
      const t = await api<TournamentDto>(
        mode === 'staff' ? '/admin/tournaments' : '/proposals',
        'POST',
        {
          slug: f.slug,
          title: f.title,
          description: f.description || null,
          rules: f.rules || null,
          gameCode: f.gameCode,
          participantType: f.teamSize === 1 ? 'SOLO' : 'TEAM',
          teamSize: f.teamSize,
          maxSubstitutes: f.teamSize === 1 ? 0 : f.maxSubstitutes,
          bracketType: f.bracketType,
          bestOf: f.bestOf,
          finalsBestOf: f.finalsBestOf || null,
          category: f.category,
          maxSlots: f.maxSlots,
          minAge: f.minAge ? Number(f.minAge) : null,
          entryFeeKopecks: rublesToKopecks(f.entryFeeRub),
          prizePoolKopecks: rublesToKopecks(f.prizePoolRub),
          prizeSource: f.prizeSource,
          prizeDistribution: f.prizePoolRub > 0 ? [{ place: 1, shareBp: 10_000 }] : null,
          registrationOpensAt: moscowLocalToIso(f.registrationOpensAt),
          registrationClosesAt: moscowLocalToIso(f.registrationClosesAt),
          startsAt: moscowLocalToIso(f.startsAt),
        },
      );
      if (mode === 'staff' && f.publish) await api(`/admin/tournaments/${t.id}/publish`, 'POST');
      return t;
    },
    onSuccess: async () => {
      if (mode === 'proposal') {
        await qc.invalidateQueries({ queryKey: qk.myProposals });
        setF(initialForm(games[0]!));
        onDone?.();
        return;
      }
      await qc.invalidateQueries({ queryKey: ['admin'] });
      await qc.invalidateQueries({ queryKey: ['tournaments'] });
      router.push('/admin/tournaments');
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <form onSubmit={submit} className="flex max-w-3xl flex-col gap-4">
      <Section title="Основное">
        <Label className="sm:col-span-2">
          Название
          <Input
            value={f.title}
            required
            minLength={3}
            maxLength={120}
            onChange={(e) =>
              setF((p) => ({
                ...p,
                title: e.target.value,
                slug: p.slug && p.slug !== slugify(p.title) ? p.slug : slugify(e.target.value),
              }))
            }
          />
        </Label>
        <Label>
          Адрес (slug)
          <Input
            value={f.slug}
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            onChange={(e) => set('slug', e.target.value)}
          />
          <Hint>/tournaments/{f.slug || '…'}</Hint>
        </Label>
        <Label>
          Категория
          <Select value={f.category} onChange={(e) => set('category', e.target.value)}>
            {TournamentCategory.options.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </Label>
      </Section>

      <Section title="Игра и формат">
        <Label>
          Игра
          <Select value={f.gameCode} onChange={(e) => changeGame(e.target.value)}>
            {games.map((g) => (
              <option key={g.code} value={g.code}>
                {g.name}
              </option>
            ))}
          </Select>
          {policy.notes && <Hint>{policy.notes}</Hint>}
        </Label>
        <Label>
          Формат
          <Select value={f.teamSize} onChange={(e) => set('teamSize', Number(e.target.value))}>
            {policy.allowedTeamSizes.map((s) => (
              <option key={s} value={s}>
                {formatLabel(s)}
              </option>
            ))}
          </Select>
        </Label>
        {f.teamSize > 1 && (
          <Label>
            Запасных
            <Input
              type="number"
              min={0}
              max={policy.maxSubstitutes}
              value={f.maxSubstitutes}
              onChange={(e) => set('maxSubstitutes', Number(e.target.value))}
            />
            <Hint>Не больше {policy.maxSubstitutes} для этой игры</Hint>
          </Label>
        )}
        <Label>
          Сетка
          <Select value={f.bracketType} onChange={(e) => set('bracketType', e.target.value)}>
            {BracketType.options.map((b) => (
              <option key={b} value={b}>
                {BRACKET_LABELS[b]}
              </option>
            ))}
          </Select>
        </Label>
        <Label>
          Матчи
          <Select value={f.bestOf} onChange={(e) => set('bestOf', e.target.value)}>
            {BestOf.options.map((b) => (
              <option key={b} value={b}>
                {BEST_OF_LABELS[b]}
              </option>
            ))}
          </Select>
        </Label>
        <Label>
          Финал
          <Select value={f.finalsBestOf} onChange={(e) => set('finalsBestOf', e.target.value)}>
            <option value="">Как остальные матчи</option>
            {BestOf.options.map((b) => (
              <option key={b} value={b}>
                {BEST_OF_LABELS[b]}
              </option>
            ))}
          </Select>
        </Label>
        <Label>
          Слотов
          <Input
            type="number"
            min={2}
            max={1024}
            value={f.maxSlots}
            onChange={(e) => set('maxSlots', Number(e.target.value))}
          />
        </Label>
        <Label>
          Минимальный возраст
          <Input
            type="number"
            min={policy.minAge}
            max={99}
            placeholder={String(policy.minAge)}
            value={f.minAge}
            onChange={(e) => set('minAge', e.target.value)}
          />
          <Hint>Пусто — по правилам игры ({policy.minAge}+)</Hint>
        </Label>
      </Section>

      <Section title="Взнос и призы">
        <Label>
          Взнос, ₽
          <Input
            type="number"
            min={0}
            step={1}
            disabled={!policy.paidEntryAllowed}
            value={f.entryFeeRub}
            onChange={(e) => set('entryFeeRub', Number(e.target.value))}
          />
          <Hint>
            {policy.paidEntryAllowed
              ? 'Платные турниры доступны только игрокам 18+'
              : 'Правила издателя запрещают платный вход для этой игры'}
          </Hint>
        </Label>
        <Label>
          Призовой фонд, ₽
          <Input
            type="number"
            min={0}
            step={1}
            value={f.prizePoolRub}
            onChange={(e) => set('prizePoolRub', Number(e.target.value))}
          />
        </Label>
        <Label>
          Источник фонда
          <Select
            value={f.prizeSource}
            onChange={(e) => set('prizeSource', e.target.value as PrizeSource)}
          >
            {policy.allowedPrizeSources.map((s) => (
              <option key={s} value={s}>
                {PRIZE_SOURCE_LABELS[s]}
              </option>
            ))}
          </Select>
        </Label>
      </Section>

      <Section title="Расписание (МСК)">
        <Label>
          Открытие регистрации
          <Input
            type="datetime-local"
            required
            value={f.registrationOpensAt}
            onChange={(e) => set('registrationOpensAt', e.target.value)}
          />
        </Label>
        <Label>
          Закрытие регистрации
          <Input
            type="datetime-local"
            required
            value={f.registrationClosesAt}
            onChange={(e) => set('registrationClosesAt', e.target.value)}
          />
        </Label>
        <Label>
          Старт
          <Input
            type="datetime-local"
            required
            value={f.startsAt}
            onChange={(e) => set('startsAt', e.target.value)}
          />
        </Label>
      </Section>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-4 sm:pt-5">
          <Label>
            Описание
            <Textarea
              value={f.description}
              onChange={(e) => set('description', e.target.value)}
              maxLength={5000}
            />
          </Label>
          <Label>
            Правила
            <Textarea
              value={f.rules}
              onChange={(e) => set('rules', e.target.value)}
              className="min-h-40"
              maxLength={20000}
            />
          </Label>
          {mode === 'staff' ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={f.publish}
                onChange={(e) => set('publish', e.target.checked)}
              />
              Сразу опубликовать
            </label>
          ) : (
            <Hint>Турнир появится в каталоге после одобрения модератором.</Hint>
          )}
          {create.error && <Alert tone="danger">{errorText(create.error)}</Alert>}
          <Button type="submit" size="lg" disabled={create.isPending}>
            {mode === 'staff' ? 'Создать турнир' : 'Отправить на рассмотрение'}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
