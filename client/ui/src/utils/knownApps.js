/**
 * Known apps — single source of truth.
 * To add a new app, just add an entry here. Everything else is derived.
 *
 * key:      short constant name used in PKG / PKG_ID
 * repoName: last segment of GitHub repo path, lowercase (null if no repo)
 * pkgId:    the short Tizen package ID (before the dot)
 * appName:  the Tizen app name (after the dot)
 */
export const KNOWN_APPS = [
    { key: 'TIZENBREW',           repoName: 'tizenbrew',          pkgId: 'xvvl3S1bvH', appName: 'TizenBrewStandalone' },
    { key: 'TIZENBREW_INSTALLER', repoName: 'tizenbrewinstaller', pkgId: 'xvvl3S1bTI', appName: 'TizenBrewStandalone' },
    { key: 'TIZENBREW_USB_DEMO',  repoName: null,                 pkgId: 'xvvl3S1bTU', appName: 'TizenBrewStandalone' },
    { key: 'TIZENYOUTUBE',        repoName: null,                 pkgId: 'krx3dYtV01', appName: 'TizenYouTube' },
];

// Full app IDs:  PKG.TIZENBREW  → 'xvvl3S1bvH.TizenBrewStandalone'
export const PKG = KNOWN_APPS.reduce(function(acc, a) {
    acc[a.key] = a.pkgId + '.' + a.appName;
    return acc;
}, {});

// Package-only IDs:  PKG_ID.TIZENBREW  → 'xvvl3S1bvH'
export const PKG_ID = KNOWN_APPS.reduce(function(acc, a) {
    acc[a.key] = a.pkgId;
    return acc;
}, {});

// repoName → full package ID (for version checking). Skips entries with no repoName.
export const REPO_NAME_TO_PACKAGE_ID = KNOWN_APPS.reduce(function(acc, a) {
    if (a.repoName) acc[a.repoName] = a.pkgId + '.' + a.appName;
    return acc;
}, {});
