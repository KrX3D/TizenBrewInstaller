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
    return fetchLatestReleaseInfo(repo).then(function(info) {
        return info.latestVersion;
    });
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
        return fetchLatestReleaseInfo(repo).then(function(info) {
            var installedVersion = getInstalledVersion(repo);
            return {
                repo: repo,
                latestVersion: info.latestVersion,
                appId: info.appId,
                appName: info.appName,
                installedVersion: installedVersion,
                updateAvailable: isUpdateAvailable(installedVersion, info.latestVersion)
            };
        });
    }));
}

function getCacheKey(repo) {
    return 'tb-release-meta:' + normalizeRepo(repo);
}

function readCachedReleaseInfo(repo) {
    try {
        if (typeof localStorage === 'undefined') return null;
        var raw = localStorage.getItem(getCacheKey(repo));
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed;
    } catch (_) {
        return null;
    }
}

function writeCachedReleaseInfo(repo, data) {
    try {
        if (typeof localStorage === 'undefined') return;
        localStorage.setItem(getCacheKey(repo), JSON.stringify(data));
    } catch (_) {}
}

function parseMetadataFromReleaseBody(body) {
    if (!body || typeof body !== 'string') return { appId: null, appName: null };
    var m = body.match(/TBI_METADATA:\s*(\{.*\})/);
    if (!m) return { appId: null, appName: null };
    try {
        var parsed = JSON.parse(m[1]);
        return {
            appId: parsed.appId || null,
            appName: parsed.appName || null
        };
    } catch (_) {
        return { appId: null, appName: null };
    }
}

export function fetchLatestReleaseInfo(repo) {
    var cached = readCachedReleaseInfo(repo);
    if (cached && cached.latestVersion) return Promise.resolve(cached);

    return fetch('https://api.github.com/repos/' + repo + '/releases/latest')
        .then(function(res) {
            if (!res.ok) return null;
            return res.json();
        })
        .then(function(data) {
            if (!data) return { latestVersion: null, appId: null, appName: null };
            var metadata = parseMetadataFromReleaseBody(data.body || '');
            var out = {
                latestVersion: data.tag_name ? data.tag_name.replace(/^v/, '') : null,
                appId: metadata.appId,
                appName: metadata.appName
            };
            writeCachedReleaseInfo(repo, out);
            return out;
        })
        .catch(function() { return { latestVersion: null, appId: null, appName: null }; });
}

export function clearReleaseInfoCacheForMissingRepos(repoList) {
    try {
        if (typeof localStorage === 'undefined') return;
        var keep = {};
        repoList.forEach(function(repo) { keep[getCacheKey(repo)] = true; });
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key && key.indexOf('tb-release-meta:') === 0 && !keep[key]) {
                localStorage.removeItem(key);
                i--;
            }
        }
    } catch (_) {}
}
