import { useContext, useEffect, useState } from 'preact/hooks';
import { useFocusable, setFocus, FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import { useTranslation } from 'react-i18next';
import { GlobalStateContext } from './ClientContext.jsx';
import { subscribeQueue, cancelQueue, dismissQueue } from '../utils/installQueue.js';

function StatusIcon({ status }) {
    if (status === 'running') {
        return (
            <svg className="animate-spin h-5 w-5 text-sky-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
        );
    }
    if (status === 'done') return <span className="text-emerald-400 font-bold w-5 text-center">&#10003;</span>;
    if (status === 'failed') return <span className="text-red-400 font-bold w-5 text-center">&#10007;</span>;
    if (status === 'skipped') return <span className="text-slate-600 w-5 text-center">-</span>;
    return <span className="text-slate-500 w-5 text-center">&#8226;</span>;
}

// Global overlay for the "update all" queue: counter, one line per repo with
// its result, the current install step, and a Cancel / Close button.
// The focus hooks live in QueuePanel so nothing is focusable while hidden.
export default function InstallQueueOverlay() {
    const [queue, setQueue] = useState({ items: [], active: false, finished: false });
    useEffect(() => subscribeQueue(setQueue), []);
    return queue.items.length > 0 ? <QueuePanel queue={queue} /> : null;
}

function QueuePanel({ queue }) {
    const { t } = useTranslation();
    const { state } = useContext(GlobalStateContext);

    const { ref, focusKey } = useFocusable({
        focusKey: 'install-queue',
        isFocusBoundary: true,
        focusBoundaryDirections: ['up', 'down', 'left', 'right']
    });

    function act() {
        if (queue.active) cancelQueue();
        else dismissQueue();
    }

    const { ref: btnRef, focused } = useFocusable({ focusKey: 'install-queue-btn', onEnterPress: act });

    useEffect(() => {
        window.__backInterceptor = () => { act(); return true; };
        return () => { window.__backInterceptor = null; };
    }, [queue.active]);

    useEffect(() => { setTimeout(() => setFocus('install-queue-btn'), 0); }, []);

    const total = queue.items.length;
    const doneCount = queue.items.filter(i => i.status === 'done').length;
    const failedCount = queue.items.filter(i => i.status === 'failed').length;
    const runningIdx = queue.items.findIndex(i => i.status === 'running');
    const step = state.sharedData.state;

    return (
        <FocusContext.Provider value={focusKey}>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
                <div ref={ref} className="w-full max-w-xl mx-4 rounded-2xl bg-slate-900 border-2 border-violet-500 p-5 shadow-2xl">
                    <h2 className="text-xl font-bold text-violet-300 mb-1">
                        {queue.active
                            ? t('queue.title', { current: runningIdx >= 0 ? runningIdx + 1 : total, total })
                            : t('queue.finished', { done: doneCount, total })}
                    </h2>
                    {queue.active && step && <p className="text-sm text-sky-300 mb-2">{t(step)}</p>}
                    {!queue.active && failedCount > 0 && <p className="text-sm text-red-400 mb-2">{t('queue.failedCount', { count: failedCount })}</p>}

                    <div className="overflow-y-auto my-2" style={{ maxHeight: '40vh' }}>
                        {queue.items.map(item => (
                            <div key={item.repo} className="flex items-start gap-3 py-1.5 border-b border-slate-800">
                                <StatusIcon status={item.status} />
                                <div className="min-w-0 flex-1">
                                    <div className="font-mono text-sm text-slate-200 truncate">{item.repo}</div>
                                    <div className="text-xs text-slate-400">
                                        {item.from} &rarr; {item.to}
                                        {item.status === 'failed' && item.error ? ' · ' + item.error : ''}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div
                        ref={btnRef}
                        onClick={act}
                        className={[
                            'mt-3 rounded-lg px-3 py-2 text-center border-2 transition-colors',
                            focused ? 'border-sky-400 bg-slate-700' : 'border-slate-700 bg-slate-800'
                        ].join(' ')}
                    >
                        {queue.active ? t('queue.cancel') : t('queue.close')}
                    </div>
                </div>
            </div>
        </FocusContext.Provider>
    );
}
