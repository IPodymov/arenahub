import base from '@arenahub/eslint-config/base';

export default [
  ...base,
  {
    // Nest DI читает типы параметров конструктора из emitDecoratorMetadata:
    // `import type` у инжектируемого класса ломает внедрение зависимостей.
    rules: { '@typescript-eslint/consistent-type-imports': 'off' },
  },
];
