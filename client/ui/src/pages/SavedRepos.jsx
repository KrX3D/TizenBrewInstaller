import { useContext, useEffect, useState } from 'preact/hooks';
import { GlobalStateContext } from '../components/ClientContext.jsx';
import { useLocation } from 'preact-iso';
import { useFocusable, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { CheckCircleIcon, TrashIcon, ArrowDownIcon } from '@heroicons/react/16/solid';
import { useTranslation } from 'react-i18next';
import { Events } from '../components/WebSocketClient.js';

// Columns within each row
const COL_NAME    = 0;
const COL_INSTALL = 1;
const COL_DELETE  = 2;

function RepoRow({ repo, isActive, onSelect, onInstall, onDelete }) {
    const [col, setCol] = useState(COL_NAME);

    const { ref, focused } = useFocusable({
        // Enter/OK fires the currently highlighted column's action
        onEnterPress: () => {
            if (col === COL_NAME)    onSelect();
            if (col === COL_INSTALL) onInstall();
            if (col === COL_DELETE)  onDelete();
        },
        // Left/right cycles columns; up/down falls through to spatial nav
        onArrowPress: (direction) => {
            if (direction === 'right' && col < COL_DELETE) {
                setCol(c => c + 1);
                return false; // consumed — don't move focus to another row
            }
            if (direction === 'left' && col > COL_NAME) {
                setCol(c => c - 1);
                return false;
            }
            return true; // let spatial nav handle up/down (and left/right at boundary)
        }
    });

    // Reset column when focus leaves this row
    useEffect(() => {
        if (!focused) setCol(COL_NAME);
    }, [focused]);

    useEffect(() => {
        if (focused) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [focused]);

    const rowBase = `flex items-center gap-2 rounded-xl px-3 py-3 border-2 transition-colors select-none`;
    const rowColor = isActive
        ? 'border-violet-500 bg-violet-950'
        : focused
            ? 'border-sky-500 bg-slate-800'
            : 'border-slate-700 bg-slate-900';

    // Per-cell highlight: bright ring when this row is focused AND this column is selected
    function cellRing(c) {
        if (!focused) return '';
        if (col !== c) return '';
        if (c === COL_DELETE)  return 'ring-2 ring-red-400';
        if (c === COL_INSTALL) return 'ring-2 ring-indigo-300';
        return 'ring-2 ring-white';
    }

    return (
        <div ref={ref} className={`${rowBase} ${rowColor}`}>
            {/* ── Name / select cell ── */}
            <div className={`flex items-center gap-3 flex-1 min-w-0 rounded-lg px-3 py-2 transition-all
                ${isActive ? 'bg-violet-800/40' : 'bg-slate-900/60'}
                ${cellRing(COL_NAME)}`}>
                <CheckCircleIcon
                    className={`h-6 w-6 flex-shrink-0 ${isActive ? 'text-violet-300' : 'text-slate-600'}`}
                />
                <span className={`font-mono text-lg font-medium truncate
                    ${isActive ? 'text-violet-200' : 'text-slate-200'}`}>
                    {repo}
                </span>
                {isActive && (
                    <span className="ml-auto flex-shrink-0 text-xs font-bold text-violet-300 bg-violet-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                        ACTIVE
                    </span>
                )}
            </div>

            {/* ── Install button ── */}
            <div className={`flex items-center justify-center gap-1 px-4 py-2 rounded-lg
                bg-indigo-700 text-white text-sm font-semibold flex-shrink-0 transition-all
                ${cellRing(COL_INSTALL)}`}>
                <ArrowDownIcon className="h-5 w-5" />
            </div>

            {/* ── Delete button ── */}
            <div className={`flex items-center justify-center gap-1 px-4 py-2 rounded-lg
                bg-red-800 text-white text-sm font-semibold flex-shrink-0 transition-all
                ${cellRing(COL_DELETE)}`}>
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

    // Focus first row on mount
    useEffect(() => {
        setFocus('sn:focusable-item-1');
    }, []);

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
            <h1 className="text-2xl font-bold text-violet-400 mb-4 text-center w-full">
                {t('savedRepos.pageTitle')}
            </h1>

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

            {/* Key legend at bottom */}
            {repoList.length > 0 && (
                <p className="mt-4 mb-2 text-slate-500 text-xs text-center">
                    ◀▶ switch action &nbsp;|&nbsp; OK = confirm &nbsp;|&nbsp; ▲▼ switch repo
                </p>
            )}
        </div>
    );
}