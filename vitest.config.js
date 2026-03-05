import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'apps/sam/app.js',
        'apps/daf/DAF.js',
        'apps/cross/cross.js',
        'shared/js/main.js',
        'analizator/app.js',
        'apps/ihk/text.js'
      ]
    }
  }
});
