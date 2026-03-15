import { createContext } from 'preact';
import { useReducer } from 'preact/hooks';

function loadRepoList() {
    try {
        const stored = localStorage.getItem('tizenBrewRepoList');
        if (stored) return JSON.parse(stored);
    } catch (_) {}
    return ['reisxd/TizenBrew'];
}

function saveRepoList(list) {
    try { localStorage.setItem('tizenBrewRepoList', JSON.stringify(list)); } catch (_) {}
}

const initialState = {
    sharedData: {
        tizenBrewRepo: localStorage.getItem('tizenBrewRepo') || 'reisxd/TizenBrew',
        repoList: loadRepoList(),
        state: null,
        directory: [],
        error: { message: null, dissapear: false },
        qrCodeShow: false,
        connectedToTV: false
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
        case 'SET_TIZENBREW_REPO':
            localStorage.setItem('tizenBrewRepo', action.payload);
            return { ...state, sharedData: { ...state.sharedData, tizenBrewRepo: action.payload } };
        case 'ADD_REPO': {
            const repo = action.payload.trim();
            if (!repo) return state;
            const existing = state.sharedData.repoList;
            if (existing.includes(repo)) return state;
            const next = [...existing, repo];
            saveRepoList(next);
            return { ...state, sharedData: { ...state.sharedData, repoList: next } };
        }
        case 'REMOVE_REPO': {
            const next = state.sharedData.repoList.filter(r => r !== action.payload);
            saveRepoList(next);
            const tizenBrewRepo = state.sharedData.tizenBrewRepo === action.payload
                ? (next[0] ?? 'reisxd/TizenBrew')
                : state.sharedData.tizenBrewRepo;
            localStorage.setItem('tizenBrewRepo', tizenBrewRepo);
            return { ...state, sharedData: { ...state.sharedData, repoList: next, tizenBrewRepo } };
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