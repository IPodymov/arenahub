'use client';

import {
  type AdminUserDto,
  type MeDto,
  type Paginated,
  ROLE_LABELS,
  UserRole,
} from '@arenahub/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { PageTitle } from '@/components/layout/page-title';
import { RequireAuth } from '@/components/layout/require-auth';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { api, errorText } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { qk } from '@/lib/queries';

function UserRow({ u, me }: { u: AdminUserDto; me: MeDto }) {
  const qc = useQueryClient();
  const change = useMutation({
    mutationFn: (req: { path: string; method: 'PATCH' | 'POST'; body?: unknown }) =>
      api<AdminUserDto>(`/admin/users/${u.id}/${req.path}`, req.method, req.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
  const self = u.id === me.id;

  return (
    <Card className="flex flex-col gap-2 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/users/${u.id}`} className="truncate font-medium hover:underline">
              {u.nickname}
            </Link>
            {u.bannedAt && <Badge variant="danger">Заблокирован</Badge>}
            {!u.canLogin && <Badge>Без пароля</Badge>}
            {self && <Badge variant="primary">Это вы</Badge>}
          </div>
          <p className="text-muted mt-1 text-xs">с {formatDateTime(u.createdAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="h-8 w-44"
            aria-label={`Роль ${u.nickname}`}
            value={u.role}
            disabled={self || change.isPending}
            onChange={(e) =>
              change.mutate({ path: 'role', method: 'PATCH', body: { role: e.target.value } })
            }
          >
            {UserRole.options.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            variant={u.bannedAt ? 'secondary' : 'danger'}
            disabled={self || change.isPending}
            onClick={() => change.mutate({ path: u.bannedAt ? 'unban' : 'ban', method: 'POST' })}
          >
            {u.bannedAt ? 'Разблокировать' : 'Заблокировать'}
          </Button>
        </div>
      </div>
      {change.error && <Alert tone="danger">{errorText(change.error)}</Alert>}
    </Card>
  );
}

function Users({ me }: { me: MeDto }) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const query = useDeferredValue(q.trim());
  const { data } = useQuery({
    queryKey: qk.adminUsers(query, page),
    queryFn: () =>
      api<Paginated<AdminUserDto>>(
        `/admin/users?page=${page}&pageSize=30${query ? `&q=${encodeURIComponent(query)}` : ''}`,
      ),
    placeholderData: (prev) => prev,
  });
  const pages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <>
      <PageTitle
        title="Пользователи"
        subtitle="Модераторы создают и публикуют турниры и рассматривают предложения игроков."
      />
      <Input
        className="mb-4 max-w-sm"
        type="search"
        placeholder="Поиск по никнейму"
        aria-label="Поиск по никнейму"
        value={q}
        maxLength={24}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
      />
      <div className="flex flex-col gap-2">
        {data?.items.map((u) => (
          <UserRow key={u.id} u={u} me={me} />
        ))}
        {data?.items.length === 0 && (
          <p className="text-muted py-12 text-center text-sm">Никого не нашли</p>
        )}
      </div>
      {pages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Назад
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            Вперёд
          </Button>
        </div>
      )}
    </>
  );
}

export default function AdminUsersPage() {
  return <RequireAuth access="admin">{(me) => <Users me={me} />}</RequireAuth>;
}
