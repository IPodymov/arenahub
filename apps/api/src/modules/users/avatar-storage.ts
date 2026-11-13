import { randomBytes } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { del, put } from '@vercel/blob';
import { UPLOADS_PREFIX } from '../../bootstrap';
import { DomainError } from '../../common/domain-error';
import { ENV, type Env } from '../../config/env';

const AVATAR_SIZE = 256;
const LOCAL_PREFIX = `${UPLOADS_PREFIX}/avatars/`;
const BLOB_HOST_SUFFIX = '.blob.vercel-storage.com';

/**
 * Аватары пользователей: картинка приводится к квадрату 256×256 WebP и кладётся в Vercel Blob.
 * Без учётных данных Blob (локальная разработка, тесты) — на диск в UPLOADS_DIR/avatars.
 */
@Injectable()
export class AvatarStorage {
  private readonly logger = new Logger(AvatarStorage.name);
  private readonly useBlob: boolean;
  private readonly dir: string;

  constructor(@Inject(ENV) env: Env) {
    this.useBlob = Boolean(env.BLOB_STORE_ID || env.BLOB_READ_WRITE_TOKEN);
    this.dir = path.join(env.UPLOADS_DIR, 'avatars');
  }

  /** Возвращает публичный URL сохранённого файла. */
  async save(userId: string, input: Buffer): Promise<string> {
    const image = await this.process(input);
    if (this.useBlob) {
      // Случайный суффикс делает URL уникальным, поэтому кэш может быть вечным
      const blob = await put(`avatars/${userId}.webp`, image, {
        access: 'public',
        addRandomSuffix: true,
        contentType: 'image/webp',
        cacheControlMaxAge: 365 * 24 * 60 * 60,
      });
      return blob.url;
    }
    const name = `${userId}-${randomBytes(6).toString('hex')}.webp`;
    await mkdir(this.dir, { recursive: true });
    await writeFile(path.join(this.dir, name), image);
    return LOCAL_PREFIX + name;
  }

  /** Удаляет файл, если URL указывает на наше хранилище (аватар из Steam не трогаем). */
  async remove(url: string | null): Promise<void> {
    if (!url) return;
    try {
      if (url.startsWith(LOCAL_PREFIX)) {
        await rm(path.join(this.dir, path.basename(url)), { force: true });
      } else if (this.useBlob && isBlobUrl(url)) {
        await del(url);
      }
    } catch (err) {
      // Аватар уже заменён в профиле — осиротевший файл не повод ронять запрос
      this.logger.warn(`Не удалось удалить ${url}: ${String(err)}`);
    }
  }

  private async process(input: Buffer): Promise<Buffer> {
    // Ленивая загрузка: нативный модуль не нужен процессу, пока никто не грузит аватар
    const { default: sharp } = await import('sharp');
    try {
      return await sharp(input, { animated: false, limitInputPixels: 40_000_000 })
        .rotate() // учитываем EXIF-ориентацию; сами метаданные в результат не попадают
        .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'attention' })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      throw new DomainError('AVATAR_INVALID');
    }
  }
}

function isBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}
