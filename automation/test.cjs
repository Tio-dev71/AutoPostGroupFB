const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER_ERROR:', error.message));

  try {
    const response = await page.goto('http://localhost:1420', { timeout: 10000 });
    console.log('STATUS:', response.status());
    await page.waitForTimeout(5000);
    const title = await page.title();
    console.log('TITLE:', title);

    // Take screenshot
    await page.screenshot({ path: 'screenshot.png' });

    // Extract HTML
    const html = await page.content();
    fs.writeFileSync('page.html', html);

    console.log('Successfully captured page');
  } catch (err) {
    console.error('Error loading page:', err);
  } finally {
    await browser.close();
  }
})();
