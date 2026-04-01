import { REPO_NAME_TO_PACKAGE_ID } from './knownApps.js';
export { REPO_NAME_TO_PACKAGE_ID };

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
    var parts = repo.split('/');
    var last = parts[parts.length - 1];
    return last.charAt(0).toUpperCase() + last.slice(1);
}

export function isKnownRepo(repo) {
    return !!REPO_NAME_TO_PACKAGE_ID[normalizeRepo(repo).split('/').pop()];
}

export function getInstalledVersion(repo) {
    if (typeof tizen === 'undefined') return null;
    var repoName = normalizeRepo(repo).split('/').pop();
    var pkgId = REPO_NAME_TO_PACKAGE_ID[repoName];
    if (!pkgId) return null;
    try {
        return tizen.application.getAppInfo(pkgId).version;
    } catch (_) {
        return null;
    }
}

export function fetchLatestVersion(repo) {
    return fetch('https://api.github.com/repos/' + repo + '/releases/latest')
        .then(function(res) {
            if (!res.ok) return null;
            return res.json();
        })
        .then(function(data) {
            if (!data) return null;
            return data.tag_name ? data.tag_name.replace(/^v/, '') : null;
        })
        .catch(function() { return null; });
}

export function isUpdateAvailable(installedVersion, latestVersion) {
    if (!installedVersion || !latestVersion) return false;
    var a = installedVersion.split('.').map(Number);
    var b = latestVersion.split('.').map(Number);
    var len = Math.max(a.length, b.length);
    for (var i = 0; i < len; i++) {
        var av = a[i] || 0;
        var bv = b[i] || 0;
        if (bv > av) return true;
        if (bv < av) return false;
    }
    return false;
}

export function fetchAllVersionInfo(repoList) {
    return Promise.all(repoList.map(function(repo) {
        return fetchLatestVersion(repo).then(function(latestVersion) {
            var installedVersion = getInstalledVersion(repo);
            return {
                repo: repo,
                latestVersion: latestVersion,
                installedVersion: installedVersion,
                updateAvailable: isUpdateAvailable(installedVersion, latestVersion)
            };
        });
    }));
}