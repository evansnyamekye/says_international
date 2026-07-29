const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('http://localhost:5502/index.html', { waitUntil: 'networkidle' });

  // Fill the homepage assessment search form
  await page.selectOption('select[name="level"]', 'lower primary');
  await page.fill('input[name="course-keywords"]', 'Math');
  await page.selectOption('select[name="instructor"]', 'Abigail Adu');
  await page.selectOption('select[name="term"]', '1st term');
  await page.selectOption('select[name="campus"]', 'Emmanuel Block');

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click('.gdlr-core-course-form input[type="submit"]')
  ]);

  console.log('landed on:', page.url());
  console.log('page errors:', errors);

  const requiredHtml = await page.locator('#says-required-subjects').innerHTML();
  console.log('required subjects has content:', requiredHtml.trim().length > 0);
  console.log('mentions Mathematics:', requiredHtml.includes('Mathematics'));
  console.log('mentions Pass Mark: 70%:', requiredHtml.includes('Pass Mark: 70%'));

  const summary = await page.locator('#says-course-search-summary').textContent().catch(() => null);
  console.log('summary message:', summary);

  // Now test a no-match search
  await page.goto('http://localhost:5502/assessment-info.html?level=jhs&instructor=Nobody', { waitUntil: 'networkidle' });
  const emptyStateHidden = await page.locator('#says-no-subject-results').getAttribute('hidden');
  console.log('no-match: empty state hidden attr (should be null/absent):', emptyStateHidden);

  await browser.close();
})();
