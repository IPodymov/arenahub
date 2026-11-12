'use client';

import { isStaff } from '@arenahub/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Menu, Trophy, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useMe } from '@/lib/queries';
import { cn } from '@/lib/utils';

export function Header() {
  const { data: me } = useMe();
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const links = [
    { href: '/tournaments', label: 'Турниры' },
    ...(me ? [{ href: '/profile', label: 'Профиль' }] : []),
    // Персонал создаёт турниры сразу, остальные — предлагают
    ...(me && !isStaff(me.role) ? [{ href: '/proposals', label: 'Предложить турнир' }] : []),
    ...(isStaff(me?.role) ? [{ href: '/admin/tournaments', label: 'Модерация' }] : []),
    ...(me?.role === 'ADMIN' ? [{ href: '/admin/users', label: 'Пользователи' }] : []),
  ];

  async function logout() {
    await api('/auth/logout', 'POST');
    qc.clear();
    router.push('/');
  }

  return (
    <header className="border-border bg-background/90 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold"
          onClick={() => setOpen(false)}
        >
          <Trophy className="text-primary size-5" aria-hidden />
          ArenaHub
        </Link>

        <nav className="hidden flex-1 items-center gap-1 sm:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'text-muted hover:text-foreground rounded-md px-3 py-1.5 text-sm',
                pathname.startsWith(l.href) && 'text-foreground',
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 sm:flex">
          {me ? (
            <>
              <span className="text-muted text-sm">{me.nickname}</span>
              <Button variant="ghost" size="sm" onClick={logout}>
                Выйти
              </Button>
            </>
          ) : (
            me === null && (
              <Button asChild size="sm">
                <Link href="/login">Войти</Link>
              </Button>
            )
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="ml-auto sm:hidden"
          aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      {open && (
        <nav className="border-border flex flex-col gap-1 border-t px-4 py-3 sm:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-2 py-2 text-sm"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          {me ? (
            <button
              type="button"
              className="text-muted rounded-md px-2 py-2 text-left text-sm"
              onClick={logout}
            >
              Выйти ({me.nickname})
            </button>
          ) : (
            <Link
              href="/login"
              className="text-primary rounded-md px-2 py-2 text-sm"
              onClick={() => setOpen(false)}
            >
              Войти
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
