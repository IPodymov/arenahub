import base from '@arenahub/eslint-config/base';
import nextVitals from 'eslint-config-next/core-web-vitals';

// Next первым: базовый конфиг ставит парсер typescript-eslint для TS-файлов поверх парсера Next.
export default [...nextVitals, ...base, { ignores: ['.next/**', 'next-env.d.ts', '*.config.*'] }];
