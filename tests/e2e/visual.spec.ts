import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { devices, expect, test } from '@playwright/test';
import { visualRoutes } from './site-map';

const viewports = [
  { name: 'small-mobile-320', width: 320, height: 740 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'laptop-1366', width: 1366, height: 768 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'ultrawide-2560', width: 2560, height: 1080 },
  { name: 'iphone-15', ...devices['iPhone 15'] },
  { name: 'pixel-7', ...devices['Pixel 7'] },
  { name: 'ipad-pro-11', ...devices['iPad Pro 11'] }
];

test('all pages render without clipping, overlap or broken images at common screen sizes', async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(10 * 60 * 1000);
  if (!baseURL) throw new Error('A baseURL is required for visual checks.');
  const screenshotsDir = path.resolve('test-results', 'screenshots');
  await mkdir(screenshotsDir, { recursive: true });

  for (const viewport of viewports) {
    const deviceContext = 'isMobile' in viewport && viewport.isMobile;
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 'deviceScaleFactor' in viewport ? viewport.deviceScaleFactor : 1,
      ...(deviceContext && browser.browserType().name() !== 'firefox'
        ? { isMobile: true, hasTouch: true }
        : {})
    });

    try {
      const page = await context.newPage();
      for (const route of visualRoutes) {
        await page.goto(new URL(route.path, baseURL).toString(), { waitUntil: 'networkidle' });
        const bannerReject = page.locator('#cookie-reject');
        if (await bannerReject.isVisible()) await bannerReject.click();

        await page.locator('img').evaluateAll(images => {
          for (const image of images) (image as HTMLImageElement).loading = 'eager';
        });
        await page.waitForFunction(
          () => Array.from(document.images).every(image => image.complete),
          undefined,
          { timeout: 30_000 }
        );

        const layout = await page.evaluate(() => {
          const heroText = document.querySelector('.hero-content, .page-hero-inner');
          const heroImage = document.querySelector('.hero-visual img, .page-hero-visual img');
          const homeTitle = document.querySelector('#hero-title-first');
          let homeTitleLines: number | null = null;
          if (homeTitle) {
            const titleRange = document.createRange();
            titleRange.selectNodeContents(homeTitle);
            homeTitleLines = titleRange.getClientRects().length;
          }
          const footer = document.querySelector('.site-footer');
          const previousSection = footer?.previousElementSibling;
          const heroImageStyle = heroImage ? getComputedStyle(heroImage) : undefined;
          const heroVisual = heroImage?.closest('.hero-visual, .page-hero-visual');
          const heroVisualStyle = heroVisual ? getComputedStyle(heroVisual) : undefined;
          const heroTextStyle = heroText ? getComputedStyle(heroText) : undefined;
          const expectedHeroFit = window.innerWidth > 900 ? 'cover' : 'contain';
          const heroImageBehindText = Boolean(
            heroImage && heroText &&
            heroVisualStyle?.position === 'absolute' &&
            heroImageStyle?.objectFit === expectedHeroFit &&
            Number(heroTextStyle?.zIndex) > Number(heroVisualStyle?.zIndex)
          );
          const brokenImages = Array.from(document.images)
            .filter(image => image.naturalWidth === 0)
            .map(image => image.currentSrc || image.src);
          const distortedImages = Array.from(document.images)
            .filter(image => image !== heroImage && image.naturalWidth > 0)
            .filter(image => {
              const style = getComputedStyle(image);
              return style.objectFit !== 'contain';
            })
            .map(image => image.currentSrc || image.src);

          return {
            viewportWidth: window.innerWidth,
            documentWidth: document.documentElement.scrollWidth,
            homeTitleLines,
            heroImageBehindText,
            brokenImages,
            distortedImages,
            galleryImages: document.querySelectorAll('#place-gallery img, #trainer-gallery img').length,
            footerOverlapsPreviousSection: Boolean(
              footer && previousSection &&
              previousSection.getBoundingClientRect().bottom > footer.getBoundingClientRect().top + 1
            )
          };
        });

        expect(layout.documentWidth, `Horizontal overflow on ${route.path} at ${viewport.name}`).toBeLessThanOrEqual(layout.viewportWidth);
        if (route.path === '/' && viewport.width <= 390) {
          expect(layout.homeTitleLines, `Home hero title should not split on ${viewport.name}`).toBe(1);
        }
        if (route.path === '/' || route.path === '/training.html' || route.path === '/golfplatz.html') {
          expect(layout.heroImageBehindText, `Hero image should sit behind the text on ${route.path} at ${viewport.name}`).toBe(true);
        }
        expect(layout.brokenImages, `Broken images on ${route.path} at ${viewport.name}`).toEqual([]);
        expect(layout.distortedImages, `Cropped or stretched images on ${route.path} at ${viewport.name}`).toEqual([]);
        expect(layout.footerOverlapsPreviousSection, `Footer overlaps content on ${route.path} at ${viewport.name}`).toBe(false);

        if (route.path === '/golfplatz.html' || route.path === '/training.html') {
          expect(layout.galleryImages, `Expected gallery images on ${route.path}`).toBeGreaterThan(0);
        }

        const screenshotName = `${route.name}-${viewport.name}.png`;
        const referencePath = testInfo.snapshotPath(screenshotName);
        if (existsSync(referencePath) || process.env.E2E_UPDATE_SNAPSHOTS === '1') {
          await expect(page).toHaveScreenshot(screenshotName, {
            fullPage: true,
            animations: 'disabled',
            maxDiffPixelRatio: 0.02
          });
        }

        const screenshot = await page.screenshot({ fullPage: true, animations: 'disabled' });
        await writeFile(path.join(screenshotsDir, `${testInfo.project.name}-${screenshotName}`), screenshot);
        expect(screenshot.byteLength, `Screenshot should not be empty for ${route.path}`).toBeGreaterThan(10_000);
      }
    } finally {
      await context.close();
    }
  }
});
