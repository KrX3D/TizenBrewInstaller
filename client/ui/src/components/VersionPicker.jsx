import { useEffect, useRef, useState } from 'preact/hooks';
import { useFocusable, setFocus, FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import { useTranslation } from 'react-i18next';
import { fetchReleaseList } from '../utils/versionInfo.js';

// onArrow(dir) may return a focus key to jump to explicitly. Spatial navigation
// alone doesn't reliably leave the scrolling list for the buttons below it.
function Option({ focusKey, onPress, onArrow, children, className }) {
    const { ref, focused } = useFocusable({
        focusKey,
        onEnterPress: onPress,
        onArrowPress: (dir) => {
            const target = onArrow && onArrow(dir);
            if (target) { setFocus(target); return false; }
            return true;
        }
    });
    useEffect(() => {
        if (focused) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [focused]);
    return (
        <div
            ref={ref}
            onClick={onPress}
            className={[
                'flex items-center gap-2 rounded-lg px-3 py-2 mb-2 border-2 transition-colors',
                focused ? 'border-sky-400 bg-slate-700' : 'border-slate-700 bg-slate-800',
                className || ''
            ].join(' ')}
        >
            {children}
        </div>
    );
}

function Badge({ color, children }) {
    return <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${color}`}>{children}</span>;
}

// Modal list of a repo's GitHub releases. Focus is trapped inside while open;
// Back closes it (via the window.__backInterceptor hook read in main.jsx).
export default function VersionPicker({ repo, installedVersion, onPick, onClose }) {
    const { t } = useTranslation();
    const [releases, setReleases] = useState(null);
    const [failed, setFailed] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const { ref, focusKey } = useFocusable({
        focusKey: 'version-picker',
        isFocusBoundary: true,
        focusBoundaryDirections: ['up', 'down', 'left', 'right']
    });

    useEffect(() => {
        window.__backInterceptor = () => { onClose(); return true; };
        return () => { window.__backInterceptor = null; };
    }, [onClose]);

    useEffect(() => {
        let cancelled = false;
        setFocus('version-close');
        fetchReleaseList(repo, 1)
            .then(r => { if (!cancelled) { setReleases(r.items); setHasMore(r.hasMore); } })
            .catch(() => { if (!cancelled) { setFailed(true); setReleases([]); } });
        return () => { cancelled = true; };
    }, [repo]);

    function loadMore() {
        if (loadingMore) return;
        const prevLen = releases.length;
        setLoadingMore(true);
        fetchReleaseList(repo, page + 1)
            .then(r => {
                // Skip tags already shown (a new release can shift pages).
                const seen = new Set(releases.map(x => x.tag));
                setReleases(releases.concat(r.items.filter(x => !seen.has(x.tag))));
                setHasMore(r.hasMore);
                setPage(page + 1);
                setLoadingMore(false);
                setTimeout(() => setFocus(r.items.length ? `version-opt-${prevLen}` : 'version-close'), 0);
            })
            .catch(() => { setLoadingMore(false); setFailed(true); });
    }

    // Initial focus only. Without the guard this also ran after "load more"
    // (releases changed) and threw focus back to the top of the list.
    const initialFocusDone = useRef(false);
    useEffect(() => {
        if (!releases || releases.length === 0 || initialFocusDone.current) return;
        initialFocusDone.current = true;
        const installedIdx = releases.findIndex(r => r.version === installedVersion);
        setFocus(`version-opt-${installedIdx >= 0 ? installedIdx : 0}`);
    }, [releases]);

    const lastKey = releases && releases.length ? `version-opt-${releases.length - 1}` : null;
    const footerKey = hasMore ? 'version-more' : 'version-close';

    const latestIdx = releases ? releases.findIndex(r => !r.prerelease) : -1;

    return (
        <FocusContext.Provider value={focusKey}>
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
                <div ref={ref} className="w-full max-w-xl mx-4 rounded-2xl bg-slate-900 border-2 border-violet-500 p-4 shadow-2xl">
                    <h2 className="text-xl font-bold text-violet-300">{t('savedRepos.pickerTitle')}</h2>
                    <p className="font-mono text-sm text-slate-400 mb-3 truncate">{repo}</p>

                    <div className="overflow-y-auto pr-1" style={{ maxHeight: '50vh' }}>
                        {releases === null && <p className="text-slate-400 py-4 text-center">{t('savedRepos.pickerLoading')}</p>}
                        {failed && <p className="text-amber-400 py-4 text-center">{t('savedRepos.pickerError')}</p>}
                        {releases && !failed && releases.length === 0 && (
                            <p className="text-slate-400 py-4 text-center">{t('savedRepos.pickerEmpty')}</p>
                        )}
                        {releases && releases.map((r, i) => (
                            <Option
                                key={r.tag}
                                focusKey={`version-opt-${i}`}
                                onPress={() => onPick(r.tag)}
                                onArrow={(dir) => (dir === 'down' && i === releases.length - 1) ? footerKey
                                    : (dir === 'up' && i === 0) ? 'version-close' : null}
                            >
                                <span className="font-mono text-base text-slate-100">{r.tag}</span>
                                {i === latestIdx && <Badge color="bg-indigo-600">{t('savedRepos.pickerLatest')}</Badge>}
                                {r.version === installedVersion && <Badge color="bg-emerald-700">{t('savedRepos.pickerInstalled')}</Badge>}
                                {r.prerelease && <Badge color="bg-amber-700">{t('savedRepos.pickerPrerelease')}</Badge>}
                                {r.publishedAt && <span className="ml-auto text-xs text-slate-400">{r.publishedAt}</span>}
                            </Option>
                        ))}
                    </div>

                    {hasMore && (
                        <Option
                            focusKey="version-more"
                            onPress={loadMore}
                            onArrow={(dir) => dir === 'up' ? lastKey : dir === 'down' ? 'version-close' : null}
                            className="justify-center mt-2 mb-0">
                            <span className="text-sky-300">{loadingMore ? t('savedRepos.pickerLoading') : t('savedRepos.pickerLoadMore')}</span>
                        </Option>
                    )}

                    <Option
                        focusKey="version-close"
                        onPress={onClose}
                        onArrow={(dir) => dir === 'up' ? (hasMore ? 'version-more' : lastKey) : null}
                        className="justify-center mt-2 mb-0">
                        <span className="text-slate-200">{t('savedRepos.pickerClose')}</span>
                    </Option>
                </div>
            </div>
        </FocusContext.Provider>
    );
}
