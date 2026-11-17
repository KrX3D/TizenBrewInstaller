import { useState, useContext, useRef, useEffect } from 'preact/hooks';
import { GlobalStateContext } from '../components/ClientContext.jsx';
import { useFocusable, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useTranslation } from 'react-i18next';
import qrcode from 'qrcode-generator';
import { Events } from '../components/WebSocketClient.js';
import { useGitHubToken, setGitHubToken, looksLikeGitHubToken, maskToken } from '../utils/githubToken.js';

function QrCode({ text }) {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    // createSvgTag keeps it sharp at any TV resolution.
    const svg = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    return <div className="bg-white rounded-lg p-2 w-[24vh] h-[24vh]" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function FocusButton({ focusKey, onPress, className, children }) {
    const { ref, focused } = useFocusable({ focusKey, onEnterPress: onPress });
    return (
        <button
            ref={ref}
            onClick={onPress}
            className={`px-4 py-2 rounded-lg text-white ${className} ${focused ? 'ring-4 ring-violet-400' : ''}`}
        >
            {children}
        </button>
    );
}

export default function GitHubToken() {
    const { state } = useContext(GlobalStateContext);
    const { t } = useTranslation();
    const token = useGitHubToken();
    const [value, setValue] = useState('');
    const [message, setMessage] = useState(null);
    const inputRef = useRef(null);
    const confirmedRef = useRef(false);
    const urls = state.sharedData.githubTokenUrls || [];

    // Ask the service for the TV's address for the QR code.
    useEffect(() => {
        if (state.client && state.client.socket && state.client.socket.readyState === WebSocket.OPEN) {
            state.client.send({ type: Events.GitHubTokenAddress });
        }
    }, [state.client]);

    useEffect(() => {
        [60, 200].forEach(delay => setTimeout(() => setFocus('token-input-wrap'), delay));
    }, []);

    const { ref: inputWrapRef, focused: inputWrapFocused } = useFocusable({
        focusKey: 'token-input-wrap',
        onEnterPress: () => inputRef.current && inputRef.current.focus()
    });

    function save() {
        const v = value.trim();
        if (!v) return;
        if (!looksLikeGitHubToken(v)) {
            setMessage({ error: true, text: t('githubToken.invalid') });
            return;
        }
        setGitHubToken(v);
        setValue('');
        setMessage({ error: false, text: t('githubToken.savedMsg') });
    }

    function remove() {
        setGitHubToken('');
        setMessage({ error: false, text: t('githubToken.removedMsg') });
        setFocus('token-input-wrap');
    }

    return (
        <div className="flex flex-col items-center px-4 pt-4 overflow-y-auto" style={{ maxHeight: 'calc(92vh - 8vh)' }}>
            <h1 className="text-2xl font-bold text-violet-400 mb-2 text-center">{t('githubToken.title')}</h1>
            <p className="text-slate-400 text-sm mb-4 text-center max-w-3xl">{t('githubToken.explain')}</p>

            <p className={`text-base mb-4 ${token ? 'text-emerald-400' : 'text-slate-400'}`}>
                {token ? t('githubToken.saved', { token: maskToken(token) }) : t('githubToken.none')}
            </p>

            <div className="flex flex-wrap justify-center gap-8 w-full max-w-5xl">
                <div className="flex flex-col items-center bg-gray-900 rounded-3xl p-6 max-w-md">
                    <h2 className="text-lg font-semibold text-slate-200 mb-3">{t('githubToken.phoneTitle')}</h2>
                    {urls.length > 0 ? (
                        <>
                            <QrCode text={urls[0]} />
                            <p className="mt-3 text-sm text-slate-300 break-all text-center">{urls[0]}</p>
                            <p className="mt-2 text-xs text-slate-400 text-center">{t('githubToken.phoneHint')}</p>
                        </>
                    ) : (
                        <p className="text-sm text-slate-500">{t('githubToken.noAddress')}</p>
                    )}
                </div>

                <div className="flex flex-col bg-gray-900 rounded-3xl p-6 max-w-md w-full">
                    <h2 className="text-lg font-semibold text-slate-200 mb-3">{t('githubToken.manualTitle')}</h2>
                    <div ref={inputWrapRef} className={`rounded-lg ${inputWrapFocused ? 'ring-4 ring-violet-400' : ''}`}>
                        <input
                            type="text"
                            autoCapitalize="off"
                            autoCorrect="off"
                            autoComplete="off"
                            spellCheck={false}
                            ref={inputRef}
                            value={value}
                            className="w-full p-2 rounded-lg bg-gray-800 text-gray-200"
                            onChange={(e) => { setValue(e.target.value); setMessage(null); }}
                            onKeyDown={(e) => {
                                if (e.keyCode === 37 || e.keyCode === 39) { e.stopPropagation(); return; }
                                if (e.keyCode === 13 || e.keyCode === 65376) {
                                    confirmedRef.current = true;
                                    inputRef.current.blur();
                                }
                            }}
                            onBlur={() => {
                                if (confirmedRef.current) {
                                    confirmedRef.current = false;
                                    save();
                                }
                            }}
                            placeholder="github_pat_... / ghp_..."
                        />
                    </div>
                    <p className="mt-2 text-xs text-slate-400">{t('githubToken.manualHint')}</p>
                    <div className="flex gap-3 mt-4">
                        <FocusButton focusKey="token-save" onPress={save} className="bg-violet-700">{t('githubToken.save')}</FocusButton>
                        {token && (
                            <FocusButton focusKey="token-remove" onPress={remove} className="bg-red-800">{t('githubToken.remove')}</FocusButton>
                        )}
                    </div>
                    {message && (
                        <p className={`mt-3 text-sm ${message.error ? 'text-red-400' : 'text-emerald-400'}`}>{message.text}</p>
                    )}
                </div>
            </div>
        </div>
    );
}
