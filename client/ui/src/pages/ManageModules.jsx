import { useContext, useEffect, useState, useRef } from 'preact/hooks';
import { GlobalStateContext } from '../components/ClientContext.jsx';
import { useFocusable, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { TrashIcon, CubeIcon, PlusIcon } from '@heroicons/react/16/solid';
import { useTranslation } from 'react-i18next';
import { Events } from '../components/WebSocketClient.js';

// Module string format examples:
//   npm/@foxreis/tizentube
//   gh/user/repo

// ─── Single module row ────────────────────────────────────────────────────────
function ModuleRow({ mod, focusKey, onRemove }) {
    const { ref, focused } = useFocusable({
        focusKey,
        onEnterPress: onRemove,
    });

    useEffect(() => {
        if (focused) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [focused]);

    // Derive a display name: last segment after the type prefix
    // "npm/@foxreis/tizentube" → "@foxreis/tizentube"
    // "gh/user/repo"          → "user/repo"
    const parts = mod.split('/');
    const type = parts[0];   // npm | gh
    const name = parts.slice(1).join('/');

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
                <p className="text-slate-100 font-mono text-base truncate">{name}</p>
                <p className="text-slate-500 text-xs">{type}</p>
            </div>
            {/* Trash — also fires on OK when row is focused */}
            <div
                onClick={onRemove}
                className={[
                    'flex items-center justify-center w-10 h-10 rounded-lg bg-red-800 text-white flex-shrink-0 cursor-pointer',
                    focused ? 'ring-2 ring-red-400' : ''
                ].join(' ')}
            >
                <TrashIcon className="h-5 w-5" />
            </div>
        </div>
    );
}

// ─── Add-module form ──────────────────────────────────────────────────────────
function AddForm({ onAdd }) {
    const [type, setType]       = useState('npm');  // npm | gh
    const [name, setName]       = useState('');
    const inputRef              = useRef(null);
    const confirmedRef          = useRef(false);
    const { t }                 = useTranslation();

    const { ref: btnRef, focused: btnFocused } = useFocusable({
        focusKey: 'add-module-btn',
        onEnterPress: submit,
    });

    function submit() {
        const trimmed = name.trim();
        if (!trimmed) return;
        onAdd(`${type}/${trimmed}`);
        setName('');
    }

    function handleKeyDown(e) {
        if (e.keyCode === 13 || e.keyCode === 65376) {
            confirmedRef.current = true;
            inputRef.current?.blur();
        }
    }

    function handleBlur() {
        if (confirmedRef.current) {
            confirmedRef.current = false;
            // Move focus to add button after keyboard closes
            setTimeout(() => setFocus('add-module-btn'), 50);
        }
    }

    const placeholder = type === 'npm' ? '@foxreis/tizentube' : 'user/repo';

    return (
        <div className="flex flex-col gap-2 rounded-xl border-2 border-indigo-700 bg-slate-900 px-4 py-3 mt-2">
            <p className="text-indigo-300 font-semibold text-sm">{t('tbModules.addTitle')}</p>

            {/* Type toggle */}
            <div className="flex gap-2">
                {['npm', 'gh'].map(t2 => (
                    <button
                        key={t2}
                        onClick={() => { setType(t2); setName(''); }}
                        className={[
                            'px-4 py-1 rounded-lg text-sm font-bold border-2 transition-colors',
                            type === t2
                                ? 'border-indigo-400 bg-indigo-700 text-white'
                                : 'border-slate-600 bg-slate-800 text-slate-300'
                        ].join(' ')}
                    >
                        {t2}
                    </button>
                ))}
                <span className="text-slate-500 text-xs self-center">
                    {type === 'npm' ? 'npm package path' : 'GitHub user/repo'}
                </span>
            </div>

            {/* Name input */}
            <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm font-mono flex-shrink-0">{type}/</span>
                <input
                    ref={inputRef}
                    type="text"
                    value={name}
                    placeholder={placeholder}
                    className="flex-1 p-2 rounded-lg bg-slate-800 text-slate-100 text-sm border border-slate-600 font-mono"
                    onChange={e => setName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                />
            </div>

            {/* Preview of what will be written */}
            {name.trim() && (
                <p className="text-slate-500 text-xs font-mono">
                    Will add: <span className="text-indigo-300">{type}/{name.trim()}</span>
                </p>
            )}

            {/* Add button */}
            <div
                ref={btnRef}
                onClick={submit}
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
export default function ManageModules() {
    const { state } = useContext(GlobalStateContext);
    const { t } = useTranslation();
    const modules = state.sharedData.tbModules ?? [];

    useEffect(() => {
        // Load current modules from config on mount
        state.client.send({ type: Events.GetTBModules });
        setTimeout(() => {
            setFocus(modules.length > 0 ? 'module-row-0' : 'add-module-btn');
        }, 100);
    }, []);

    // Re-focus first row whenever list changes (e.g. after remove)
    useEffect(() => {
        if (modules.length > 0) {
            setTimeout(() => setFocus('module-row-0'), 50);
        }
    }, [modules.length]);

    function addModule(moduleStr) {
        state.client.send({
            type: Events.AddTBModule,
            payload: { module: moduleStr }
        });
    }

    function removeModule(moduleStr) {
        state.client.send({
            type: Events.RemoveTBModule,
            payload: { module: moduleStr }
        });
    }

    return (
        <div
            className="flex flex-col items-center px-4 pt-4 overflow-y-auto"
            style={{ maxHeight: 'calc(92vh - 8vh)' }}
        >
            <h1 className="text-2xl font-bold text-indigo-400 mb-1 text-center w-full">
                {t('tbModules.pageTitle')}
            </h1>
            <p className="text-slate-400 text-sm mb-4 text-center">
                {t('tbModules.pageDesc')}
            </p>

            <div className="w-full max-w-2xl flex flex-col gap-2">
                {modules.length === 0 ? (
                    <p className="text-slate-500 text-center py-6 text-base">
                        {t('tbModules.empty')}
                    </p>
                ) : (
                    modules.map((mod, i) => (
                        <ModuleRow
                            key={mod}
                            mod={mod}
                            focusKey={`module-row-${i}`}
                            onRemove={() => removeModule(mod)}
                        />
                    ))
                )}

                <AddForm onAdd={addModule} />
            </div>

            <p className="mt-4 mb-2 text-slate-500 text-xs text-center">
                {t('tbModules.hint')}
            </p>
        </div>
    );
}