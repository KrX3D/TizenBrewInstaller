import { useContext, useEffect } from 'preact/hooks';
import { GlobalStateContext } from '../components/ClientContext.jsx';
import { useLocation } from 'preact-iso';
import { useFocusable, FocusContext, init } from '@noriginmedia/norigin-spatial-navigation';
import { CheckCircleIcon, TrashIcon, ArrowDownIcon } from '@heroicons/react/16/solid';
import { useTranslation } from 'react-i18next';
import { Events } from '../components/WebSocketClient.js';

// ─── Single focusable action cell ───────────────────────────────────────────
function FocusableCell({ children, onEnter, className = '' }) {
    const { ref, focused } = useFocusable({ onEnterPress: onEnter });

    useEffect(() => {
        if (focused) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [focused]);

    return (
        <div
            ref={ref}
            onClick={onEnter}
            className={`${className} ${focused ? 'ring-2 ring-white scale-105' : ''} transition-all duration-100 cursor-pointer`}
            style={{ outline: 'none' }}
        >
            {children}
        </div>
    );
}

// ─── One repo row: [name cell] [install cell] [delete cell] ─────────────────
function RepoRow({ repo, isActive, onSelect, onInstall, onDelete }) {
    return (
        <div
            className={`flex items-center gap-2 rounded-xl px-3 py-3 border-2 transition-colors
                ${isActive ? 'border-violet-500 bg-violet-950' : 'border-slate-700 bg-slate-900'}`}
        >
            {/* Name / select cell — pressing OK selects the repo and goes home */}
            <FocusableCell
                onEnter={onSelect}
                className={`flex items-center gap-3 flex-1 min-w-0 rounded-lg px-3 py-2
                    ${isActive ? 'bg-violet-800/40' : 'bg-slate-800'}`}
            >
                <CheckCircleIcon
                    className={`h-6 w-6 flex-shrink-0 ${isActive ? 'text-violet-300' : 'text-slate-600'}`}
                />
                <span className={`font-mono text-lg font-medium truncate
                    ${isActive ? 'text-violet-200' : 'text-slate-200'}`}>
                    {repo}
                </span>
                {isActive && (
                    <span className="ml-auto flex-shrink-0 text-xs font-bold text-violet-300 bg-violet-700 px-2 py-0.5 rounded-full">
                        ACTIVE
                    </span>
                )}
            </FocusableCell>

            {/* Install now cell */}
            <FocusableCell
                onEnter={onInstall}
                className="flex items-center justify-center gap-1 px-4 py-2 rounded-lg bg-indigo-700 text-white text-sm font-semibold flex-shrink-0"
            >
                <ArrowDownIcon className="h-5 w-5" />
                <span className="hidden sm:inline">Install</span>
            </FocusableCell>

            {/* Delete cell */}
            <FocusableCell
                onEnter={onDelete}
                className="flex items-center justify-center gap-1 px-4 py-2 rounded-lg bg-red-800 text-white text-sm font-semibold flex-shrink-0"
            >
                <TrashIcon className="h-5 w-5" />
            </FocusableCell>
        </div>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function SavedRepos() {
    const { state, dispatch } = useContext(GlobalStateContext);
    const loc = useLocation();
    const { t } = useTranslation();
    const { repoList, tizenBrewRepo } = state.sharedData;

    function selectRepo(repo) {
        dispatch({ type: 'SET_TIZENBREW_REPO', payload: repo });
        loc.route('/ui/dist/index.html');
    }

    function installRepo(repo) {
        dispatch({ type: 'SET_TIZENBREW_REPO', payload: repo });
        state.client.send({ type: Events.InstallPackage, payload: { url: repo } });
        loc.route('/ui/dist/index.html');
    }

    function removeRepo(repo) {
        dispatch({ type: 'REMOVE_REPO', payload: repo });
    }

    return (
        <div className="flex flex-col items-center px-4 pt-6 pb-8 overflow-y-auto max-h-[92vh]">
            <h1 className="text-3xl font-bold text-violet-400 mb-1 text-center w-full">
                {t('savedRepos.pageTitle')}
            </h1>
            <p className="text-slate-400 text-base mb-5 text-center max-w-xl">
                {t('savedRepos.pageDesc')}
            </p>

            <div className="w-full max-w-2xl flex flex-col gap-3">
                {repoList.length === 0 ? (
                    <p className="text-slate-500 text-center py-10 text-lg">{t('savedRepos.empty')}</p>
                ) : (
                    repoList.map((repo) => (
                        <RepoRow
                            key={repo}
                            repo={repo}
                            isActive={repo === tizenBrewRepo}
                            onSelect={() => selectRepo(repo)}
                            onInstall={() => installRepo(repo)}
                            onDelete={() => removeRepo(repo)}
                        />
                    ))
                )}
            </div>

            <p className="mt-6 text-slate-500 text-sm text-center max-w-lg">
                {t('savedRepos.hint')}
            </p>
        </div>
    );
}