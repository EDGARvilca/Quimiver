import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas de punta a punta: compilan el sitio como en GitHub Pages (/Quimiver) y lo abren
 * en Chromium. Las llamadas a Supabase y WhatsApp se simulan; nunca tocan producción.
 */
const PORT = 4330;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/Quimiver/`,
    trace: 'retain-on-failure',
    // En la nube de desarrollo el navegador ya está instalado en otra ruta.
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    { name: 'movil', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run build && npx astro preview --port ${PORT} --ignore-lock`,
    url: `http://localhost:${PORT}/Quimiver/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { BASE_PATH: '/Quimiver', SITE_URL: 'https://edgarvilca.github.io' },
  },
});
