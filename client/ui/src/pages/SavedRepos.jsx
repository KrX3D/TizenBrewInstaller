import { useContext, useEffect } from 'preact/hooks';
import { GlobalStateContext } from '../components/ClientContext.jsx';
import { useLocation } from 'preact-iso';
import { useFocusable, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { CheckCircleIcon, TrashIcon, ArrowDownIcon } from '@heroicons/react/16/solid';
import { useTranslation } from 'react-i18next';
import { Events } from '../components/WebSocketClient.js';

function RepoItem({ repo, isActive, onSelect, onDelete, onInstall }) {
    const { ref, focused } = useFocusable();

    useEffect(() => {
        if (focused) {
            ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [focused, ref]);

    return (
        <div
            ref={ref}
            className={`flex items-center gap-3 py-4 px-5 rounded-xl border-2 cursor-pointer select-none
                ${isActive
                    ? 'border-violet-500 bg-violet-900/30'
                    : focused
                        ? 'border-sky-500 bg-slate-700'
                        : 'border-transparent bg-slate-900'}
            `}
            style={{ minHeight: 56 }}
            onClick={onSelect}
        >
            {/* Active indicator */}
            <CheckCircleIcon
                className={`h-6 w-6 flex-shrink-0 ${isActive ? 'text-violet-400' : 'text-slate-600'}`}
            />

            {/* Repo name */}
            <span className={`flex-1 font-mono text-lg font-medium truncate ${isActive ? 'text-violet-300' : 'text-slate-200'}`}>
                {repo}
            </span>

            {/* Install button */}
            <button
                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white text-sm font-semibold flex-shrink-0"
                onClick={(e) => { e.stopPropagation(); onInstall(); }}
                title="Install now"
            >
                <ArrowDownIcon className="h-4 w-4" />
            </button>

            {/* Delete button — don't allow deleting the last entry */}
            <button
                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-red-800 hover:bg-red-700 text-white text-sm font-semibold flex-shrink-0 ml-1"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                title="Remove from list"
            >
                <TrashIcon className="h-4 w-4" />
            </button>
        </div>
    );
}

export default function SavedRepos() {
    const { state, dispatch } = useContext(GlobalStateContext);
    const loc = useLocation();
    const { t } = useTranslation();
    const { repoList, tizenBrewRepo } = state.sharedData;

    useEffect(() => {
        setFocus('sn:focusable-item-1');
    }, [repoList]);

    function selectRepo(repo) {
        dispatch({ type: 'SET_TIZENBREW_REPO', payload: repo });
    }

    function removeRepo(repo) {
        dispatch({ type: 'REMOVE_REPO', payload: repo });
    }

    function installRepo(repo) {
        // Set as active and kick off an install immediately
        dispatch({ type: 'SET_TIZENBREW_REPO', payload: repo });
        state.client.send({
            type: Events.InstallPackage,
            payload: { url: repo }
        });
        loc.route('/ui/dist/index.html');
        setFocus('sn:focusable-item-1');
    }

    return (
        <div className="min-h-screen flex flex-col items-center px-2 pt-8">
            <h1 className="text-3xl font-bold text-violet-400 mb-2 text-center w-full">
                {t('savedRepos.pageTitle')}
            </h1>
            <p className="text-slate-400 text-base mb-6 text-center">
                {t('savedRepos.pageDesc')}
            </p>

            <div className="w-full max-w-2xl rounded-xl shadow-md p-6 bg-slate-900 flex flex-col gap-3">
                {repoList.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">{t('savedRepos.empty')}</p>
                ) : (
                    repoList.map((repo) => (
                        <RepoItem
                            key={repo}
                            repo={repo}
                            isActive={repo === tizenBrewRepo}
                            onSelect={() => selectRepo(repo)}
                            onDelete={() => removeRepo(repo)}
                            onInstall={() => installRepo(repo)}
                        />
                    ))
                )}
            </div>

            <p className="mt-4 text-slate-500 text-sm text-center">
                {t('savedRepos.hint')}
            </p>
        </div>
    );
}