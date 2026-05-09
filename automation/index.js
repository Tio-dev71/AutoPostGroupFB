const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const os = require('os');
const path = require('path');
const fs = require('fs');
const { execFileSync, spawn } = require('child_process');
chromium.use(stealth);

// ═══════════════════════════════════════════════════════════════════
// IPC Helpers — communicate with Tauri frontend via JSON on stdout
// ═══════════════════════════════════════════════════════════════════
function sendResponse(data) {
  console.log(JSON.stringify({ type: 'IPC_RESPONSE', ...data }));
}

function sendLog(level, message) {
  console.log(JSON.stringify({ type: 'IPC_LOG', level, message, ts: Date.now() }));
}

function sendProgress(index, total, groupName) {
  console.log(JSON.stringify({ type: 'IPC_PROGRESS', index, total, groupName, ts: Date.now() }));
}

function sendResult(result) {
  console.log(JSON.stringify({ type: 'IPC_RESULT', ...result, ts: Date.now() }));
}

// ═══════════════════════════════════════════════════════════════════
// Chrome path auto-detection
// ═══════════════════════════════════════════════════════════════════
function findChromePath() {
  const platform = os.platform();

  if (platform === 'darwin') {
    const paths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
  } else if (platform === 'win32') {
    const paths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
  } else {
    const paths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════
// Persistent Chrome profile directory (NOT /tmp — survives restarts)
// ═══════════════════════════════════════════════════════════════════
function getDefaultProfileDir() {
  const dir = path.join(os.homedir(), '.autopost', 'chrome-profile');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// ═══════════════════════════════════════════════════════════════════
// Human-like helpers
// ═══════════════════════════════════════════════════════════════════
function randomDelay(minMs, maxMs) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((r) => setTimeout(r, delay));
}

async function humanType(page, selector, text) {
  await page.click(selector);
  await randomDelay(200, 500);
  for (const char of text) {
    await page.keyboard.type(char, { delay: Math.floor(Math.random() * 120) + 30 });
  }
}

async function humanScroll(page) {
  const scrollY = Math.floor(Math.random() * 400) + 100;
  await page.mouse.wheel(0, scrollY);
  await randomDelay(300, 800);
}

// Build launch options with auto-detected Chrome
function buildLaunchOptions(customChromePath) {
  const chromePath = customChromePath || findChromePath();
  const options = {
    headless: false,
    viewport: { width: 1280, height: 800 },
    locale: 'vi-VN',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  };
  if (chromePath) {
    options.executablePath = chromePath;
  } else {
    // Fallback: use channel (requires playwright to have downloaded browser)
    options.channel = 'chrome';
  }
  return options;
}

function isProfileLockError(err) {
  const msg = String(err?.message || err || '');
  return msg.includes('ProcessSingleton') || msg.includes('profile is already in use');
}

function cleanupChromeSingletonFiles(profileDir) {
  const names = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
  for (const name of names) {
    const target = path.join(profileDir, name);
    try {
      if (fs.existsSync(target) || fs.lstatSync(target).isSymbolicLink()) {
        fs.rmSync(target, { force: true, recursive: true });
        sendLog('info', `Đã dọn Chrome lock file: ${name}`);
      }
    } catch (_) {
      // Ignore missing or permission errors; launch retry will report the real issue.
    }
  }
}

function getRecoveryProfileDir() {
  const dir = path.join(os.homedir(), '.autopost', 'chrome-profile-recovery');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function launchPersistentContextSafe(profileDir, launchOpts, allowRecovery = false) {
  try {
    return {
      context: await chromium.launchPersistentContext(profileDir, launchOpts),
      profileDir,
      usedRecovery: false,
    };
  } catch (err) {
    if (!isProfileLockError(err)) throw err;

    sendLog('warning', 'Chrome profile đang bị khóa, thử dọn lock file và mở lại...');
    cleanupChromeSingletonFiles(profileDir);

    try {
      return {
        context: await chromium.launchPersistentContext(profileDir, launchOpts),
        profileDir,
        usedRecovery: false,
      };
    } catch (retryErr) {
      if (!isProfileLockError(retryErr) || !allowRecovery) throw retryErr;

      const recoveryDir = getRecoveryProfileDir();
      sendLog('warning', `Profile chính vẫn bị khóa, dùng profile dự phòng: ${recoveryDir}`);
      return {
        context: await chromium.launchPersistentContext(recoveryDir, launchOpts),
        profileDir: recoveryDir,
        usedRecovery: true,
      };
    }
  }
}

async function clickFirstVisible(locator, timeout = 15000) {
  const count = await locator.count().catch(() => 0);
  for (let i = 0; i < count; i++) {
    const item = locator.nth(i);
    if (await item.isVisible().catch(() => false)) {
      await item.click({ timeout, force: true });
      return true;
    }
  }
  return false;
}

async function openCreatePostDialog(page) {
  sendLog('info', 'Tìm nút tạo bài viết...');

  const selectors = [
    '[role="button"]:has-text("Bạn viết gì đi")',
    '[role="button"]:has-text("Viết gì đó")',
    '[role="button"]:has-text("Tạo bài viết")',
    '[role="button"]:has-text("Write something")',
    '[role="button"]:has-text("Create a post")',
    '[aria-label="Tạo bài viết"]',
    '[aria-label="Create a post"]',
  ];

  for (const selector of selectors) {
    const clicked = await clickFirstVisible(page.locator(selector), 8000).catch(() => false);
    if (clicked) {
      await page.waitForSelector('[role="dialog"]', { timeout: 15000 }).catch(() => {});
      await randomDelay(1000, 1800);
      return;
    }
  }

  throw new Error('Không tìm thấy nút tạo bài viết');
}

async function fillFacebookComposer(page, text) {
  sendLog('info', 'Đang nhập nội dung...');

  const dialog = page.locator('[role="dialog"]').last();
  const textboxCandidates = [
    '[role="textbox"][contenteditable="true"][aria-label*="Bạn viết gì đi"]',
    '[role="textbox"][contenteditable="true"][aria-label*="Write something"]',
    '[role="textbox"][contenteditable="true"][aria-label*="Viết gì đó"]',
    '[contenteditable="true"][data-lexical-editor="true"]',
    '[role="textbox"][contenteditable="true"]',
  ];

  let textbox = null;
  for (const selector of textboxCandidates) {
    const candidate = dialog.locator(selector).first();
    if (await candidate.isVisible().catch(() => false)) {
      textbox = candidate;
      break;
    }
  }

  if (!textbox) {
    throw new Error('Không tìm thấy ô nhập nội dung bài viết trong popup');
  }

  await textbox.waitFor({ state: 'visible', timeout: 15000 });
  await textbox.scrollIntoViewIfNeeded().catch(() => {});

  try {
    await textbox.click({ timeout: 7000, force: true });
    await randomDelay(200, 500);
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => {});
    await page.keyboard.press('Backspace').catch(() => {});
    await randomDelay(120, 280);
    await page.keyboard.type(text, { delay: 20 });
    return;
  } catch (_) {
    // Continue to DOM fallback.
  }

  const handle = await textbox.elementHandle();
  if (!handle) throw new Error('Không lấy được ô nhập nội dung');

  await page.evaluate((el, value) => {
    el.focus();
    el.textContent = '';
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    el.textContent = value;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, handle, text);

  await randomDelay(500, 900);
}

async function pasteTextToComposerFromClipboard(page, text) {
  if (!text || !text.trim()) return false;
  if (process.platform !== 'darwin') {
    throw new Error('Clipboard text paste native hiện chỉ hỗ trợ macOS');
  }

  sendLog('warning', 'Thử fallback native: copy nội dung vào clipboard macOS rồi paste vào composer...');

  execFileSync('osascript', [
    '-e',
    `set the clipboard to ${JSON.stringify(text)}`,
  ], { stdio: 'ignore' });

  const textbox = page.locator('[role="dialog"] [role="textbox"][contenteditable="true"], [role="dialog"] [contenteditable="true"]').first();
  await textbox.click({ timeout: 7000, force: true });
  await randomDelay(300, 700);
  await page.keyboard.press('Meta+V');
  await randomDelay(800, 1400);
  sendLog('success', 'Đã dán nội dung vào composer bằng clipboard native macOS');
  return true;
}

async function hasComposerText(page, expected, timeout = 2500) {
  if (!expected || !expected.trim()) return true;
  return await page.waitForFunction((value) => {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
    const dialog = dialogs[dialogs.length - 1];
    if (!dialog) return false;

    const editableText = Array.from(dialog.querySelectorAll('[contenteditable="true"], [role="textbox"]'))
      .map((el) => el.textContent || '')
      .join('\n');

    return editableText.includes(value.trim());
  }, expected, { timeout }).then(() => true).catch(() => false);
}

async function hasComposerAttachmentPreview(page, timeout = 3000) {
  return await page.waitForFunction(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return false;

    // Do NOT count generic fbcdn images because Facebook avatars/icons also use fbcdn.
    // Do NOT count input[type=file] because it only means the upload UI exists.
    // A newly selected local image normally appears as blob:/data: while uploading.
    const localMedia = dialog.querySelectorAll('img[src^="blob:"], img[src^="data:"], video[src^="blob:"], video[src^="data:"], [style*="blob:"], [style*="data:"]');
    const progress = dialog.querySelectorAll('[role="progressbar"], [aria-valuenow]');

    return localMedia.length > 0 || progress.length > 0;
  }, { timeout }).then(() => true).catch(() => false);
}

async function pasteImageToComposerFromClipboard(page, imagePath) {
  if (!/^image\//.test(getMimeType(imagePath))) {
    throw new Error('Clipboard paste fallback chỉ hỗ trợ file ảnh');
  }

  if (process.platform !== 'darwin') {
    throw new Error('Clipboard paste native hiện chỉ hỗ trợ macOS');
  }

  sendLog('warning', 'Thử fallback native: copy ảnh vào clipboard macOS rồi paste vào composer...');

  const absPath = path.resolve(imagePath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`Không tìm thấy file ảnh để paste: ${absPath}`);
  }

  // Native clipboard write via AppleScript (reliable even when FB filechooser DOM is unstable)
  execFileSync('osascript', [
    '-e',
    `set the clipboard to (read (POSIX file "${absPath.replace(/"/g, '\\"')}") as JPEG picture)`,
  ], { stdio: 'ignore' });

  const textbox = page.locator('[role="dialog"] [role="textbox"][contenteditable="true"], [role="dialog"] [contenteditable="true"]').first();
  await textbox.click({ timeout: 7000, force: true });
  await randomDelay(300, 700);
  await page.keyboard.press('Meta+V');
  await randomDelay(3000, 5000);
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.mov') return 'video/quicktime';
  return 'image/png';
}

async function uploadMediaToComposer(page, mediaFiles = []) {
  const files = (Array.isArray(mediaFiles) ? mediaFiles : [mediaFiles]).filter(Boolean);
  if (files.length === 0) return;

  const existingFiles = files.filter((file) => fs.existsSync(file));
  const missingFiles = files.filter((file) => !fs.existsSync(file));
  if (missingFiles.length > 0) {
    sendLog('warning', `Bỏ qua file không tồn tại: ${missingFiles.join(', ')}`);
  }
  if (existingFiles.length === 0) {
    throw new Error('Không có file ảnh/video hợp lệ để upload');
  }

  sendLog('info', `Đang upload ${existingFiles.length} ảnh/video...`);

  const firstImage = existingFiles.find((file) => /^image\//.test(getMimeType(file)));
  if (firstImage && process.platform === 'darwin') {
    try {
      await pasteImageToComposerFromClipboard(page, firstImage);
      const hasPreview = await hasComposerAttachmentPreview(page, 25000);
      if (!hasPreview) {
        throw new Error('Đã paste ảnh nhưng Facebook chưa hiển thị preview ảnh/video');
      }
      sendLog('success', 'Đã dán ảnh vào composer bằng clipboard native macOS');
      await randomDelay(4000, 7000);
      return;
    } catch (err) {
      sendLog('warning', `Fallback native ảnh lỗi (${err.message}), mới thử DOM upload.`);
    }
  }

  // Facebook sometimes creates the file input only after clicking Photo/Video.
  const attachButtons = [
    '[role="dialog"] [aria-label="Ảnh/video"]',
    '[role="dialog"] [aria-label="Photo/video"]',
    '[role="dialog"] [aria-label="Photo/Video"]',
    '[role="dialog"] [role="button"]:has-text("Ảnh/video")',
    '[role="dialog"] [role="button"]:has-text("Photo/video")',
    '[role="dialog"] [role="button"]:has-text("Photo/Video")',
  ];

  let uploaded = false;
  let lastError = null;

  // Current Facebook composer usually needs 2 steps:
  // 1) click the Photo/Video icon in the post dialog to reveal the upload panel
  // 2) click the "Kéo thả hoặc click để upload" dropzone to open file chooser
  const tryUploadFromOpenPanel = async (sourceLabel) => {
    await randomDelay(800, 1400);

    const dialog = page.locator('[role="dialog"]').last();
    const dropzone = dialog
      .locator('text=/Kéo thả|click để upload|Drag.*drop|Add photos|Upload|Thêm ảnh|Add Photos/i')
      .first();

    if (!(await dropzone.isVisible().catch(() => false))) {
      lastError = new Error(`Không thấy vùng upload ảnh trong popup bài viết sau khi bấm ${sourceLabel}`);
      return false;
    }

    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 10000 });
    await dropzone.click({ timeout: 5000, force: true });
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(existingFiles);
    uploaded = true;
    sendLog('success', `Đã chọn ảnh/video qua vùng upload của bài viết (${sourceLabel})`);
    return true;
  };

  for (const selector of attachButtons) {
    const button = page.locator(selector).first();
    if (!(await button.isVisible().catch(() => false))) continue;

    try {
      await button.click({ timeout: 5000, force: true });
      if (await tryUploadFromOpenPanel(selector)) break;
    } catch (err) {
      lastError = err;
      sendLog('warning', `Không upload được qua nút ${selector}, thử cách khác...`);
    }
  }

  // Fallback for Facebook variants where the green Photo/Video icon has no useful
  // aria-label/text. Click the first action icon inside the "Thêm vào bài viết" row.
  if (!uploaded) {
    try {
      const clicked = await page.evaluate(() => {
        const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
        const dialog = dialogs[dialogs.length - 1];
        if (!dialog) return false;

        const elements = Array.from(dialog.querySelectorAll('div, span'));
        const addRowLabel = elements.find((el) => /Thêm vào bài viết của bạn|Add to your post/i.test(el.textContent || ''));
        if (!addRowLabel) return false;

        const labelRect = addRowLabel.getBoundingClientRect();
        const dialogRect = dialog.getBoundingClientRect();
        const clickable = Array.from(dialog.querySelectorAll('[role="button"], div[tabindex="0"], span[tabindex="0"]'))
          .map((el) => ({ el, rect: el.getBoundingClientRect(), text: el.textContent || '', aria: el.getAttribute('aria-label') || '' }))
          .filter(({ rect, text, aria }) => {
            const sameRow = Math.abs((rect.top + rect.bottom) / 2 - (labelRect.top + labelRect.bottom) / 2) < 45;
            const rightOfLabel = rect.left > labelRect.left + 180;
            const insideDialog = rect.left >= dialogRect.left && rect.right <= dialogRect.right && rect.top >= dialogRect.top && rect.bottom <= dialogRect.bottom;
            const notPost = !/Đăng|Post/i.test(text + aria);
            return sameRow && rightOfLabel && insideDialog && notPost && rect.width >= 20 && rect.height >= 20;
          })
          .sort((a, b) => a.rect.left - b.rect.left);

        if (clickable.length === 0) return false;
        clickable[0].el.click();
        return true;
      });

      if (clicked) {
        sendLog('info', 'Đã bấm icon Ảnh/Video bằng vị trí trong hàng Thêm vào bài viết');
        await tryUploadFromOpenPanel('icon xanh theo vị trí');
      } else {
        lastError = new Error('Không tìm thấy icon Ảnh/Video trong hàng Thêm vào bài viết');
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (!uploaded) {
    try {
      const dialog = page.locator('[role="dialog"]').last();
      const dialogFileInputs = dialog.locator('input[type="file"]');
      const inputCount = await dialogFileInputs.count().catch(() => 0);

      for (let i = 0; i < inputCount; i++) {
        const input = dialogFileInputs.nth(i);
        const accept = (await input.getAttribute('accept').catch(() => '')) || '';
        const looksLikeMediaInput = !accept || /image|video|media|\*/i.test(accept);
        if (!looksLikeMediaInput) continue;

        try {
          await input.setInputFiles(existingFiles);
          uploaded = true;
          sendLog('success', 'Đã chọn ảnh/video qua input file nằm trong popup bài viết');
          break;
        } catch (err) {
          lastError = err;
        }
      }

      if (!uploaded && inputCount === 0) {
        lastError = new Error('Popup bài viết không có input file nội bộ để fallback');
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (!uploaded) {
    const firstImage = existingFiles.find((file) => /^image\//.test(getMimeType(file)));
    if (firstImage) {
      try {
        await pasteImageToComposerFromClipboard(page, firstImage);
        uploaded = true;
        sendLog('success', 'Đã dán ảnh vào composer bằng clipboard native macOS');
      } catch (err) {
        lastError = err;
      }
    }
  }

  // Do not fall back to arbitrary input[type=file] across the whole page. On group
  // admin pages that can be the cover-photo input behind the composer, causing the
  // selected image to be applied to the group cover instead of the post.
  if (!uploaded) {
    throw new Error(`Không mở được bộ chọn ảnh của bài viết. Đã dừng để tránh upload nhầm ảnh bìa group. Lỗi gốc: ${lastError?.message || 'không bắt được file chooser'}`);
  }

  // Wait for Facebook to render attachment preview/progress inside composer.
  const hasPreview = await hasComposerAttachmentPreview(page, 25000);
  if (!hasPreview) {
    throw new Error('Đã chọn file nhưng Facebook chưa hiển thị preview ảnh/video. Dừng đăng để tránh đăng sai nội dung.');
  }

  await randomDelay(4000, 7000);
}

async function clickPostButton(page) {
  sendLog('info', 'Đang bấm Đăng...');
  const postButton = page
    .locator('[role="dialog"] [aria-label="Đăng"], [role="dialog"] [aria-label="Post"], [role="dialog"] button:has-text("Đăng"), [role="dialog"] button:has-text("Post"), [role="dialog"] [role="button"]:has-text("Đăng"), [role="dialog"] [role="button"]:has-text("Post")')
    .last();

  await postButton.waitFor({ state: 'visible', timeout: 15000 });
  await randomDelay(600, 1200);
  await postButton.click({ timeout: 10000, force: true });
}

// ═══════════════════════════════════════════════════════════════════
// Actions
// ═══════════════════════════════════════════════════════════════════
const ACTIONS = {};

// --- TEST CONNECTION ---
ACTIONS.test_connection = async (payload) => {
  sendLog('info', 'Kiểm tra kết nối Playwright...');
  let browser;
  try {
    const launchOpts = buildLaunchOptions(payload.chromePath);
    // For test, use headless
    browser = await chromium.launch({ ...launchOpts, headless: true });
    const context = await browser.newContext({ locale: 'vi-VN' });
    const page = await context.newPage();
    await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
    const title = await page.title();
    await browser.close();
    sendResponse({ success: true, message: `Kết nối thành công — ${title}` });
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    sendResponse({ success: false, error: err.message });
  }
};

// --- OPEN CHROME (persistent profile — user logs in manually) ---
ACTIONS.open_chrome = async (payload) => {
  const profileDir = payload.profileDir || getDefaultProfileDir();
  const chromePath = payload.chromePath || findChromePath();

  sendLog('info', `Mở Chrome với profile: ${profileDir}`);
  if (!chromePath) {
    sendResponse({
      success: false,
      error: 'Không tìm thấy Google Chrome. Vui lòng cài Chrome hoặc nhập Chrome Path thủ công trong app.',
    });
    return;
  }

  sendLog('info', `Chrome path: ${chromePath}`);

  try {
    const chromeArgs = [
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      'https://www.facebook.com',
    ];

    const chrome = spawn(chromePath, chromeArgs, {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });
    chrome.unref();

    sendResponse({
      success: true,
      isLoggedIn: false,
      profileDir,
      usedRecovery: false,
      message: 'Chrome đã mở — Vui lòng đăng nhập Facebook trong cửa sổ vừa mở',
    });
  } catch (err) {
    sendLog('error', `Lỗi mở Chrome: ${err.message}`);
    sendResponse({ success: false, error: err.message });
  }
};

// --- CHECK SESSION (check if chrome profile has active FB session) ---
ACTIONS.check_session = async (payload) => {
  const profileDir = payload.profileDir || getDefaultProfileDir();
  sendLog('info', 'Kiểm tra session Facebook...');
  let context;
  try {
    const launchOpts = buildLaunchOptions(payload.chromePath);
    context = await chromium.launchPersistentContext(profileDir, {
      ...launchOpts,
      headless: true,
    });
    const page = context.pages()[0] || await context.newPage();
    await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await randomDelay(2000, 3000);

    const isLoggedIn = await page.evaluate(() => {
      return !document.querySelector('input[name="email"]');
    });

    await context.close();
    sendResponse({ success: true, isLoggedIn, message: isLoggedIn ? 'Đã đăng nhập Facebook' : 'Chưa đăng nhập' });
  } catch (err) {
    if (context) await context.close().catch(() => {});
    sendResponse({ success: false, error: err.message });
  }
};

// --- SCAN GROUPS ---
ACTIONS.scan_groups = async (payload) => {
  const profileDir = payload.profileDir || getDefaultProfileDir();
  sendLog('info', 'Quét nhóm đã tham gia...');
  let context;
  try {
    const launchOpts = buildLaunchOptions(payload.chromePath);
    context = await chromium.launchPersistentContext(profileDir, {
      ...launchOpts,
    });
    const page = context.pages()[0] || await context.newPage();
    await page.goto('https://www.facebook.com/groups/joins', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await randomDelay(3000, 5000);

    // Scroll to load more groups
    sendLog('info', 'Đang cuộn để tải thêm nhóm...');
    for (let i = 0; i < 5; i++) {
      await humanScroll(page);
      await randomDelay(1000, 2000);
    }

    // Extract groups
    const groups = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/groups/"]'));
      const groupMap = new Map();
      links.forEach((link) => {
        const href = link.href;
        const match = href.match(/\/groups\/(\d+)/);
        if (match && !groupMap.has(match[1])) {
          const name = link.textContent?.trim();
          if (name && name.length > 2 && name.length < 200) {
            groupMap.set(match[1], {
              id: match[1],
              name: name,
              url: `https://www.facebook.com/groups/${match[1]}`,
              memberCount: 0,
            });
          }
        }
      });
      return Array.from(groupMap.values());
    });

    sendLog('success', `Tìm thấy ${groups.length} nhóm`);
    sendResponse({ success: true, groups, message: `Quét được ${groups.length} nhóm` });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
};

// --- POST TO GROUP ---
ACTIONS.post_to_group = async (payload) => {
  const { groupUrl, groupName, content, mediaFiles } = payload;
  const profileDir = payload.profileDir || getDefaultProfileDir();
  sendLog('info', `Đang đăng bài tại: ${groupName}`);
  let context;
  try {
    const launchOpts = buildLaunchOptions(payload.chromePath);
    context = await chromium.launchPersistentContext(profileDir, {
      ...launchOpts,
    });
    const page = context.pages()[0] || await context.newPage();
    await page.goto(groupUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await randomDelay(2000, 4000);

    await openCreatePostDialog(page);

    let contentInserted = false;
    try {
      await fillFacebookComposer(page, content);
      await randomDelay(1000, 2000);
      contentInserted = await hasComposerText(page, content);
    } catch (err) {
      sendLog('warning', `Không nhập được nội dung bằng selector (${err.message}), thử paste clipboard.`);
    }

    if (!contentInserted) {
      await pasteTextToComposerFromClipboard(page, content).catch((pasteErr) => {
        sendLog('warning', `Không paste được nội dung (${pasteErr.message}), vẫn tiếp tục upload ảnh.`);
      });
    }

    // Upload media if provided
    if (mediaFiles && mediaFiles.length > 0) {
      sendLog('info', `Automation nhận mediaFiles: ${mediaFiles.join(', ')}`);
      await uploadMediaToComposer(page, mediaFiles);
    } else {
      sendLog('warning', 'Không có mediaFiles gửi sang automation, bài viết sẽ chỉ có nội dung text.');
    }

    await clickPostButton(page);
    await randomDelay(3000, 6000);

    sendLog('success', `Đăng bài thành công: ${groupName}`);
    sendResult({
      groupId: groupUrl.match(/\/groups\/(\d+)/)?.[1] || '',
      groupName,
      groupUrl,
      status: 'success',
      message: 'Đăng bài thành công',
    });
    sendResponse({ success: true, message: `Đã đăng bài tại ${groupName}` });
  } catch (err) {
    sendLog('error', `Lỗi đăng bài ${groupName}: ${err.message}`);
    sendResult({
      groupId: groupUrl.match(/\/groups\/(\d+)/)?.[1] || '',
      groupName,
      groupUrl,
      status: 'failed',
      message: err.message,
    });
    sendResponse({ success: false, error: err.message });
  } finally {
    if (context) {
      await context.close().catch(() => {});
      sendLog('info', 'Đã đóng tab Facebook sau khi đăng xong');
    }
  }
};

// --- AUTO POST (batch) ---
ACTIONS.auto_post = async (payload) => {
  const { groups, content, mediaFiles, minDelay, maxDelay } = payload;
  const profileDir = payload.profileDir || getDefaultProfileDir();
  sendLog('info', `Bắt đầu auto post cho ${groups.length} nhóm`);
  let context;
  try {
    const launchOpts = buildLaunchOptions(payload.chromePath);
    context = await chromium.launchPersistentContext(profileDir, {
      ...launchOpts,
    });
    const page = context.pages()[0] || await context.newPage();

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      sendProgress(i + 1, groups.length, group.name);
      sendLog('info', `[${i + 1}/${groups.length}] Đang mở nhóm: ${group.name}`);

      try {
        await page.goto(group.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await randomDelay(2000, 4000);

        await openCreatePostDialog(page);

        const postContent = typeof content === 'string' ? content : (content[i] || content[0]);
        let contentInserted = false;
        try {
          await fillFacebookComposer(page, postContent);
          await randomDelay(1000, 2000);
          contentInserted = await hasComposerText(page, postContent);
        } catch (err) {
          sendLog('warning', `Không nhập được nội dung bằng selector (${err.message}), thử paste clipboard.`);
        }

        if (!contentInserted) {
          await pasteTextToComposerFromClipboard(page, postContent).catch((pasteErr) => {
            sendLog('warning', `Không paste được nội dung (${pasteErr.message}), vẫn tiếp tục upload ảnh.`);
          });
        }

        // Upload media
        if (mediaFiles && mediaFiles.length > 0) {
          sendLog('info', `Automation nhận mediaFiles: ${mediaFiles.join(', ')}`);
          await uploadMediaToComposer(page, mediaFiles);
        } else {
          sendLog('warning', 'Không có mediaFiles gửi sang automation, bài viết sẽ chỉ có nội dung text.');
        }

        await clickPostButton(page);
        await randomDelay(3000, 5000);

        sendLog('success', `✅ Đăng thành công: ${group.name}`);
        sendResult({
          groupId: group.id || '',
          groupName: group.name,
          groupUrl: group.url,
          status: 'success',
          message: 'Đăng bài thành công',
        });
        successCount += 1;
      } catch (err) {
        sendLog('error', `❌ Lỗi tại ${group.name}: ${err.message}`);
        sendResult({
          groupId: group.id || '',
          groupName: group.name,
          groupUrl: group.url,
          status: 'failed',
          message: err.message,
        });
        failedCount += 1;
      }

      // Random delay between groups
      if (i < groups.length - 1) {
        const delayMin = (minDelay || 5) * 60 * 1000;
        const delayMax = (maxDelay || 15) * 60 * 1000;
        const waitTime = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
        const waitMinutes = Math.round(waitTime / 60000);
        sendLog('info', `⏳ Nghỉ ${waitMinutes} phút trước nhóm tiếp theo...`);
        await new Promise((r) => setTimeout(r, waitTime));
      }
    }

    if (failedCount > 0) {
      sendLog('warning', `Hoàn tất auto post: ${successCount} thành công, ${failedCount} lỗi`);
      sendResponse({ success: false, error: `Có ${failedCount}/${groups.length} nhóm lỗi`, successCount, failedCount });
    } else {
      sendLog('success', `🎉 Hoàn tất auto post: ${groups.length} nhóm`);
      sendResponse({ success: true, message: `Hoàn tất ${groups.length} nhóm`, successCount, failedCount });
    }
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  } finally {
    if (context) {
      await context.close().catch(() => {});
      sendLog('info', 'Đã đóng tab Facebook sau khi hoàn tất auto post');
    }
  }
};

// ═══════════════════════════════════════════════════════════════════
// Main entry point
// ═══════════════════════════════════════════════════════════════════
const action = process.argv[2];
const payloadStr = process.argv[3];
let payload = {};

if (payloadStr) {
  try {
    payload = JSON.parse(payloadStr);
  } catch (e) {
    sendResponse({ error: 'Invalid JSON payload' });
    process.exit(1);
  }
}

async function run() {
  sendLog('info', `Action: ${action}`);
  if (!action || !ACTIONS[action]) {
    sendResponse({ error: `Unknown action: ${action}. Available: ${Object.keys(ACTIONS).join(', ')}` });
    process.exit(1);
  }
  await ACTIONS[action](payload);
}

run().catch((err) => {
  sendResponse({ error: err.message });
  process.exit(1);
});
