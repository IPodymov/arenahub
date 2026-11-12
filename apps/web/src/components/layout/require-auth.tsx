'use client';

import { isStaff, type MeDto } from '@arenahub/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe } from '@/lib/queries';

/** Показывает children только вошедшему пользователю; access сужает круг до персонала или админов. */
export function RequireAuth({
  children,
  access = 'user',
}: {
  children: (me: MeDto) => ReactNode;
  access?: 'user' | 'staff' | 'admin';
}) {
  const { data: me, isPending } = useMe();
  if (isPending) return <Skeleton className="h-40 w-full" />;
  if (!me) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-muted">Чтобы продолжить, войдите в аккаунт</p>
        <Button asChild>
          <Link href="/login">Войти</Link>
        </Button>
      </div>
    );
  }
  if (access === 'staff' && !isStaff(me.role))
    return <p className="text-muted py-16 text-center">Раздел доступен модераторам</p>;
  if (access === 'admin' && me.role !== 'ADMIN')
    return <p className="text-muted py-16 text-center">Раздел доступен только администраторам</p>;
  return <>{children(me)}</>;
}
