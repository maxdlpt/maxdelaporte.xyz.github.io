/**
 * sync-logos.js
 * Scans 3_images/Software logos/ for SVG files and keeps logos.json in sync.
 *
 * Rules:
 *  - Files already in logos.json keep their existing alt text.
 *  - New SVG files get a generated alt text (derived from filename).
 *  - Entries whose files no longer exist are removed.
 *  - Order in logos.json is preserved; new files are appended.
 *
 * Usage:  node scripts/sync-logos.js
 */

const fs   = require('fs');
const path = require('path');

const LOGOS_DIR  = path.join(__dirname, '..', '3_images', 'Software logos');
const LOGOS_JSON = path.join(LOGOS_DIR, 'logos.json');

/** Derive a readable name from a filename like "4 - VS Code.svg" → "VS Code" */
function nameFromFile(filename) {
    return filename
        .replace(/\.svg$/i, '')          // strip extension
        .replace(/^\d+\s*[-–]\s*/, '')   // strip leading "4 - " or "4 – "
        .replace(/[_-]+/g, ' ')          // underscores / hyphens → spaces
        .replace(/\s+/g, ' ')
        .trim();
}

// Read current manifest (or start empty)
let existing = [];
if (fs.existsSync(LOGOS_JSON)) {
    existing = JSON.parse(fs.readFileSync(LOGOS_JSON, 'utf8'));
}

// Read all SVGs from folder
const svgs = fs.readdirSync(LOGOS_DIR)
    .filter(f => f.toLowerCase().endsWith('.svg'))
    .sort();

const existingMap = new Map(existing.map(e => [e.file, e.alt]));

// Build updated list: existing entries first (preserves order + custom alt),
// then any new files appended at the end.
const updated = svgs.map(file => ({
    file,
    alt: existingMap.has(file) ? existingMap.get(file) : nameFromFile(file),
}));

// Check for removed files
const removed = existing.filter(e => !svgs.includes(e.file)).map(e => e.file);
if (removed.length) console.log('Removed:', removed.join(', '));

// Check for added files
const added = svgs.filter(f => !existingMap.has(f));
if (added.length) console.log('Added:', added.join(', '));

if (!removed.length && !added.length) {
    console.log('logos.json is already up to date.');
} else {
    fs.writeFileSync(LOGOS_JSON, JSON.stringify(updated, null, 2) + '\n');
    console.log(`logos.json updated — ${updated.length} logo(s).`);
}
