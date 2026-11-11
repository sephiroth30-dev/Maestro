import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // El código fuente importa con extensión `.js` (obligatoria en ESM) pero los
  // archivos son `.ts`: sin este mapeo, cualquier prueba que importe un módulo de
  // `src/` que a su vez importe otro falla al resolver. Solo toca rutas RELATIVAS
  // que terminan exactamente en `.js`, así que no afecta a `node_modules`
  // (p. ej. `./v3/external.cjs` de zod).
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'CommonJS',
          moduleResolution: 'Node',
          target: 'ES2022',
          strict: true,
          esModuleInterop: true,
        },
      },
    ],
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  clearMocks: true,
  resetMocks: true,
};

export default config;
