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
                'px-12 py-5 rounded-2xl text-2xl font-semibold transition-all min-w-[10vw]',
                focused
                    ? 'bg-indigo-500 text-white focus'
                    : 'bg-slate-700 text-slate-200'
            ].join(' ')}
        >
            {children}
        </button>
    );
}

/**
 * Props:
 *   message    string  — question, \n splits into sub-line
 *   onConfirm  fn
 *   onCancel   fn
 *
 * Does NOT restore focus on unmount — caller handles that.
 */
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
            <div className="bg-slate-800 rounded-2xl shadow-2xl px-14 py-12 max-w-[65vw] min-w-[38vw] flex flex-col items-center border border-slate-600"
                 style={{ gap: '3vh' }}>
                {/* Text block */}
                <div className="text-center" style={{ paddingBottom: '1vh' }}>
                    <p className="text-white text-2xl leading-relaxed">{mainLine}</p>
                    {subLines.map((line, i) => (
                        <p key={i} className="text-slate-400 text-lg mt-3 font-mono break-all">{line}</p>
                    ))}
                </div>
                {/* Button row */}
                <div className="flex" style={{ gap: '4vw' }}>
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