const fetch = require('node-fetch');

// Fetches the latest release, or a specific one when a tag is given.
function fetchRelease(repo, tag) {
    const url = tag
        ? `https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`
        : `https://api.github.com/repos/${repo}/releases/latest`;
    return fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.statusText}`);
            }
            return response.json();
        });
}

module.exports = {
    fetchRelease
};
