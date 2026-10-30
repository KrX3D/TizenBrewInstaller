// Sequential "update all" queue. Installs one repo at a time through the normal
// InstallPackage websocket event and waits for the service to answer before
// starting the next one. WebSocketClient reports results back via onInstall*.

var INSTALL_PACKAGE = 1; // Events.InstallPackage (not imported: WebSocketClient imports this file)
var INACTIVITY_MS = 120000; // no status/result from the service for this long = failed
var GAP_MS = 6000;          // let the service close its adb connection between installs

// The installer replacing itself would kill the queue, so it goes last.
var SELF_REPOS = ['reisxd/tizenbrewinstaller', 'krx3d/tizenbrewinstaller'];

var state = { items: [], active: false, finished: false };
var listeners = [];
var client = null;
var onFinish = null;
var timer = null;
var gapTimer = null;

function emit() {
    state = Object.assign({}, state, { items: state.items.map(function(i) { return Object.assign({}, i); }) });
    listeners.forEach(function(fn) { fn(state); });
}

export function subscribeQueue(fn) {
    listeners.push(fn);
    fn(state);
    return function() { listeners = listeners.filter(function(l) { return l !== fn; }); };
}

function clearTimers() {
    clearTimeout(timer);
    clearTimeout(gapTimer);
}

function armInactivity() {
    clearTimeout(timer);
    timer = setTimeout(function() { settle(false, 'no response from the installer service'); }, INACTIVITY_MS);
}

function current() {
    return state.items.filter(function(i) { return i.status === 'running'; })[0];
}

function finish() {
    clearTimers();
    state.active = false;
    state.finished = true;
    emit();
    if (onFinish) onFinish();
}

function runNext() {
    var next = state.items.filter(function(i) { return i.status === 'pending'; })[0];
    if (!next) { finish(); return; }
    next.status = 'running';
    emit();
    armInactivity();
    try {
        client.send({ type: INSTALL_PACKAGE, payload: { url: next.repo } });
    } catch (e) {
        settle(false, 'could not reach the installer service');
    }
}

function settle(ok, message) {
    var item = current();
    if (!item) return;
    clearTimeout(timer);
    item.status = ok ? 'done' : 'failed';
    item.error = ok ? null : (message || 'failed');
    emit();
    gapTimer = setTimeout(runNext, GAP_MS);
}

// repos: [{ repo, installedVersion, latestVersion }]
export function startQueue(wsClient, repos, finishCallback) {
    if (state.active || !wsClient || !repos.length) return;
    client = wsClient;
    onFinish = finishCallback || null;
    var isSelf = function(r) { return SELF_REPOS.indexOf(r.repo.toLowerCase()) >= 0; };
    var ordered = repos.filter(function(r) { return !isSelf(r); }).concat(repos.filter(isSelf));
    state = {
        active: true,
        finished: false,
        items: ordered.map(function(r) {
            return { repo: r.repo, from: r.installedVersion, to: r.latestVersion, status: 'pending', error: null };
        })
    };
    emit();
    runNext();
}

// Stops after the install that is currently running.
export function cancelQueue() {
    if (!state.active) return;
    clearTimeout(gapTimer);
    state.items.forEach(function(i) {
        if (i.status === 'pending') { i.status = 'skipped'; }
    });
    if (!current()) { finish(); return; }
    emit();
}

export function dismissQueue() {
    if (state.active) return;
    clearTimers();
    state = { items: [], active: false, finished: false };
    emit();
}

// ---- called by WebSocketClient ----------------------------------------------

export function onInstallProgress() {
    if (state.active && current()) armInactivity();
}

export function onInstallResult(ok, message) {
    if (state.active) settle(ok, message);
}

// A service error normally affects only the current repo (bad package, 404 on
// the asset...), so the queue carries on with the next one.
export function onInstallError(message) {
    if (state.active) settle(false, message);
}

// Problems every later install would hit too (e.g. a Samsung certificate is
// required first): fail the current repo and stop the queue.
export function onInstallFatal(message) {
    if (!state.active || !current()) return;
    settle(false, message);
    clearTimeout(gapTimer);
    state.items.forEach(function(i) {
        if (i.status === 'pending') i.status = 'skipped';
    });
    gapTimer = setTimeout(finish, 500);
}
