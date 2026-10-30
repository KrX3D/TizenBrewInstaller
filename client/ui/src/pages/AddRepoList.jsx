import { useState, useContext, useRef, useEffect } from 'preact/hooks';
import { GlobalStateContext } from '../components/ClientContext.jsx';
import { useLocation } from 'preact-iso';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useTranslation } from 'react-i18next';
import { parseListPath } from '../utils/repoLists.js';
import Item from "../components/Item.jsx";

export default function AddRepoList() {
    const { dispatch } = useContext(GlobalStateContext);
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [invalid, setInvalid] = useState(false);
    const loc = useLocation();
    const inputRef = useRef(null);
    // Only add when the user explicitly confirmed with Enter/OK
    const confirmedRef = useRef(false);

    useEffect(() => {
        inputRef.current.focus();
    }, [inputRef]);

    function confirm() {
        const value = name.trim();
        if (!value) {
            loc.route('/ui/dist/index.html/saved-repos');
            return;
        }
        if (!parseListPath(value)) {
            setInvalid(true);
            inputRef.current.focus();
            return;
        }
        dispatch({ type: 'ADD_REPO_LIST', payload: value });
        // Saved Repos syncs the lists when it opens, which loads the new one.
        loc.route('/ui/dist/index.html/saved-repos');
        setFocus('sn:focusable-item-1');
    }

    return (
        <div className="relative isolate lg:px-8 pt-6">
            <div className="mx-auto flex flex-wrap justify-center gap-4 top-4 relative">
                <Item>
                    <h3 className="text-violet-400 text-base/7 font-semibold mb-2">{t('repoLists.addTitle')}</h3>
                    <input
                        type="email"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                        ref={inputRef}
                        value={name}
                        className="w-full p-2 rounded-lg bg-gray-800 text-gray-200"
                        onChange={(e) => { setName(e.target.value); setInvalid(false); }}
                        onKeyDown={(e) => {
                            if (e.keyCode === 37 || e.keyCode === 39) { e.stopPropagation(); return; }
                            if (e.keyCode === 13 || e.keyCode === 65376) {
                                // Mark as confirmed BEFORE blur fires
                                confirmedRef.current = true;
                                inputRef.current.blur();
                            }
                        }}
                        onBlur={() => {
                            if (confirmedRef.current) {
                                confirmedRef.current = false;
                                confirm();
                            }
                        }}
                        placeholder="owner/repo/repos.md"
                    />
                    <p className="mt-3 text-sm text-slate-400">{t('repoLists.addHint')}</p>
                    {invalid && <p className="mt-2 text-sm text-red-400">{t('repoLists.invalid')}</p>}
                </Item>
            </div>
        </div>
    );
}
