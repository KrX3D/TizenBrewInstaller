// Shared utilities for fetching GitHub release versions and checking installed state.

export { REPO_NAME_TO_PACKAGE_ID } from './knownApps.js';

export function normalizeRepo(repo) {
    if (!repo) return '';
    return repo.trim()
        .replace(/^https?:\/\/github\.com\//i, '')
        .replace(/\.git$/i, '')
        .replace(/^github:/i, '')
        .replace(/^\/+|\/+$/g, '')
        .toLowerCase();
}

export function repoLabel(repo) {
    if (!repo) return 'TizenBrew';
    const parts = repo.split('/');
    const last = parts[parts.length - 1];
    return last.charAt(0).toUpperCase() + last.slice(1);
}

export function isKnownRepo(repo) {
    return !!REPO_NAME_TO_PACKAGE_ID[normalizeRepo(repo).split('/').pop()];
}

export function getInstalledVersion(repo) {
    if (typeof tizen === 'undefined') return null;
    const repoName = normalizeRepo(repo).split('/').pop();
    const pkgId = REPO_NAME_TO_PACKAGE_ID[repoName];
    if (!pkgId) return null; // Unknown app — can't check installed state
    try {
        return tizen.application.getAppInfo(pkgId).version;
    } catch (_) {
        return null;
    }
}

export async function fetchLatestVersion(repo) {
    try {
        const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);
        if (!res.ok) return null;
        const data = await res.json();
        return data.tag_name ? data.tag_name.replace(/^v/, '') : null;
    } catch (_) {
        return null;
    }
}

// Returns true if latestVersion is strictly newer than installedVersion.
// Compares dot-separated numeric segments.
export function isUpdateAvailable(installedVersion, latestVersion) {
    if (!installedVersion || !latestVersion) return false;
    const a = installedVersion.split('.').map(Number);
    const b = latestVersion.split('.').map(Number);
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
        const av = a[i] || 0;
        const bv = b[i] || 0;
        if (bv > av) return true;
        if (bv < av) return false;
    }
    return false;
}

// Fetch version info for a list of repos in parallel.
// Returns array of { repo, latestVersion, installedVersion, updateAvailable }
export async function fetchAllVersionInfo(repoList) {
    const results = await Promise.all(repoList.map(async repo => {
        const latestVersion = await fetchLatestVersion(repo);
        const installedVersion = getInstalledVersion(repo);
        return {
            repo,
            latestVersion,
            installedVersion,
            updateAvailable: isUpdateAvailable(installedVersion, latestVersion)
        };
    }));
    return results;
}