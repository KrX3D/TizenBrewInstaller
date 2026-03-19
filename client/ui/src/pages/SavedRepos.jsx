import { useContext, useEffect, useState } from 'preact/hooks';
import { GlobalStateContext } from '../components/ClientContext.jsx';
import { useLocation } from 'preact-iso';
import { useFocusable, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { CheckCircleIcon, TrashIcon, ArrowDownIcon } from '@heroicons/react/16/solid';
import { useTranslation } from 'react-i18next';
import { Events } from '../components/WebSocketClient.js';
import { fetchAllVersionInfo, isUpdateAvailable } from '../utils/versionInfo.js';

const COL_NAME    = 0;
const COL_INSTALL = 1;
const COL_DELETE  = 2;

function RepoRow({ repo, isActive, focusKey, onSelect, onInstall, onDelete, versionInfo }) {
    const { t } = useTranslation();
    const [col, setCol] = useState(COL_NAME);

    const { ref, focused } = useFocusable({
        focusKey,
        onEnterPress: () => {
            if (col === COL_NAME)    onSelect();
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

    const hasUpdate = versionInfo && isUpdateAvailable(versionInfo.installedVersion, versionInfo.latestVersion);

    function ring(c) {
        if (!focused || col !== c) return '';
        return c === COL_DELETE ? 'ring-2 ring-red-400' : c === COL_INSTALL ? 'ring-2 ring-indigo-300' : 'ring-2 ring-white';
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

            {/* Install button */}
            <div className={[
                'flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 transition-all',
                hasUpdate ? 'bg-amber-600' : 'bg-indigo-700',
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

    // versionMap: { [repo]: { latestVersion, installedVersion, updateAvailable } | undefined }
    // undefined means still loading
    const [versionMap, setVersionMap] = useState({});

    useEffect(() => {
        const activeIndex = repoList.indexOf(tizenBrewRepo);
        const targetKey = `repo-row-${activeIndex >= 0 ? activeIndex : 0}`;
        setFocus(targetKey);
    }, []);

    useEffect(() => {
        if (repoList.length === 0) return;
        // Set all to undefined (loading) first
        const loading = {};
        repoList.forEach(r => { loading[r] = undefined; });
        setVersionMap(loading);

        fetchAllVersionInfo(repoList).then(results => {
            const map = {};
            results.forEach(r => { map[r.repo] = r; });
            setVersionMap(map);
        });
    }, [repoList.join(',')]);

    function selectRepo(repo) {
        dispatch({ type: 'SET_TIZENBREW_REPO', payload: repo });
        loc.route('/ui/dist/index.html');
        setFocus('sn:focusable-item-1');
    }

    function installRepo(repo) {
        dispatch({ type: 'SET_TIZENBREW_REPO', payload: repo });
        state.client.send({ type: Events.InstallPackage, payload: { url: repo } });
        loc.route('/ui/dist/index.html');
        setFocus('sn:focusable-item-1');
    }

    function removeRepo(repo) {
        dispatch({ type: 'REMOVE_REPO', payload: repo });
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
                            onSelect={() => selectRepo(repo)}
                            onInstall={() => installRepo(repo)}
                            onDelete={() => removeRepo(repo)}
                        />
                    ))
                )}
            </div>

            {repoList.length > 0 && (
                <p className="mt-4 mb-2 text-slate-500 text-xs text-center">
                    {t('savedRepos.hint')}
                </p>
            )}
        </div>
    );
}