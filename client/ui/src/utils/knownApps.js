/**
 * Known apps — single source of truth.
 * To add a new app, just add an entry here. Everything else is derived.
 *
 * key:       short constant name used in PKG / PKG_ID
 * repoName:  last segment of GitHub repo path, lowercase
 * pkgId:     the short Tizen package ID (before the dot)
 * appName:   the Tizen app name (after the dot)
 */
export const KNOWN_APPS = [
    { key: 'TIZENBREW',           repoName: 'tizenbrew',           pkgId: 'xvvl3S1bvH', appName: 'TizenBrewStandalone' },
    { key: 'TIZENBREW_INSTALLER', repoName: 'tizenbrewinstaller',  pkgId: 'xvvl3S1bTI', appName: 'TizenBrewStandalone' },
    { key: 'TIZENBREW_USB_DEMO',  repoName: null,                  pkgId: 'xvvl3S1bTU', appName: 'TizenBrewStandalone' },
];

// Full app IDs:  PKG.TIZENBREW  → 'xvvl3S1bvH.TizenBrewStandalone'
export const PKG = Object.fromEntries(
    KNOWN_APPS.map(a => [a.key, `${a.pkgId}.${a.appName}`])
);

// Package-only IDs:  PKG_ID.TIZENBREW  → 'xvvl3S1bvH'
export const PKG_ID = Object.fromEntries(
    KNOWN_APPS.map(a => [a.key, a.pkgId])
);

// repoName → full package ID (for version checking). Skips entries with no repoName.
export const REPO_NAME_TO_PACKAGE_ID = Object.fromEntries(
    KNOWN_APPS.filter(a => a.repoName).map(a => [a.repoName, `${a.pkgId}.${a.appName}`])
);