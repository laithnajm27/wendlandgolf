import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { siteMap } from './site-map';

test('all pages in the site map load and every internal link returns HTTP 200', async ({ page, request, baseURL }) => {
  if (!baseURL) throw new Error('A baseURL is required for the site-map crawl.');
  const internalLinks = new Set<string>();

  for (const route of siteMap) {
    const url = new URL(route, baseURL);
    const response = await request.get(url.toString());
    expect(response.status(), `${url.pathname} must respond successfully`).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');

    await page.goto(url.toString(), { waitUntil: 'networkidle' });
    await expect(page.locator('h1')).toBeVisible();
    await expect(page).toHaveTitle(/\S/);

    const links = await page.locator('a[href]').evaluateAll(anchors =>
      anchors.map(anchor => (anchor as HTMLAnchorElement).href)
    );
    for (const href of links) {
      const link = new URL(href);
      if (link.origin !== new URL(baseURL).origin) continue;
      link.hash = '';
      internalLinks.add(link.toString());
    }
  }

  for (const href of internalLinks) {
    const response = await request.get(href);
    expect(response.status(), `Internal link must not be broken: ${href}`).toBe(200);
  }
});

test('Golfplatz-Seite zeigt nur die nicht entfernten Bilder', async ({ page }) => {
  await page.goto('/golfplatz.html', { waitUntil: 'networkidle' });
  const imageNames = await page.locator('#place-gallery img').evaluateAll(images =>
    images.map(image => (image as HTMLImageElement).dataset.mediaOriginal?.split('/').pop())
  );
  expect(imageNames).toEqual([
    '22-DJI_20260912174423_0003_D.png',
    '19-10.png',
    '9-_DSC4656.jpg',
    '4-_DSC4631.jpg'
  ]);
});

test('Oliver-Galerie bleibt im Training und ist nicht auf der Über-mich-Seite', async ({ page }) => {
  await page.goto('/training.html', { waitUntil: 'networkidle' });
  const imageNames = await page.locator('#trainer-gallery img').evaluateAll(images =>
    images.map(image => (image as HTMLImageElement).dataset.mediaOriginal?.split('/').pop())
  );
  expect(imageNames).toEqual(['28-DSC00115.jpg', '29-DSC00124.jpg']);

  await page.goto('/ueber-mich.html', { waitUntil: 'networkidle' });
  await expect(page.locator('#trainer-gallery')).toHaveCount(0);
});

