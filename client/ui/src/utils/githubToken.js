// Optional GitHub token. Without one GitHub allows 60 API requests per hour
// per IP address; with one it allows 5000. Stored only in this app's
// localStorage and sent only to api.github.com and to our own service.
import { useState, useEffect } from 'preact/hooks';

var STORAGE_KEY = 'tb-github-token';
var CHANGE_EVENT = 'tb-github-token-changed';

export function getGitHubToken() {
    try {
        return (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) || '';
    } catch (_) {
        return '';
    }
}

export function setGitHubToken(token) {
    var value = String(token || '').trim();
    try {
        if (value) localStorage.setItem(STORAGE_KEY, value);
        else localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    try {
        var evt = document.createEvent('Event');
        evt.initEvent(CHANGE_EVENT, false, false);
        window.dispatchEvent(evt);
    } catch (_) {}
    return value;
}

// Current token; re-renders when it is saved or removed (also from the phone).
export function useGitHubToken() {
    var pair = useState(getGitHubToken());
    useEffect(function() {
        function onChange() { pair[1](getGitHubToken()); }
        window.addEventListener(CHANGE_EVENT, onChange);
        return function() { window.removeEventListener(CHANGE_EVENT, onChange); };
    }, []);
    return pair[0];
}

// Accepts classic (ghp_...) and fine-grained (github_pat_...) tokens, plus
// other gh*_ prefixes and old 40-char hex tokens.
export function looksLikeGitHubToken(token) {
    var value = String(token || '').trim();
    return /^(gh[a-z]_[A-Za-z0-9]{20,255}|github_pat_[A-Za-z0-9_]{20,255}|[0-9a-f]{40})$/.test(value);
}

export function maskToken(token) {
    if (!token) return '';
    return token.slice(0, Math.min(8, token.length)) + '...' + token.slice(-4);
}

// fetch() for api.github.com that adds the token when one is saved.
export function githubFetch(url, options) {
    var token = getGitHubToken();
    var opts = Object.assign({}, options || {});
    var headers = Object.assign({}, opts.headers || {});
    if (token) headers['Authorization'] = 'Bearer ' + token;
    opts.headers = headers;
    return fetch(url, opts);
}

export function formatResetTime(resetEpochSeconds) {
    var reset = parseInt(resetEpochSeconds, 10);
    if (!reset) return '';
    var d = new Date(reset * 1000);
    var hh = String(d.getHours());
    var mm = String(d.getMinutes());
    return (hh.length < 2 ? '0' + hh : hh) + ':' + (mm.length < 2 ? '0' + mm : mm);
}

// Turns a failed GitHub API response into an i18n key plus args, or null when
// it is not one of the cases we explain (rate limit, bad token).
export function describeGitHubFailure(res) {
    if (!res || res.ok) return null;
    var hasToken = !!getGitHubToken();
    if (res.status === 401) {
        return { key: 'errors.githubBadToken', args: {} };
    }
    var remaining = res.headers && res.headers.get ? res.headers.get('x-ratelimit-remaining') : null;
    var reset = res.headers && res.headers.get ? res.headers.get('x-ratelimit-reset') : null;
    if (res.status === 429 || (res.status === 403 && (remaining === '0' || remaining === null))) {
        return {
            key: hasToken ? 'errors.githubRateLimitWithToken' : 'errors.githubRateLimit',
            args: { time: formatResetTime(reset) || '?' }
        };
    }
    return null;
}

// Error with the i18n key attached, so callers can show the real reason.
export function gitHubError(res) {
    var info = describeGitHubFailure(res);
    var err = new Error('HTTP ' + (res && res.status));
    if (info) {
        err.i18nKey = info.key;
        err.i18nArgs = info.args;
    }
    return err;
}
