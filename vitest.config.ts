import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    testTimeout: 10000,
    env: {
      REQUESTY_API_KEY: '',
      REQUESTY_BASE_URL: '',
      REQUESTY_DEFAULT_MODEL: '',
      REQUESTY_FAST_MODEL: '',
      REQUESTY_STANDARD_MODEL: '',
      REQUESTY_DEEP_MODEL: '',
      REQUESTY_VISION_MODEL: '',
      OPENAI_API_KEY: '',
      ANTHROPIC_API_KEY: '',
      GOOGLE_GENERATIVE_AI_API_KEY: '',
      GROQ_API_KEY: '',
      CEREBRAS_API_KEY: '',
      OPENROUTER_API_KEY: '',
      MISTRAL_API_KEY: '',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/app/**', 'src/**/*.d.ts'],
      thresholds: {
        statements: 80,
        functions: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
