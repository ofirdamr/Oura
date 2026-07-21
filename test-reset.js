const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);

  // Step 1: forgot-password page
  await page.goto('https://oura-web.oura-events.workers.dev/forgot-password');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '/tmp/step1-forgot-password.png', fullPage: true });
  console.log('Step 1: forgot-password page loaded');

  // Step 2: reset-password page with token (confirm gate)
  const resetUrl = 'https://oura-web.oura-events.workers.dev/reset-password?token_hash=f8c4b4603c1b9196973ea4a491896347ec2564cec9470a9a46a001f6&type=recovery';
  await page.goto(resetUrl);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '/tmp/step2-confirm-gate.png', fullPage: true });
  console.log('Step 2: confirm gate shown');

  // Step 3: click the confirm button
  await page.click('button:has-text("המשך לאיפוס הסיסמה")');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/step3-after-confirm.png', fullPage: true });
  console.log('Step 3: after confirm click');

  // Step 4: fill new password
  const pwdFields = await page.$$('input[type="password"]');
  if (pwdFields.length >= 2) {
    await pwdFields[0].fill('NewPass456!');
    await pwdFields[1].fill('NewPass456!');
    await page.screenshot({ path: '/tmp/step4-filled-password.png', fullPage: true });
    console.log('Step 4: password fields filled');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/step5-after-submit.png', fullPage: true });
    console.log('Step 5: after submit');
  } else {
    console.log('ERROR: password fields not found, count=', pwdFields.length);
  }

  await browser.close();
})();
