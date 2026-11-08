import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

const field =
  'w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(field, 'h-10', className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(field, 'min-h-24 py-2', className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(field, 'h-10 pr-8', className)} {...props} />;
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('flex flex-col gap-1.5 text-sm font-medium', className)} {...props} />
  );
}

export function Hint({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('text-muted text-xs font-normal', className)} {...props} />;
}
