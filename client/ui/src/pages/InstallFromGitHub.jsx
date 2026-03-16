import { useState, useContext, useRef, useEffect } from 'preact/hooks';
import { GlobalStateContext } from '../components/ClientContext.jsx';
import { useLocation } from 'preact-iso';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Events } from '../components/WebSocketClient.js';
import Item from "../components/Item.jsx";

export default function InstallFromGitHub() {
    const { state, dispatch } = useContext(GlobalStateContext);
    const [name, setName] = useState(state.sharedData.tizenBrewRepo || '');
    const loc = useLocation();
    const inputRef = useRef(null);
    // Only install when the user explicitly confirmed with Enter/OK
    const confirmedRef = useRef(false);

    useEffect(() => {
        inputRef.current.focus();
    }, [inputRef]);

    function confirm() {
        const repo = name.trim();
        if (repo) {
            dispatch({ type: 'ADD_REPO', payload: repo });
            dispatch({ type: 'SET_TIZENBREW_REPO', payload: repo });
            state.client.send({ type: Events.InstallPackage, payload: { url: repo } });
        }
        loc.route('/ui/dist/index.html');
        setFocus('sn:focusable-item-1');
    }

    return (
        <div className="relative isolate lg:px-8">
            <div className="mx-auto flex flex-wrap justify-center gap-4 top-4 relative">
                <Item>
                    <input
                        type="text"
                        ref={inputRef}
                        value={name}
                        className="w-full p-2 rounded-lg bg-gray-800 text-gray-200"
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
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
                            // If blur was from keyboard close / back button: do nothing,
                            // let the user navigate away with the back key normally.
                        }}
                        placeholder="owner/repo"
                    />
                    <p className="mt-3 text-sm text-slate-400">Press OK to confirm and install</p>
                </Item>
            </div>
        </div>
    );
}