'use strict';
/**
 * ChurchConnect release script
 * Usage: node scripts/release.cjs [patch|minor|major]
 *   patch  → 1.0.1 → 1.0.2  (bug fixes, default)
 *   minor  → 1.0.1 → 1.1.0  (new features)
 *   major  → 1.0.1 → 2.0.0  (breaking changes)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LANDING = path.join(ROOT, '..', 'ChurchConnect-Landing');
const DIST = 'C:\\ChurchConnect-dist';

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts });
}

function bumpVersion(current, type) {
  const [maj, min, pat] = current.split('.').map(Number);
  if (type === 'major') return `${maj + 1}.0.0`;
  if (type === 'minor') return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

const bumpType = process.argv[2] || 'patch';
if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error('Usage: node scripts/release.cjs [patch|minor|major]');
  process.exit(1);
}

// ── 1. Read & bump version ───────────────────────────────────────────────────
const pkgPath = path.join(ROOT, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const oldVersion = pkg.version;
const newVersion = bumpVersion(oldVersion, bumpType);

console.log(`\n🚀 ChurchConnect: ${oldVersion} → ${newVersion} (${bumpType})\n`);

pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`✅ package.json updated to ${newVersion}`);

// ── 2. Build Vite + Electron ─────────────────────────────────────────────────
run('npm run electron:build');

// ── 3. Copy with clean file names ───────────────────────────────────────────
const setupSrc   = path.join(DIST, `ChurchConnect Setup ${newVersion}.exe`);
const portSrc    = path.join(DIST, `ChurchConnect ${newVersion}.exe`);
const setupDest  = path.join(DIST, 'ChurchConnect-Setup.exe');
const portDest   = path.join(DIST, 'ChurchConnect-Portable.exe');

if (!fs.existsSync(setupSrc)) { console.error(`Missing: ${setupSrc}`); process.exit(1); }
if (!fs.existsSync(portSrc))  { console.error(`Missing: ${portSrc}`);  process.exit(1); }

fs.copyFileSync(setupSrc, setupDest);
fs.copyFileSync(portSrc, portDest);
console.log('✅ Build artifacts copied');

// ── 4. Git commit & push ─────────────────────────────────────────────────────
run('git add -A');
run(`git commit -m "release: v${newVersion}"`);
run('git push origin main');
console.log('✅ Pushed to GitHub');

// ── 5. GitHub release ────────────────────────────────────────────────────────
const releaseNotes = bumpType === 'patch'
  ? `## ChurchConnect v${newVersion} — Bug Fix Release\n\nBug fixes and stability improvements.\n\n### Download\n- **ChurchConnect-Setup.exe** — Recommended installer\n- **ChurchConnect-Portable.exe** — Portable, no install required\n\n### Requirements\n- Windows 10 / 11 (64-bit)`
  : bumpType === 'minor'
  ? `## ChurchConnect v${newVersion} — Feature Release\n\nNew features and improvements.\n\n### Download\n- **ChurchConnect-Setup.exe** — Recommended installer\n- **ChurchConnect-Portable.exe** — Portable, no install required\n\n### Requirements\n- Windows 10 / 11 (64-bit)`
  : `## ChurchConnect v${newVersion} — Major Release\n\nMajor new version with significant changes.\n\n### Download\n- **ChurchConnect-Setup.exe** — Recommended installer\n- **ChurchConnect-Portable.exe** — Portable, no install required\n\n### Requirements\n- Windows 10 / 11 (64-bit)`;

const notesFile = path.join(DIST, 'release-notes.md');
fs.writeFileSync(notesFile, releaseNotes);

run(
  `gh release create v${newVersion} "${setupDest}" "${portDest}" "${path.join(DIST, 'latest.yml')}" --repo abodan09/churchconnect --title "ChurchConnect v${newVersion}" --notes-file "${notesFile}"`
);
console.log(`✅ GitHub release v${newVersion} created`);

// ── 6. Deploy landing site ───────────────────────────────────────────────────
if (fs.existsSync(LANDING)) {
  run('npx vercel --prod', { cwd: LANDING });
  console.log('✅ Landing site redeployed');
} else {
  console.warn('⚠️  Landing site not found, skipping deploy');
}

console.log(`\n🎉 ChurchConnect v${newVersion} is live!\n`);