test('Golfplatz-Bilder lassen sich vergrößern und mit Escape schließen', async ({ page }) => {
  await page.goto('/golfplatz.html', { waitUntil: 'networkidle' });
  const cookieReject = page.locator('#cookie-reject');
  if (await cookieReject.isVisible()) await cookieReject.click();

  await page.getByRole('button', { name: 'Bild vergrößern: Golfplatzlandschaft bei Lemgow' }).click();
  const dialog = page.locator('#place-image-lightbox');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('img')).toHaveAttribute('src', /22-DJI_20260912174423_0003_D\.png/);
  await expect(dialog.locator('img')).toHaveAttribute('alt', 'Golfplatzlandschaft bei Lemgow');

  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('Golfplatz-Galerie ist ein zentriertes 2x2-Quadrat', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/golfplatz.html', { waitUntil: 'networkidle' });
  const layout = await page.locator('#place-gallery').evaluate(gallery => {
    const galleryRect = gallery.getBoundingClientRect();
    const items = Array.from(gallery.querySelectorAll('.gallery-item'), item => {
      const rect = item.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    return {
      centered: Math.abs((galleryRect.left + galleryRect.right) / 2 - document.documentElement.clientWidth / 2) < 1,
      items
    };
  });

  expect(layout.centered).toBe(true);
  expect(layout.items).toHaveLength(4);
  for (const item of layout.items) expect(Math.abs(item.width - item.height)).toBeLessThan(1);
  expect(Math.abs(layout.items[0].y - layout.items[1].y)).toBeLessThan(1);
  expect(Math.abs(layout.items[2].y - layout.items[3].y)).toBeLessThan(1);
  expect(layout.items[2].y).toBeGreaterThan(layout.items[0].y);
  expect(Math.abs(layout.items[0].x - layout.items[2].x)).toBeLessThan(1);
  expect(Math.abs(layout.items[1].x - layout.items[3].x)).toBeLessThan(1);
});

test('all pages meet the WCAG 2.1 A/AA accessibility rules', async ({ page, baseURL }) => {
  if (!baseURL) throw new Error('A baseURL is required for accessibility checks.');

  for (const route of siteMap) {
    await page.goto(new URL(route, baseURL).toString(), { waitUntil: 'networkidle' });
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const violations = results.violations.map(({ id, impact, description, nodes }) => ({
      id,
      impact,
      description,
      elements: nodes.map(node => node.target)
    }));
    expect(violations, `Accessibility violations on ${route}`).toEqual([]);
  }
});

test('contact form validates required data and submits the expected fields', async ({ page }) => {
  await page.goto('/kontakt.html');
  const cookieReject = page.locator('#cookie-reject');
  if (await cookieReject.isVisible()) await cookieReject.click();
  const form = page.locator('#contact-form');

  await form.getByRole('button', { name: /nachricht senden/i }).click();
  await expect(page.locator('#name')).toHaveJSProperty('validity.valid', false);

  await page.locator('#name').fill('E2E Testperson');
  await page.locator('#email').fill('not-an-email');
  await page.locator('#message').fill('Automatisierter Formular-Integrationstest.');
  await expect(page.locator('#email')).toHaveJSProperty('validity.valid', false);
  await page.locator('#email').fill('e2e@example.invalid');
  await page.locator('#package').selectOption({ label: 'Gruppentraining' });

  let submittedFields: URLSearchParams | undefined;
  await page.route('https://formspree.io/f/mkjjldbw', async route => {
    const request = route.request();
    if (request.method() !== 'POST') {
      await route.continue();
      return;
    }
    expect(request.headers()['accept']).toContain('application/json');
    submittedFields = new URLSearchParams(request.postData() ?? '');
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ next: 'https://formspree.io/thanks' })
    });
  });

  await form.getByRole('button', { name: /nachricht senden/i }).click();
  await expect(page.locator('#form-status')).toContainText('Vielen Dank');
  expect(submittedFields?.get('_subject')).toBe('Neue Anfrage über die Website');
  expect(submittedFields?.get('_gotcha')).toBe('');
  expect(submittedFields?.get('name')).toBe('E2E Testperson');
  expect(submittedFields?.get('email')).toBe('e2e@example.invalid');
  expect(submittedFields?.get('package')).toBe('Gruppentraining');
  expect(submittedFields?.get('message')).toContain('Integrationstest');
});

test('contact form shows Formspree errors and allows a retry', async ({ page }) => {
  await page.goto('/kontakt.html');
  const cookieReject = page.locator('#cookie-reject');
  if (await cookieReject.isVisible()) await cookieReject.click();
  await page.locator('#name').fill('E2E Testperson');
  await page.locator('#email').fill('e2e@example.invalid');
  await page.locator('#message').fill('Anfrage zur Fehlerbehandlung.');

  await page.route('https://formspree.io/f/mkjjldbw', route =>
    route.fulfill({
      status: 422,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ errors: [{ message: 'Testfehler von Formspree.' }] })
    })
  );
  await page.locator('#contact-form button[type="submit"]').click();

  await expect(page.locator('#form-status')).toContainText('Testfehler von Formspree.');
  await expect(page.locator('#contact-form button[type="submit"]')).toBeEnabled();
  await expect(page.locator('#name')).toHaveValue('E2E Testperson');
});

