import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Страница не найдена</h1>
      <Button asChild variant="secondary">
        <Link href="/">На главную</Link>
      </Button>
    </div>
  );
}
