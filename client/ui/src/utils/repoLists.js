import { normalizeRepo } from './versionInfo.js';

// Repo lists: a text/markdown file on GitHub with one "owner/repo" per line.
// A line may also point at another list file ("owner/repo/path/file.md"),
// which becomes a nested list that is removed again when the line goes away.
//
// Data model (persisted by ClientContext):
//   repoLists: [{ id, owner, repo, path, ref, enabled, parent, status, count, syncedAt }]
//   repoMeta:  { [repo]: { locked, sources: [listId] } }
//   A repo with no meta entry was added by hand and is never removed by a sync.
//   Sync only removes repos that are unlocked AND just lost their last source.

var MAX_LISTS = 20;
var MAX_DEPTH = 3;
var LIST_FILE = /\.(md|txt|list)$/i;

// Accepts "owner/repo/path/file.md", optional "@branch" suffix, and pasted
// github.com (blob) / raw.githubusercontent.com URLs. Returns a list object or null.
export function parseListPath(input) {
    if (!input) return null;
    var s = String(input).trim().replace(/^github:/i, '');
    var ref = null;

    var m = s.match(/^https?:\/\/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/([^\/]+)\/(.+)$/i);
    if (m) {
        s = m[1] + '/' + m[2] + '/' + m[4];
        ref = m[3];
    } else {
        s = s.replace(/^https?:\/\/github\.com\//i, '');
        var b = s.match(/^([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)$/);
        if (b) {
            s = b[1] + '/' + b[2] + '/' + b[4];
            ref = b[3];
        }
    }

    var at = s.lastIndexOf('@');
    if (at > 0) {
        ref = s.slice(at + 1) || ref;
        s = s.slice(0, at);
    }
    s = s.replace(/^\/+|\/+$/g, '');

    var parts = s.split('/');
    if (parts.length < 3 || !LIST_FILE.test(parts[parts.length - 1])) return null;
    var owner = parts[0];
    var repo = parts[1];
    var path = parts.slice(2).join('/');
    if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) return null;

    return {
        id: owner.toLowerCase() + '/' + repo.toLowerCase() + '/' + path + (ref ? '@' + ref : ''),
        owner: owner,
        repo: repo,
        path: path,
        ref: ref
    };
}

// Short label for the UI: the file name.
export function listLabel(list) {
    var parts = list.path.split('/');
    return parts[parts.length - 1];
}

export function parseListText(text) {
    var repos = [];
    var lists = [];
    var seenRepos = {};
    var seenLists = {};
    String(text || '').replace(/^﻿/, '').split(/\r?\n/).forEach(function(line) {
        var t = line
            .replace(/^\s*(?:[-*+]|\d+\.)\s+/, '')  // markdown bullet / numbering
            .replace(/[`*]/g, '')
            .trim();
        if (!t || t.charAt(0) === '#' || t.indexOf('<!--') === 0) return;
        var token = t.split(/\s+/)[0];

        var list = parseListPath(token);
        if (list) {
            if (!seenLists[list.id]) { seenLists[list.id] = true; lists.push(list); }
            return;
        }
        var repo = normalizeRepo(token);
        if (/^[\w.-]+\/[\w.-]+$/.test(repo)) {
            if (!seenRepos[repo]) { seenRepos[repo] = true; repos.push(token.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/^github:/i, '').replace(/^\/+|\/+$/g, '')); }
        }
    });
    return { repos: repos, lists: lists };
}

function fetchListText(list) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeoutId = setTimeout(function() {
        if (controller) controller.abort();
    }, 10000);
    // raw.githubusercontent.com caches for ~5 min; a changing query string
    // makes sure an edited list shows up on the next sync.
    var url = 'https://raw.githubusercontent.com/' + list.owner + '/' + list.repo + '/' +
        (list.ref || 'HEAD') + '/' + list.path + '?t=' + Date.now();
    return fetch(url, controller ? { signal: controller.signal } : undefined)
        .then(function(res) {
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.text();
        })
        .catch(function(err) {
            clearTimeout(timeoutId);
            throw err;
        });
}

function depthOf(list, byId) {
    var d = 0;
    var cur = list;
    while (cur && cur.parent && byId[cur.parent] && d < 10) { d++; cur = byId[cur.parent]; }
    return d;
}

// Fetches every enabled list (and nested lists they reference).
// Resolves to { [listId]: { ok, repos, lists } }. Never rejects.
export function fetchAllLists(repoLists) {
    var byId = {};
    repoLists.forEach(function(l) { byId[l.id] = l; });

    var queue = repoLists.filter(function(l) { return !l.parent && l.enabled; });
    var results = {};
    var visited = {};

    function next() {
        var list = queue.shift();
        if (!list) return Promise.resolve(results);
        if (visited[list.id] || Object.keys(visited).length >= MAX_LISTS) return next();
        visited[list.id] = true;
        return fetchListText(list)
            .then(function(text) {
                var parsed = parseListText(text);
                results[list.id] = { ok: true, repos: parsed.repos, lists: parsed.lists };
                if (depthOf(list, byId) + 1 <= MAX_DEPTH) {
                    parsed.lists.forEach(function(sub) {
                        var known = byId[sub.id];
                        if (known && !known.enabled) return; // user disabled it
                        var entry = known || Object.assign({ enabled: true, parent: list.id }, sub);
                        byId[sub.id] = entry;
                        queue.push(entry);
                    });
                }
            })
            .catch(function() {
                results[list.id] = { ok: false };
            })
            .then(next);
    }
    return next();
}

function removeListsCascade(lists, meta, ids) {
    var gone = {};
    ids.forEach(function(id) { gone[id] = true; });
    var changed = true;
    while (changed) {
        changed = false;
        lists.forEach(function(l) {
            if (!gone[l.id] && l.parent && gone[l.parent]) { gone[l.id] = true; changed = true; }
        });
    }
    var touched = {};
    Object.keys(meta).forEach(function(repo) {
        var before = meta[repo].sources.length;
        meta[repo].sources = meta[repo].sources.filter(function(id) { return !gone[id]; });
        if (meta[repo].sources.length !== before) touched[repo] = true;
    });
    return {
        lists: lists.filter(function(l) { return !gone[l.id]; }),
        touched: touched
    };
}

function dropOrphans(repos, meta, touched) {
    var kept = repos.filter(function(repo) {
        var m = meta[repo];
        return !(touched[repo] && m && !m.locked && m.sources.length === 0);
    });
    repos.forEach(function(r) {
        if (kept.indexOf(r) < 0) delete meta[r];
    });
    return kept;
}

function cloneMeta(meta) {
    var out = {};
    Object.keys(meta).forEach(function(r) {
        out[r] = { locked: !!meta[r].locked, sources: (meta[r].sources || []).slice() };
    });
    return out;
}

function findRepo(repos, name) {
    var n = normalizeRepo(name);
    for (var i = 0; i < repos.length; i++) {
        if (normalizeRepo(repos[i]) === n) return repos[i];
    }
    return null;
}

// Pure: merges fetch results into the saved repos / lists.
// A list whose fetch failed is left completely untouched (no removals).
export function applySyncResults(repoList, repoLists, repoMeta, results, now) {
    var repos = repoList.slice();
    var meta = cloneMeta(repoMeta);
    var lists = repoLists.map(function(l) { return Object.assign({}, l); });
    var touched = {};

    Object.keys(results).forEach(function(id) {
        var res = results[id];
        var list = lists.filter(function(l) { return l.id === id; })[0];
        if (!list) return;
        if (!res.ok) { list.status = 'error'; return; }

        list.status = 'ok';
        list.count = res.repos.length;
        list.syncedAt = now;

        // Nested lists: add new ones, drop ones this list no longer mentions.
        var referenced = {};
        res.lists.forEach(function(sub) {
            referenced[sub.id] = true;
            if (!lists.some(function(l) { return l.id === sub.id; }) && lists.length < MAX_LISTS) {
                lists.push(Object.assign({ enabled: true, parent: id, status: 'pending', count: 0, syncedAt: null }, sub));
            }
        });
        var stale = lists.filter(function(l) { return l.parent === id && !referenced[l.id]; }).map(function(l) { return l.id; });
        if (stale.length) {
            var removed = removeListsCascade(lists, meta, stale);
            lists = removed.lists;
            Object.keys(removed.touched).forEach(function(r) { touched[r] = true; });
        }

        // Repos from this list.
        var listed = {};
        res.repos.forEach(function(name) {
            var existing = findRepo(repos, name);
            if (!existing) {
                repos.push(name);
                meta[name] = { locked: false, sources: [id] };
                listed[name] = true;
            } else {
                // Hand-added repos have no meta: keep them locked.
                if (!meta[existing]) meta[existing] = { locked: true, sources: [] };
                if (meta[existing].sources.indexOf(id) < 0) meta[existing].sources.push(id);
                listed[existing] = true;
            }
        });
        Object.keys(meta).forEach(function(repo) {
            var i = meta[repo].sources.indexOf(id);
            if (i >= 0 && !listed[repo]) {
                meta[repo].sources.splice(i, 1);
                touched[repo] = true;
            }
        });
    });

    repos = dropOrphans(repos, meta, touched);
    return { repoList: repos, repoLists: lists, repoMeta: meta };
}

// Pure: user removed a list (and with it nested lists and their unlocked repos).
export function removeRepoList(repoList, repoLists, repoMeta, id) {
    var meta = cloneMeta(repoMeta);
    var removed = removeListsCascade(repoLists.map(function(l) { return Object.assign({}, l); }), meta, [id]);
    var repos = dropOrphans(repoList.slice(), meta, removed.touched);
    return { repoList: repos, repoLists: removed.lists, repoMeta: meta };
}

export function addRepoList(repoLists, input) {
    var parsed = parseListPath(input);
    if (!parsed) return null;
    var existing = repoLists.filter(function(l) { return l.id === parsed.id; })[0];
    if (existing) {
        // Promote a nested list to a top-level one the user manages themselves.
        return repoLists.map(function(l) {
            return l.id === parsed.id ? Object.assign({}, l, { parent: null, enabled: true }) : l;
        });
    }
    return repoLists.concat([Object.assign({ enabled: true, parent: null, status: 'pending', count: 0, syncedAt: null }, parsed)]);
}

// Convenience used by the app: fetch + merge. Resolves to the merged result,
// or null when there is nothing to sync.
export function syncRepoLists(sharedData, dispatch) {
    var lists = sharedData.repoLists || [];
    if (!lists.some(function(l) { return l.enabled && !l.parent; })) return Promise.resolve(null);
    return fetchAllLists(lists).then(function(results) {
        var now = Date.now();
        var merged = applySyncResults(sharedData.repoList, lists, sharedData.repoMeta || {}, results, now);
        dispatch({ type: 'APPLY_REPO_SYNC', payload: { results: results, now: now } });
        return merged;
    });
}
