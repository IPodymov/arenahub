'use client';

import { cn } from '@/lib/utils';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Табы-кнопки (состояние хранит родитель — обычно в URL). */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn('border-border flex gap-1 overflow-x-auto border-b', className)}
    >
      {items.map((item) => (
        <button
          key={item.value}
          role="tab"
          type="button"
          aria-selected={item.value === value}
          onClick={() => onChange(item.value)}
          className={cn(
            '-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            item.value === value
              ? 'border-primary text-foreground'
              : 'text-muted hover:text-foreground border-transparent',
          )}
        >
          {item.label}
          {item.count !== undefined && <span className="text-muted ml-1.5">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}
