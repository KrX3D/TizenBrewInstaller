import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { useEffect } from 'preact/hooks';
import { useTranslation } from 'react-i18next';

function ModalButton({ children, onClick, focusKey, autoFocus }) {
    const { ref, focused, focusSelf } = useFocusable({ focusKey, onEnterPress: onClick });
    useEffect(() => { if (autoFocus) focusSelf(); }, []);
    return (
        <button
            ref={ref}
            onClick={onClick}
            className={[
                'px-8 py-3 rounded-xl text-xl font-semibold transition-all min-w-[8vw]',
                focused
                    ? 'bg-indigo-500 text-white focus'
                    : 'bg-slate-700 text-slate-200'
            ].join(' ')}
        >
            {children}
        </button>
    );
}

export default function ConfirmModal({ message, onConfirm, onCancel }) {
    const { t } = useTranslation();

    // Back button → cancel
    useEffect(() => {
        function onKey(e) {
            if (e.keyCode === 10009) { e.preventDefault(); e.stopPropagation(); onCancel(); }
        }
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [onCancel]);

    const lines    = (message || '').split('\n');
    const mainLine = lines[0];
    const subLines = lines.slice(1);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-slate-800 rounded-2xl shadow-2xl px-12 py-10 max-w-[60vw] min-w-[35vw] flex flex-col items-center gap-8 border border-slate-600">
                <div className="text-center">
                    <p className="text-white text-2xl leading-relaxed">{mainLine}</p>
                    {subLines.map((line, i) => (
                        <p key={i} className="text-slate-400 text-lg mt-3 font-mono break-all">{line}</p>
                    ))}
                </div>
                <div className="flex gap-6">
                    <ModalButton focusKey="modal-cancel" autoFocus onClick={onCancel}>
                        {t('modal.cancel')}
                    </ModalButton>
                    <ModalButton focusKey="modal-confirm" onClick={onConfirm}>
                        {t('modal.ok')}
                    </ModalButton>
                </div>
            </div>
        </div>
    );
}