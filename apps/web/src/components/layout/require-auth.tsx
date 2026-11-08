'use client';

import type { MeDto } from '@arenahub/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe } from '@/lib/queries';

/** Показывает children только вошедшему пользователю (и админу, если adminOnly). */
export function RequireAuth({
  children,
  adminOnly = false,
}: {
  children: (me: MeDto) => ReactNode;
  adminOnly?: boolean;
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
  if (adminOnly && me.role !== 'ADMIN')
    return <p className="text-muted py-16 text-center">Раздел доступен только администраторам</p>;
  return <>{children(me)}</>;
}
