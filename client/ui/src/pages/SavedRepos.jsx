import { useContext, useEffect, useState } from 'preact/hooks';
import { GlobalStateContext } from '../components/ClientContext.jsx';
import { useLocation } from 'preact-iso';
import { useFocusable, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { CheckCircleIcon, TrashIcon, ArrowDownIcon, TagIcon, LockClosedIcon, LockOpenIcon, EyeIcon, EyeSlashIcon, PlusIcon, QueueListIcon } from '@heroicons/react/16/solid';
import { useTranslation } from 'react-i18next';
import { Events } from '../components/WebSocketClient.js';
import VersionPicker from '../components/VersionPicker.jsx';
import { syncRepoLists } from '../utils/repoLists.js';
import { startQueue } from '../utils/installQueue.js';
import { fetchAllVersionInfo, isUpdateAvailable, clearReleaseInfoCacheForMissingRepos } from '../utils/versionInfo.js';

const COL_NAME    = 0;
const COL_LOCK    = 1;
const COL_VERSION = 2;
const COL_INSTALL = 3;
const COL_DELETE  = 4;

const LIST_COL_NAME   = 0;
const LIST_COL_TOGGLE = 1;
const LIST_COL_DELETE = 2;

function fileOf(listId) {
    return listId.split('@')[0].split('/').pop();
}

// One repo list (a file on GitHub). Enter on the name = sync now.
function ListRow({ list, depth, focusKey, onSync, onToggle, onDelete }) {
    const { t } = useTranslation();
    const [col, setCol] = useState(LIST_COL_NAME);

    const { ref, focused } = useFocusable({
        focusKey,
        onEnterPress: () => {
            if (col === LIST_COL_NAME)   onSync();
            if (col === LIST_COL_TOGGLE) onToggle();
            if (col === LIST_COL_DELETE) onDelete();
        },
        onArrowPress: (dir) => {
            if (dir === 'right' && col < LIST_COL_DELETE) { setCol(c => c + 1); return false; }
            if (dir === 'left'  && col > LIST_COL_NAME)   { setCol(c => c - 1); return false; }
            return true;
        }
    });

    useEffect(() => { if (!focused) setCol(LIST_COL_NAME); }, [focused]);
    useEffect(() => {
        if (focused) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [focused]);

    function ring(c) {
        return focused && col === c ? (c === LIST_COL_DELETE ? 'ring-2 ring-red-400' : 'ring-2 ring-white') : '';
    }

    const status = !list.enabled ? { text: t('repoLists.disabled'), cls: 'text-slate-500' }
        : list.status === 'error' ? { text: t('repoLists.error'), cls: 'text-red-400' }
        : list.status === 'ok' ? { text: t('repoLists.count', { count: list.count }), cls: 'text-slate-400' }
        : { text: t('repoLists.pending'), cls: 'text-slate-500' };

    return (
        <div
            ref={ref}
            style={{ marginLeft: depth * 20 }}
            className={[
                'flex items-center gap-2 rounded-xl px-3 border-2 transition-colors mb-2 min-h-[3.5rem] py-2',
                focused ? 'border-sky-500 bg-slate-800' : 'border-slate-700 bg-slate-900'
            ].join(' ')}
        >
            <div className={['flex flex-col flex-1 min-w-0 rounded-lg px-3 py-1 transition-all', ring(LIST_COL_NAME)].join(' ')}>
                <div className="flex items-center gap-2">
                    <QueueListIcon className={`h-5 w-5 flex-shrink-0 ${list.enabled ? 'text-violet-300' : 'text-slate-600'}`} />
                    <span className={`font-mono text-sm truncate ${list.enabled ? 'text-slate-200' : 'text-slate-500'}`}>{list.id}</span>
                </div>
                <div className={`ml-7 text-xs ${status.cls}`}>
                    {status.text}{list.parent ? ' \u00b7 ' + t('repoLists.nested') : ''}
                </div>
            </div>
            <div className={['flex items-center justify-center w-10 h-10 rounded-lg bg-slate-600 text-white flex-shrink-0 transition-all', ring(LIST_COL_TOGGLE)].join(' ')}>
                {list.enabled ? <EyeIcon className="h-5 w-5" /> : <EyeSlashIcon className="h-5 w-5" />}
            </div>
            <div className={['flex items-center justify-center w-10 h-10 rounded-lg bg-red-800 text-white flex-shrink-0 transition-all', ring(LIST_COL_DELETE)].join(' ')}>
                <TrashIcon className="h-5 w-5" />
            </div>
        </div>
    );
}

function UpdateAllRow({ count, onRun }) {
    const { t } = useTranslation();
    const { ref, focused } = useFocusable({ focusKey: 'update-all', onEnterPress: onRun });
    useEffect(() => {
        if (focused) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [focused]);
    return (
        <div
            ref={ref}
            onClick={onRun}
            className={[
                'flex items-center justify-center gap-2 rounded-xl px-3 border-2 mb-4 min-h-[3.5rem] py-2 font-semibold transition-colors',
                focused ? 'border-amber-300 bg-amber-700 text-white' : 'border-amber-500 bg-amber-950/40 text-amber-300'
            ].join(' ')}
        >
            <ArrowDownIcon className="h-5 w-5" />
            <span>{t('queue.updateAll', { count })}</span>
        </div>
    );
}

function AddListRow({ onAdd }) {
    const { t } = useTranslation();
    const { ref, focused } = useFocusable({ focusKey: 'list-add', onEnterPress: onAdd });
    useEffect(() => {
        if (focused) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [focused]);
    return (
        <div
            ref={ref}
            onClick={onAdd}
            className={[
                'flex items-center justify-center gap-2 rounded-xl px-3 border-2 border-dashed mb-4 min-h-[3rem] py-2 transition-colors',
                focused ? 'border-sky-500 bg-slate-800 text-slate-100' : 'border-slate-700 bg-slate-900 text-slate-400'
            ].join(' ')}
        >
            <PlusIcon className="h-5 w-5" />
            <span>{t('repoLists.add')}</span>
        </div>
    );
}

function RepoRow({ repo, isActive, focusKey, onSelect, onToggleLock, onPickVersion, onInstall, onDelete, versionInfo, clientReady, meta }) {
    const { t } = useTranslation();
    const [col, setCol] = useState(COL_NAME);

    const { ref, focused } = useFocusable({
        focusKey,
        onEnterPress: () => {
            if (col === COL_NAME)    onSelect();
            if (col === COL_LOCK)    onToggleLock();
            if (col === COL_VERSION) onPickVersion();
            if (col === COL_INSTALL) onInstall();
            if (col === COL_DELETE)  onDelete();
        },
        onArrowPress: (dir) => {
            if (dir === 'right' && col < COL_DELETE)  { setCol(c => c + 1); return false; }
            if (dir === 'left'  && col > COL_NAME)    { setCol(c => c - 1); return false; }
            return true;
        }
    });

    useEffect(() => { if (!focused) setCol(COL_NAME); }, [focused]);
    useEffect(() => {
        if (focused) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [focused]);

    // No meta = added by hand = locked. Unlocked repos follow their list(s).
    const locked = !meta || meta.locked;
    const fromList = meta && meta.sources && meta.sources.length ? fileOf(meta.sources[0]) : null;

    const hasUpdate = versionInfo && isUpdateAvailable(versionInfo.installedVersion, versionInfo.latestVersion);

    function ring(c) {
        if (!focused || col !== c) return '';
        return c === COL_DELETE ? 'ring-2 ring-red-400' : (c === COL_INSTALL || c === COL_VERSION || c === COL_LOCK) ? 'ring-2 ring-indigo-300' : 'ring-2 ring-white';
    }

    return (
        <div
            ref={ref}
            className={[
                'flex items-center gap-2 rounded-xl px-3 border-2 transition-colors mb-3',
                'min-h-[4rem] py-2',
                hasUpdate  ? 'border-amber-500 bg-amber-950/40'
                : isActive  ? 'border-violet-500 bg-violet-950'
                : focused   ? 'border-sky-500 bg-slate-800'
                            : 'border-slate-700 bg-slate-900'
            ].join(' ')}
        >
            {/* Name / select cell */}
            <div className={[
                'flex flex-col flex-1 min-w-0 rounded-lg px-3 py-1 transition-all',
                isActive ? 'bg-violet-800/40' : 'bg-slate-900/60',
                ring(COL_NAME)
            ].join(' ')}>
                <div className="flex items-center gap-2">
                    <CheckCircleIcon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-violet-300' : 'text-slate-600'}`} />
                    <span className={`font-mono text-base font-medium truncate ${isActive ? 'text-violet-200' : 'text-slate-200'}`}>
                        {repo}
                    </span>
                    {isActive && (
                        <span className="ml-auto flex-shrink-0 text-xs font-bold text-violet-300 bg-violet-700 px-2 py-0.5 rounded-full">
                            {t('savedRepos.active').toUpperCase()}
                        </span>
                    )}
                    {hasUpdate && (
                        <span className="ml-auto flex-shrink-0 text-xs font-bold text-amber-300 bg-amber-700 px-2 py-0.5 rounded-full">
                            UPDATE
                        </span>
                    )}
                </div>
                {fromList && (
                    <div className="ml-7 text-xs text-slate-500">{t('repoLists.from', { list: fromList })}</div>
                )}
                {/* Version info line */}
                {versionInfo && (
                    <div className="flex gap-3 mt-0.5 ml-7 text-xs">
                        {versionInfo.installedVersion && (
                            <span className="text-slate-400">
                                Installed: <span className="text-slate-200">{versionInfo.installedVersion}</span>
                            </span>
                        )}
                        {!versionInfo.installedVersion && (
                            <span className="text-slate-500">Not installed</span>
                        )}
                        {versionInfo.latestVersion && (
                            <span className={hasUpdate ? 'text-amber-400' : 'text-slate-400'}>
                                Latest: <span className={hasUpdate ? 'text-amber-300 font-semibold' : 'text-slate-200'}>{versionInfo.latestVersion}</span>
                                {versionInfo.latestSource === 'cache_fresh' ? ' (cached)' : ''}
                                {versionInfo.latestSource === 'cache_stale' ? ' (cached/offline)' : ''}
                            </span>
                        )}
                        {versionInfo.latestVersion === null && versionInfo.latestVersion !== undefined && (
                            <span className="text-slate-600">Latest: N/A</span>
                        )}
                        {versionInfo.latestVersion === undefined && (
                            <span className="text-slate-600 italic">checking...</span>
                        )}
                    </div>
                )}
            </div>

            {/* Lock: a locked repo is never removed when a repo list changes */}
            <div className={[
                'flex items-center justify-center w-10 h-10 rounded-lg text-white flex-shrink-0 transition-all',
                locked ? 'bg-emerald-800' : 'bg-slate-600',
                ring(COL_LOCK)
            ].join(' ')}>
                {locked ? <LockClosedIcon className="h-5 w-5" /> : <LockOpenIcon className="h-5 w-5" />}
            </div>

            {/* Pick a specific version */}
            <div className={[
                'flex items-center justify-center w-10 h-10 rounded-lg bg-slate-600 text-white flex-shrink-0 transition-all',
                !clientReady ? 'opacity-40' : '',
                ring(COL_VERSION)
            ].join(' ')}>
                <TagIcon className="h-5 w-5" />
            </div>

            {/* Install button — dimmed while client not ready */}
            <div className={[
                'flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 transition-all',
                hasUpdate ? 'bg-amber-600' : 'bg-indigo-700',
                !clientReady ? 'opacity-40' : '',
                'text-white',
                ring(COL_INSTALL)
            ].join(' ')}>
                <ArrowDownIcon className="h-5 w-5" />
            </div>

            {/* Delete button */}
            <div className={['flex items-center justify-center w-10 h-10 rounded-lg bg-red-800 text-white flex-shrink-0 transition-all', ring(COL_DELETE)].join(' ')}>
                <TrashIcon className="h-5 w-5" />
            </div>
        </div>
    );
}

export default function SavedRepos() {
    const { state, dispatch } = useContext(GlobalStateContext);
    const loc = useLocation();
    const { t } = useTranslation();
    const { repoList, tizenBrewRepo } = state.sharedData;
    const repoLists = state.sharedData.repoLists || [];
    const repoMeta = state.sharedData.repoMeta || {};
    const versionRefreshTick = state.sharedData.versionRefreshTick || 0;

    const clientReady = !!(state.client && state.client.socket && state.client.socket.readyState === WebSocket.OPEN);

    // versionMap: { [repo]: { latestVersion, installedVersion, updateAvailable } | undefined }
    // undefined means still loading
    const [versionMap, setVersionMap] = useState({});
    const [pickerIndex, setPickerIndex] = useState(null);

    useEffect(() => {
        const activeIndex = repoList.indexOf(tizenBrewRepo);
        setFocus(repoList.length ? `repo-row-${activeIndex >= 0 ? activeIndex : 0}` : 'list-add');
    }, []);

    // Pull in repo lists whenever this page opens (also picks up a list that
    // was just added), and tell the user what changed.
    function syncLists(announce) {
        return syncRepoLists(state.sharedData, dispatch).then(merged => {
            const toast = window.__globalToast;
            if (!merged || !toast) return;
            const added = merged.repoList.filter(r => repoList.indexOf(r) < 0).length;
            const removed = repoList.filter(r => merged.repoList.indexOf(r) < 0).length;
            const failed = merged.repoLists.filter(l => l.status === 'error').length;
            if (failed) toast.error(t('repoLists.syncFailed'), 5000);
            else if (added || removed) toast.success(t('repoLists.syncResult', { added, removed }), 4000);
            else if (announce) toast.info(t('repoLists.syncUpToDate'), 3000);
        }).catch(() => {});
    }

    useEffect(() => { syncLists(false); }, []);

    // Lists in display order: each top-level list followed by its nested ones.
    const orderedLists = [];
    (function walk(parent, depth) {
        repoLists.filter(l => (l.parent || null) === parent).forEach(l => {
            orderedLists.push({ list: l, depth });
            if (depth < 4) walk(l.id, depth + 1);
        });
    })(null, 0);

    useEffect(() => {
        if (repoList.length === 0) return;
        clearReleaseInfoCacheForMissingRepos(repoList);
        // Set all to undefined (loading) first
        const loading = {};
        repoList.forEach(r => { loading[r] = undefined; });
        setVersionMap(loading);

        fetchAllVersionInfo(repoList, true).then(results => {
            const map = {};
            results.forEach(r => { map[r.repo] = r; });
            setVersionMap(map);
        });
    }, [repoList.join(','), versionRefreshTick]);

    const updatable = repoList
        .map(r => versionMap[r])
        .filter(v => v && isUpdateAvailable(v.installedVersion, v.latestVersion));

    function runUpdateAll() {
        if (!state.client) return;
        startQueue(state.client, updatable, () => dispatch({ type: 'REFRESH_VERSIONS' }));
    }

    function selectRepo(repo) {
        dispatch({ type: 'SET_TIZENBREW_REPO', payload: repo });
        loc.route('/ui/dist/index.html');
        setFocus('sn:focusable-item-1');
    }

    function closePicker() {
        const i = pickerIndex;
        setPickerIndex(null);
        if (i !== null) setTimeout(() => setFocus(`repo-row-${i}`), 0);
    }

    // tag is optional: omitted = latest release, set = that specific release
    function installRepo(repo, tag) {
        // Guard: client may not be ready yet if the user navigated here fast
        if (!state.client) return;
        dispatch({ type: 'SET_TIZENBREW_REPO', payload: repo });
        state.client.send({ type: Events.InstallPackage, payload: tag ? { url: repo, tag } : { url: repo } });
        loc.route('/ui/dist/index.html');
        setFocus('sn:focusable-item-1');
    }

    function removeRepo(repo) {
        const removedIndex = repoList.indexOf(repo);
        dispatch({ type: 'REMOVE_REPO', payload: repo });

        const remaining = repoList.length - 1;
        if (remaining <= 0) return;
        const targetIndex = Math.min(removedIndex, remaining - 1);
        // Deleting unmounts the focused row; re-focus a remaining one once the
        // list has re-rendered with its shifted indices (same retry pattern
        // used elsewhere for post-navigation focus).
        [40, 120, 260].forEach(delay => setTimeout(() => setFocus(`repo-row-${targetIndex}`), delay));
    }

    return (
        <div className="flex flex-col items-center px-4 pt-4 overflow-y-auto" style={{ maxHeight: 'calc(92vh - 8vh)' }}>
            <h1 className="text-2xl font-bold text-violet-400 mb-2 text-center w-full">
                {t('savedRepos.pageTitle')}
            </h1>
            <p className="text-slate-400 text-sm mb-4 text-center">
                {t('savedRepos.pageDesc')}
            </p>

            <div className="w-full max-w-2xl flex flex-col">
                {updatable.length > 0 && clientReady && (
                    <UpdateAllRow count={updatable.length} onRun={runUpdateAll} />
                )}
                <h2 className="text-lg font-semibold text-slate-300 mb-2">{t('repoLists.title')}</h2>
                {orderedLists.map(({ list, depth }, i) => (
                    <ListRow
                        key={list.id}
                        list={list}
                        depth={depth}
                        focusKey={`list-row-${i}`}
                        onSync={() => syncLists(true)}
                        onToggle={() => dispatch({ type: 'TOGGLE_REPO_LIST', payload: list.id })}
                        onDelete={() => {
                            dispatch({ type: 'REMOVE_REPO_LIST', payload: list.id });
                            [40, 120, 260].forEach(delay => setTimeout(() => setFocus('list-add'), delay));
                        }}
                    />
                ))}
                <AddListRow onAdd={() => loc.route('/ui/dist/index.html/add-repo-list')} />

                <h2 className="text-lg font-semibold text-slate-300 mb-2">{t('repoLists.reposTitle')}</h2>
                {repoList.length === 0 ? (
                    <p className="text-slate-500 text-center py-10 text-lg">{t('savedRepos.empty')}</p>
                ) : (
                    repoList.map((repo, i) => (
                        <RepoRow
                            key={repo}
                            repo={repo}
                            isActive={repo === tizenBrewRepo}
                            focusKey={`repo-row-${i}`}
                            versionInfo={versionMap[repo]}
                            clientReady={clientReady}
                            meta={repoMeta[repo]}
                            onToggleLock={() => dispatch({ type: 'TOGGLE_REPO_LOCK', payload: repo })}
                            onSelect={() => selectRepo(repo)}
                            onPickVersion={() => state.client && setPickerIndex(i)}
                            onInstall={() => installRepo(repo)}
                            onDelete={() => removeRepo(repo)}
                        />
                    ))
                )}
            </div>

            {pickerIndex !== null && repoList[pickerIndex] && (
                <VersionPicker
                    repo={repoList[pickerIndex]}
                    installedVersion={versionMap[repoList[pickerIndex]]?.installedVersion}
                    onPick={(tag) => { setPickerIndex(null); installRepo(repoList[pickerIndex], tag); }}
                    onClose={closePicker}
                />
            )}

            {repoList.length > 0 && (
                <p className="mt-4 mb-2 text-slate-500 text-xs text-center">
                    {t('savedRepos.hint')}
                </p>
            )}
        </div>
    );
}