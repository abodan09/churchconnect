'use strict';
/**
 * ChurchConnect release script
 * Usage: node scripts/release.cjs [patch|minor|major|--current]
 *   patch     → 1.0.1 → 1.0.2  (bug fixes, default)
 *   minor     → 1.0.1 → 1.1.0  (new features)
 *   major     → 1.0.1 → 2.0.0  (breaking changes)
 *   --current → publish with the version already in package.json (no bump)
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

const bumpArg = process.argv[2] || 'patch';
const noBump = bumpArg === '--current';
if (!noBump && !['patch', 'minor', 'major'].includes(bumpArg)) {
  console.error('Usage: node scripts/release.cjs [patch|minor|major|--current]');
  process.exit(1);
}

// ── 1. Read & bump version ───────────────────────────────────────────────────
const pkgPath = path.join(ROOT, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const oldVersion = pkg.version;
const newVersion = noBump ? oldVersion : bumpVersion(oldVersion, bumpArg);

if (noBump) {
  console.log(`\n🚀 ChurchConnect: publishing current version ${newVersion} (no bump)\n`);
} else {
  console.log(`\n🚀 ChurchConnect: ${oldVersion} → ${newVersion} (${bumpArg})\n`);
  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`✅ package.json updated to ${newVersion}`);
}

// ── 2. Build Vite + Electron ─────────────────────────────────────────────────
run('npm run electron:build');

// ── 3. Copy with clean file names ───────────────────────────────────────────
const setupSrc        = path.join(DIST, `ChurchConnect Setup ${newVersion}.exe`);
const portSrc         = path.join(DIST, `ChurchConnect ${newVersion}.exe`);
const setupDest       = path.join(DIST, 'ChurchConnect-Setup.exe');
const portDest        = path.join(DIST, 'ChurchConnect-Portable.exe');
const setupVersioned  = path.join(DIST, `ChurchConnect-Setup-${newVersion}.exe`);
const portVersioned   = path.join(DIST, `ChurchConnect-Portable-${newVersion}.exe`);

if (!fs.existsSync(setupSrc)) { console.error(`Missing: ${setupSrc}`); process.exit(1); }
if (!fs.existsSync(portSrc))  { console.error(`Missing: ${portSrc}`);  process.exit(1); }

// Plain names — what the landing site's /releases/latest/download/ links use
fs.copyFileSync(setupSrc, setupDest);
fs.copyFileSync(portSrc, portDest);
// Versioned names — shown in the release for clarity
fs.copyFileSync(setupSrc, setupVersioned);
fs.copyFileSync(portSrc, portVersioned);
console.log('✅ Build artifacts copied');

// ── 4. Git commit & push ─────────────────────────────────────────────────────
run('git add -A');
run(`git commit -m "release: v${newVersion}"`);
run('git push origin master');
console.log('✅ Pushed to GitHub');

// ── 5. GitHub release ────────────────────────────────────────────────────────
// Pull changelog entry for this version from public/changelog.json
const changelogPath = path.join(ROOT, 'public', 'changelog.json');
let changelogEntry = null;
try {
  const changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));
  changelogEntry = changelog.find(e => e.version === newVersion);
} catch { /* ignore if missing */ }

let releaseNotes = `## ChurchConnect v${newVersion}`;
if (changelogEntry?.title) releaseNotes += ` — ${changelogEntry.title}`;
releaseNotes += '\n\n';
if (changelogEntry?.features?.length) {
  releaseNotes += '### New Features\n';
  changelogEntry.features.forEach(f => { releaseNotes += `- ${f}\n`; });
  releaseNotes += '\n';
}
if (changelogEntry?.fixes?.length) {
  releaseNotes += '### Bug Fixes\n';
  changelogEntry.fixes.forEach(f => { releaseNotes += `- ${f}\n`; });
  releaseNotes += '\n';
}
releaseNotes += `### Download\n- **ChurchConnect-Setup.exe** — Recommended installer\n- **ChurchConnect-Portable.exe** — Portable, no install required\n\n### Requirements\n- Windows 10 / 11 (64-bit)`;

const notesFile = path.join(DIST, 'release-notes.md');
fs.writeFileSync(notesFile, releaseNotes);

run(
  `gh release create v${newVersion} "${setupDest}" "${portDest}" "${setupVersioned}" "${portVersioned}" "${path.join(DIST, 'latest.yml')}" --repo abodan09/churchconnect --title "ChurchConnect v${newVersion}" --notes-file "${notesFile}"`
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
