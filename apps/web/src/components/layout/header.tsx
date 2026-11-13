'use client';

import { isStaff } from '@arenahub/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, LogOut, Menu, Trophy, User, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useMe } from '@/lib/queries';
import { cn } from '@/lib/utils';

function Avatar({ nickname, avatarUrl }: { nickname: string; avatarUrl: string | null }) {
  return avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- произвольный внешний домен
    <img src={avatarUrl} alt="" className="border-border size-6 rounded-full border object-cover" />
  ) : (
    <span className="bg-surface-2 text-muted flex size-6 items-center justify-center rounded-full text-xs font-semibold">
      {nickname.slice(0, 1).toUpperCase()}
    </span>
  );
}

function UserMenu({
  nickname,
  avatarUrl,
  onLogout,
}: {
  nickname: string;
  avatarUrl: string | null;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const item =
    'hover:bg-surface-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm';

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar nickname={nickname} avatarUrl={avatarUrl} />
        <span className="max-w-40 truncate">{nickname}</span>
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
      </Button>
      {open && (
        <div
          role="menu"
          className="border-border bg-surface absolute right-0 mt-1 w-44 rounded-md border p-1 shadow-lg"
        >
          <Link href="/profile" role="menuitem" className={item} onClick={() => setOpen(false)}>
            <User className="size-4" aria-hidden />
            Профиль
          </Link>
          <button
            type="button"
            role="menuitem"
            className={cn(item, 'text-danger')}
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <LogOut className="size-4" aria-hidden />
            Выйти
          </button>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { data: me } = useMe();
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const links = [
    { href: '/tournaments', label: 'Турниры' },
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
            <UserMenu nickname={me.nickname} avatarUrl={me.avatarUrl} onLogout={logout} />
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
            <div className="border-border mt-1 flex flex-col gap-1 border-t pt-2">
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm"
                onClick={() => setOpen(false)}
              >
                <Avatar nickname={me.nickname} avatarUrl={me.avatarUrl} />
                {me.nickname}
              </Link>
              <button
                type="button"
                className="text-danger flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm"
                onClick={() => {
                  setOpen(false);
                  void logout();
                }}
              >
                <LogOut className="size-4" aria-hidden />
                Выйти
              </button>
            </div>
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
