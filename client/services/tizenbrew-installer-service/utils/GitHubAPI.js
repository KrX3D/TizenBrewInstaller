const fetch = require('node-fetch');

// Turns a failed GitHub API response into an Error carrying an i18n key the UI
// can show, so a rate limit or a bad token says so instead of "Forbidden".
function gitHubError(response, hasToken) {
    const err = new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    const remaining = response.headers.get('x-ratelimit-remaining');
    const reset = parseInt(response.headers.get('x-ratelimit-reset'), 10);
    if (response.status === 401) {
        err.i18nKey = 'errors.githubBadToken';
        err.i18nArgs = {};
    } else if (response.status === 429 || (response.status === 403 && (remaining === '0' || remaining === null))) {
        err.i18nKey = hasToken ? 'errors.githubRateLimitWithToken' : 'errors.githubRateLimit';
        // The UI formats the time in the TV's local time zone.
        err.i18nArgs = { reset: reset || 0 };
    }
    return err;
}

// Fetches the latest release, or a specific one when a tag is given. The
// optional token raises GitHub's limit from 60 to 5000 requests per hour.
function fetchRelease(repo, tag, token) {
    const url = tag
        ? `https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`
        : `https://api.github.com/repos/${repo}/releases/latest`;
    const headers = { 'User-Agent': 'TizenBrewInstaller' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(url, { headers })
        .then(response => {
            if (!response.ok) {
                throw gitHubError(response, !!token);
            }
            return response.json();
        });
}

module.exports = {
    fetchRelease
};
