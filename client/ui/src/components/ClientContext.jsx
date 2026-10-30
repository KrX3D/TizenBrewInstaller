import { createContext } from 'preact';
import { useReducer } from 'preact/hooks';
import { applySyncResults, removeRepoList, addRepoList } from '../utils/repoLists.js';

const DEFAULT_REPOS = ['reisxd/TizenBrew', 'reisxd/TizenBrewInstaller'];

function loadRepoList() {
    try {
        const stored = localStorage.getItem('tizenBrewRepoList');
        if (stored) return JSON.parse(stored);
    } catch (_) {}
    saveRepoList(DEFAULT_REPOS);
    return DEFAULT_REPOS;
}

function saveRepoList(list) {
    try { localStorage.setItem('tizenBrewRepoList', JSON.stringify(list)); } catch (_) {}
}

function loadJson(key, fallback) {
    try {
        const stored = localStorage.getItem(key);
        if (stored) return JSON.parse(stored);
    } catch (_) {}
    return fallback;
}

// Default repo list shipped with this installer (repos.md in this repo).
// Only seeded while the user has never had any lists; deleting it sticks.
const DEFAULT_REPO_LIST = 'KrX3D/TizenBrewInstaller/repos.md';

function loadRepoLists() {
    const stored = loadJson('tizenBrewRepoLists', null);
    if (stored) return stored;
    const lists = addRepoList([], DEFAULT_REPO_LIST) || [];
    saveJson('tizenBrewRepoLists', lists);
    return lists;
}

function saveJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}

// After a sync/remove the active repo may be gone: fall back like REMOVE_REPO.
function persistRepoState(state, next) {
    saveRepoList(next.repoList);
    saveJson('tizenBrewRepoLists', next.repoLists);
    saveJson('tizenBrewRepoMeta', next.repoMeta);
    const active = next.repoList.indexOf(state.sharedData.tizenBrewRepo) >= 0
        ? state.sharedData.tizenBrewRepo
        : (next.repoList[0] ?? 'reisxd/TizenBrew');
    try { localStorage.setItem('tizenBrewRepo', active); } catch (_) {}
    return { ...state, sharedData: { ...state.sharedData, ...next, tizenBrewRepo: active } };
}

const initialState = {
    sharedData: {
        tizenBrewRepo: localStorage.getItem('tizenBrewRepo') || 'reisxd/TizenBrew',
        repoList: loadRepoList(),
        repoLists: loadRepoLists(),
        repoMeta: loadJson('tizenBrewRepoMeta', {}),
        state: null,
        directory: [],
        error: { message: null, dissapear: false },
        qrCodeShow: false,
        connectedToTV: false,
        versionRefreshTick: 0
    },
    client: null
};

function reducer(state, action) {
    switch (action.type) {
        case 'SET_SHARED_DATA':
            return { ...state, sharedData: action.payload };
        case 'SET_CLIENT':
            if (state.client) return state;
            return { ...state, client: action.payload };
        case 'SET_STATE':
            return { ...state, sharedData: { ...state.sharedData, state: action.payload } };
        case 'SET_ERROR':
            return { ...state, sharedData: { ...state.sharedData, error: action.payload } };
        case 'SET_DIRECTORY':
            return { ...state, sharedData: { ...state.sharedData, directory: action.payload } };
        case 'SET_QR_CODE':
            return { ...state, sharedData: { ...state.sharedData, qrCodeShow: action.payload } };
        case 'SET_CONNECTED_TO_TV':
            return { ...state, sharedData: { ...state.sharedData, connectedToTV: action.payload } };
        case 'REFRESH_VERSIONS':
            return {
                ...state,
                sharedData: {
                    ...state.sharedData,
                    versionRefreshTick: (state.sharedData.versionRefreshTick || 0) + 1
                }
            };
        case 'SET_TIZENBREW_REPO':
            localStorage.setItem('tizenBrewRepo', action.payload);
            return { ...state, sharedData: { ...state.sharedData, tizenBrewRepo: action.payload } };
        case 'ADD_REPO': {
            const repo = action.payload.trim();
            if (!repo) return state;
            const existing = state.sharedData.repoList;
            if (existing.includes(repo)) {
                // Adding a list-managed repo by hand pins it.
                const m = state.sharedData.repoMeta[repo];
                if (!m || m.locked) return state;
                const repoMeta = { ...state.sharedData.repoMeta, [repo]: { ...m, locked: true } };
                saveJson('tizenBrewRepoMeta', repoMeta);
                return { ...state, sharedData: { ...state.sharedData, repoMeta } };
            }
            const next = [...existing, repo];
            saveRepoList(next);
            return { ...state, sharedData: { ...state.sharedData, repoList: next } };
        }
        case 'REMOVE_REPO': {
            const next = state.sharedData.repoList.filter(r => r !== action.payload);
            saveRepoList(next);
            if (state.sharedData.repoMeta[action.payload]) {
                const { [action.payload]: _gone, ...repoMeta } = state.sharedData.repoMeta;
                saveJson('tizenBrewRepoMeta', repoMeta);
                state = { ...state, sharedData: { ...state.sharedData, repoMeta } };
            }
            const tizenBrewRepo = state.sharedData.tizenBrewRepo === action.payload
                ? (next[0] ?? 'reisxd/TizenBrew')
                : state.sharedData.tizenBrewRepo;
            localStorage.setItem('tizenBrewRepo', tizenBrewRepo);
            return { ...state, sharedData: { ...state.sharedData, repoList: next, tizenBrewRepo } };
        }
        case 'TOGGLE_REPO_LOCK': {
            const repo = action.payload;
            const m = state.sharedData.repoMeta[repo];
            // No meta = added by hand = locked, so the first toggle unlocks it.
            const locked = m ? !m.locked : false;
            const repoMeta = { ...state.sharedData.repoMeta, [repo]: { sources: m ? m.sources : [], locked } };
            saveJson('tizenBrewRepoMeta', repoMeta);
            return { ...state, sharedData: { ...state.sharedData, repoMeta } };
        }
        case 'ADD_REPO_LIST': {
            const repoLists = addRepoList(state.sharedData.repoLists, action.payload);
            if (!repoLists) return state;
            saveJson('tizenBrewRepoLists', repoLists);
            return { ...state, sharedData: { ...state.sharedData, repoLists } };
        }
        case 'TOGGLE_REPO_LIST': {
            const repoLists = state.sharedData.repoLists.map(l => l.id === action.payload ? { ...l, enabled: !l.enabled } : l);
            saveJson('tizenBrewRepoLists', repoLists);
            return { ...state, sharedData: { ...state.sharedData, repoLists } };
        }
        case 'REMOVE_REPO_LIST': {
            const { repoList, repoLists, repoMeta } = state.sharedData;
            return persistRepoState(state, removeRepoList(repoList, repoLists, repoMeta, action.payload));
        }
        case 'APPLY_REPO_SYNC': {
            const { repoList, repoLists, repoMeta } = state.sharedData;
            return persistRepoState(state, applySyncResults(repoList, repoLists, repoMeta, action.payload.results, action.payload.now));
        }
        default:
            return state;
    }
}

export const GlobalStateContext = createContext();

export function GlobalStateProvider({ children }) {
    const [state, dispatch] = useReducer(reducer, initialState);
    return (
        <GlobalStateContext.Provider value={{ state, dispatch }}>
            {children}
        </GlobalStateContext.Provider>
    );
}
