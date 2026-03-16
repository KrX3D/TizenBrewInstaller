import { useContext, useEffect, useState } from 'preact/hooks';
import { GlobalStateContext } from '../components/ClientContext.jsx';
import { useLocation } from 'preact-iso';
import { useFocusable, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { PlusIcon, TrashIcon, CubeIcon } from '@heroicons/react/16/solid';
import { useTranslation } from 'react-i18next';
import { Events } from '../components/WebSocketClient.js';

// ─── Single module row ────────────────────────────────────────────────────────
function ModuleRow({ mod, focusKey, onRemove }) {
    const { ref, focused } = useFocusable({
        focusKey,
        onEnterPress: onRemove,
    });
    useEffect(() => {
        if (focused) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [focused]);

    return (
        <div
            ref={ref}
            className={[
                'flex items-center gap-3 rounded-xl px-3 border-2 transition-colors h-16',
                focused ? 'border-red-500 bg-slate-800' : 'border-slate-700 bg-slate-900'
            ].join(' ')}
        >
            <CubeIcon className="h-5 w-5 text-indigo-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
                <p className="text-slate-100 font-medium text-base truncate">{mod.name || '(unnamed)'}</p>
                <p className="text-slate-400 text-xs truncate">{mod.url}</p>
            </div>
            <div
                onClick={onRemove}
                className={[
                    'flex items-center justify-center w-10 h-10 rounded-lg bg-red-800 text-white flex-shrink-0',
                    focused ? 'ring-2 ring-red-400' : ''
                ].join(' ')}
            >
                <TrashIcon className="h-5 w-5" />
            </div>
        </div>
    );
}

// ─── Add-module form row ──────────────────────────────────────────────────────
function AddRow({ onAdd }) {
    const [name, setName]       = useState('');
    const [url, setUrl]         = useState('');
    const [field, setField]     = useState('name'); // which input is active
    const nameRef               = useRef(null);
    const urlRef                = useRef(null);
    const confirmedRef          = useRef(false);
    const { t }                 = useTranslation();

    const { ref: btnRef, focused: btnFocused } = useFocusable({
        focusKey: 'add-module-btn',
        onEnterPress: () => {
            if (name.trim() && url.trim()) onAdd(name.trim(), url.trim());
        }
    });

    function handleKeyDown(e, next) {
        if (e.keyCode === 13 || e.keyCode === 65376) {
            confirmedRef.current = true;
            e.target.blur();
            // Move to next field or button
            setTimeout(() => {
                if (next === 'url') { setField('url'); urlRef.current?.focus(); }
                else setFocus('add-module-btn');
            }, 50);
        }
    }

    return (
        <div className="flex flex-col gap-2 rounded-xl border-2 border-indigo-700 bg-slate-900 px-4 py-3 mt-2">
            <p className="text-indigo-300 font-semibold text-sm">{t('tbModules.addTitle')}</p>
            <input
                ref={nameRef}
                type="text"
                value={name}
                placeholder={t('tbModules.namePlaceholder')}
                className="w-full p-2 rounded-lg bg-slate-800 text-slate-100 text-sm border border-slate-600"
                onChange={e => setName(e.target.value)}
                onKeyDown={e => handleKeyDown(e, 'url')}
            />
            <input
                ref={urlRef}
                type="text"
                value={url}
                placeholder={t('tbModules.urlPlaceholder')}
                className="w-full p-2 rounded-lg bg-slate-800 text-slate-100 text-sm border border-slate-600"
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => handleKeyDown(e, 'btn')}
            />
            <div
                ref={btnRef}
                onClick={() => { if (name.trim() && url.trim()) onAdd(name.trim(), url.trim()); }}
                className={[
                    'flex items-center justify-center gap-2 px-4 py-2 rounded-lg',
                    'bg-indigo-600 text-white font-semibold text-sm cursor-pointer',
                    btnFocused ? 'ring-2 ring-white' : ''
                ].join(' ')}
            >
                <PlusIcon className="h-5 w-5" />
                {t('tbModules.addButton')}
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
import { useRef } from 'preact/hooks';

export default function ManageModules() {
    const { state } = useContext(GlobalStateContext);
    const { t } = useTranslation();
    const modules = state.sharedData.tbModules;

    useEffect(() => {
        // Load current modules on mount
        state.client.send({ type: Events.GetTBModules });
        // Focus first module row or the add button
        setTimeout(() => setFocus(modules.length > 0 ? 'module-row-0' : 'add-module-btn'), 100);
    }, []);

    function addModule(name, url) {
        state.client.send({ type: Events.AddTBModule, payload: { name, url } });
    }

    function removeModule(url) {
        state.client.send({ type: Events.RemoveTBModule, payload: { url } });
    }

    return (
        <div className="flex flex-col items-center px-4 pt-4 overflow-y-auto" style={{ maxHeight: 'calc(92vh - 8vh)' }}>
            <h1 className="text-2xl font-bold text-indigo-400 mb-1 text-center w-full">
                {t('tbModules.pageTitle')}
            </h1>
            <p className="text-slate-400 text-sm mb-4 text-center">
                {t('tbModules.pageDesc')}
            </p>

            <div className="w-full max-w-2xl flex flex-col gap-2">
                {modules.length === 0 ? (
                    <p className="text-slate-500 text-center py-6 text-base">{t('tbModules.empty')}</p>
                ) : (
                    modules.map((mod, i) => (
                        <ModuleRow
                            key={mod.url}
                            mod={mod}
                            focusKey={`module-row-${i}`}
                            onRemove={() => removeModule(mod.url)}
                        />
                    ))
                )}

                <AddRow onAdd={addModule} />
            </div>

            <p className="mt-4 mb-2 text-slate-500 text-xs text-center">
                {t('tbModules.hint')}
            </p>
        </div>
    );
}