test('mobile navigation, contact controls and consent banner fit a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  const menuToggle = page.locator('.menu-toggle');
  await menuToggle.click();
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible();
  const navLinkHeights = await page.locator('.main-nav a').evaluateAll(links =>
    links.map(link => link.getBoundingClientRect().height)
  );
  expect(navLinkHeights.every(height => height >= 44)).toBe(true);

  const banner = page.locator('#cookie-banner');
  if (await banner.isVisible()) {
    const overlaps = await page.evaluate(() => {
      const bannerRect = document.querySelector('#cookie-banner')!.getBoundingClientRect();
      const buttonRect = document.querySelector('#whatsapp-float')!.getBoundingClientRect();
      return bannerRect.left < buttonRect.right &&
        bannerRect.right > buttonRect.left &&
        bannerRect.top < buttonRect.bottom &&
        bannerRect.bottom > buttonRect.top;
    });
    expect(overlaps, 'WhatsApp button should not overlap the consent banner').toBe(false);
    await page.locator('#cookie-reject').click();
  }

  await page.goto('/kontakt.html');
  const formControlFonts = await page.locator('.contact-form input:not([type=hidden]), .contact-form select, .contact-form textarea')
    .evaluateAll(controls => controls.map(control => Number.parseFloat(getComputedStyle(control).fontSize)));
  expect(formControlFonts.every(size => size >= 16), 'Mobile form controls should avoid iOS zoom').toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth));
});

test('external map content only loads after the visitor grants consent', async ({ page }) => {
  await page.route('https://www.google.com/**', route => route.abort());
  await page.goto('/golfplatz.html');
  await page.locator('#cookie-reject').click();
  await page.locator('#load-map').click();
  await expect(page.locator('#consent-dialog')).toBeVisible();
  await expect(page.locator('#map-box iframe')).toHaveCount(0);

  await page.locator('#consent-external').check();
  await page.locator('#consent-save').click();
  await expect(page.locator('#map-box iframe')).toHaveAttribute('src', /google\.com\/maps/);
});

test('Core Web Vitals stay within good thresholds on the live home page', async ({ page }) => {
  await page.addInitScript(() => {
    const metrics = { lcp: 0, cls: 0, inp: null as number | null };
    (window as Window & { __e2eVitals?: typeof metrics }).__e2eVitals = metrics;
    const supported = PerformanceObserver.supportedEntryTypes;

    if (supported.includes('largest-contentful-paint')) {
      new PerformanceObserver(entries => {
        const latest = entries.getEntries().at(-1);
        if (latest) metrics.lcp = latest.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    }
    if (supported.includes('layout-shift')) {
      new PerformanceObserver(entries => {
        for (const entry of entries.getEntries()) {
          const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (!shift.hadRecentInput) metrics.cls += shift.value ?? 0;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    }
    if (supported.includes('event')) {
      new PerformanceObserver(entries => {
        for (const entry of entries.getEntries()) {
          const interaction = entry as PerformanceEntry & { interactionId?: number };
          if (interaction.interactionId) metrics.inp = Math.max(metrics.inp ?? 0, entry.duration);
        }
      }).observe({
        type: 'event',
        buffered: true,
        durationThreshold: 16
      } as PerformanceObserverInit & { durationThreshold: number });
    }
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('h1')).toBeVisible();
  await page.waitForTimeout(500);
  await page.locator('#cookie-customize').click();
  await page.locator('#consent-close').click();
  await page.waitForTimeout(250);

  const metrics = await page.evaluate(() =>
    (window as Window & { __e2eVitals?: { lcp: number; cls: number; inp: number | null } }).__e2eVitals
  );
  expect(metrics, 'Performance observers should be available').toBeDefined();
  expect(metrics!.lcp, 'LCP should be recorded and below 2.5 seconds').toBeGreaterThan(0);
  expect(metrics!.lcp).toBeLessThanOrEqual(2500);
  expect(metrics!.cls, 'CLS should be at most 0.1').toBeLessThanOrEqual(0.1);
  if (metrics!.inp !== null) expect(metrics!.inp, 'INP should be at most 200 ms').toBeLessThanOrEqual(200);
});
