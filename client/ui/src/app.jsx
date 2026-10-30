import { LocationProvider, ErrorBoundary, Router, Route } from 'preact-iso';
import Home from './pages/Home.jsx';
import Header from './components/Header.jsx';
import { GlobalStateContext } from './components/ClientContext.jsx';
import { useRef } from 'preact/hooks';
import { useEffect, useState, useContext } from 'react';
import Client from './components/WebSocketClient.js';
import InstallFromGitHub from './pages/InstallFromGitHub.jsx';
import InstallFromUSB from './pages/InstallFromUSB.jsx';
import SavedRepos from './pages/SavedRepos.jsx';
import AddRepoList from './pages/AddRepoList.jsx';
import InstallQueueOverlay from './components/InstallQueueOverlay.jsx';
import About from './pages/About.jsx';
import './components/i18n.js';
import { ExclamationCircleIcon } from '@heroicons/react/16/solid';
import { useTranslation } from 'react-i18next';
import Desktop from './pages/Desktop.jsx';
import { ToastContainer, useToast, setGlobalToast } from './components/Toast.jsx';
import { fetchAllVersionInfo, invalidateReleaseInfoCache } from './utils/versionInfo.js';
import { syncRepoLists } from './utils/repoLists.js';

export default function App() {
  const headerRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const context = useContext(GlobalStateContext);
  const { t } = useTranslation();
  const { toasts, toast } = useToast();
  const startupToastShownRef = useRef(false);
  window.dispatch = context.dispatch;
  window.state = context.state;

  useEffect(() => { setGlobalToast(toast); }, [toast]);

  useEffect(() => {
    if (context.state.sharedData.error.disappear) {
      setTimeout(() => {
        context.dispatch({ type: 'SET_ERROR', payload: { message: null, disappear: false } });
      }, 5000);
    }
  }, [context.state.sharedData.error.disappear]);

  useEffect(() => { setHeaderHeight(headerRef.current.base.clientHeight); }, [headerRef]);

  useEffect(() => {
    if (!window.setClient) { startService(context); window.setClient = true; }
  }, []);

  // Startup update check — fires once when the client first becomes available
  useEffect(() => {
    if (!context.state.client || startupToastShownRef.current) return;
    startupToastShownRef.current = true;

    // Delay slightly so the toast system is fully mounted
    setTimeout(() => runUpdateCheck(sharedRef.current, context.dispatch), 1200);
  }, [context.state.client]);

  // The Tizen app is usually resumed from the background rather than restarted,
  // so the page (and its once-per-start version check) stays alive. Re-check
  // whenever it becomes visible again, bypassing the 5-minute cache.
  const sharedRef = useRef(context.state.sharedData);
  sharedRef.current = context.state.sharedData;
  useEffect(() => {
    let lastResumeAt = Date.now();
    function onResume() {
      if (document.hidden) return;
      const now = Date.now();
      if (now - lastResumeAt < 5000) return;
      lastResumeAt = now;
      invalidateReleaseInfoCache();
      context.dispatch({ type: 'REFRESH_VERSIONS' });
      runUpdateCheck(sharedRef.current, context.dispatch);
    }
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', onResume);
    return () => {
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onResume);
    };
  }, []);

  return (
    <ErrorBoundary>
      <LocationProvider>
        <Header ref={headerRef} />
        <div className="bg-slate-800 text-white overflow-hidden" style={{ height: `calc(100vh - ${headerHeight}px)` }}>
          <div className={`flex justify-center px-[3vw] ${!context.state.sharedData.error.message ? 'hidden' : ''}`}>
            <div class="flex items-start p-4 mb-4 rounded-lg bg-slate-900 mt-6 w-full max-w-[94vw] text-red-300 border border-red-700" role="alert">
              <ExclamationCircleIcon className="h-7 w-7 mr-3 mt-1 flex-shrink-0" />
              <div className="min-w-0 max-h-[18vh] overflow-y-auto pr-2">
                <span class="text-base leading-relaxed whitespace-pre-wrap break-all">{t(context.state.sharedData.error.message, context.state.sharedData.error.args)}</span>
              </div>
            </div>
          </div>
          <Router>
            <Route component={Home}              path="/ui/dist/index.html" />
            <Route component={Desktop}           path="/ui/dist/index.html/desktop" />
            <Route component={InstallFromGitHub} path="/ui/dist/index.html/install-from-gh" />
            <Route component={InstallFromUSB}    path="/ui/dist/index.html/install-from-usb" />
            <Route component={SavedRepos}        path="/ui/dist/index.html/saved-repos" />
            <Route component={AddRepoList}       path="/ui/dist/index.html/add-repo-list" />
            <Route component={About}             path="/ui/dist/index.html/about" />
          </Router>
        </div>
        <InstallQueueOverlay />
        <ToastContainer toasts={toasts} onDismiss={toast.dismiss} />
      </LocationProvider>
    </ErrorBoundary>
  );
}

// Startup and resume can both fire close together (the TV often sends a
// visibility event shortly after launch), which showed every update twice.
// One check at a time, and never the same update toast twice in a row.
let checkInFlight = false;
let lastCheckAt = 0;
const recentToasts = {};
const TOAST_DEDUPE_MS = 120000;
const MIN_CHECK_GAP_MS = 20000;

function runUpdateCheck(sharedData, dispatch) {
  if (checkInFlight || Date.now() - lastCheckAt < MIN_CHECK_GAP_MS) return;
  checkInFlight = true;
  // Pull in repo lists first so newly listed repos are checked too.
  syncRepoLists(sharedData, dispatch)
    .catch(() => null)
    .then(merged => checkForUpdates(merged ? merged.repoList : sharedData.repoList))
    .catch(() => {})
    .then(() => { checkInFlight = false; lastCheckAt = Date.now(); });
}

function checkForUpdates(repoList) {
  const t = window.__globalToast;
  if (!t || !repoList || repoList.length === 0) return Promise.resolve();

  return fetchAllVersionInfo(repoList).then(results => {
    const now = Date.now();
    const updatable = results.filter(r => {
      if (!r.updateAvailable) return false;
      const key = r.repo + '|' + r.installedVersion + '|' + r.latestVersion;
      if (recentToasts[key] && now - recentToasts[key] < TOAST_DEDUPE_MS) return false;
      recentToasts[key] = now;
      return true;
    });
    updatable.forEach((r, idx) => {
      setTimeout(() => {
        const label = r.repo.split('/').pop();
        t.info(
          `⬆ Update available: ${label}\nInstalled: ${r.installedVersion}  →  Latest: ${r.latestVersion}\n${r.repo}`,
          6000
        );
      }, idx * 600);
    });
  });
}

function startService(context) {
  const testWS = new WebSocket('ws://localhost:8091');
  testWS.onerror = () => {
    const pkgId = tizen.application.getCurrentApplication().appInfo.packageId;
    const serviceId = pkgId + '.InstallerService';
    tizen.application.launchAppControl(
      new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/service'),
      serviceId,
      function () {
        context.dispatch({ type: 'SET_STATE', payload: 'service.started' });
        window.location.reload();
      },
      function (e) { alert('Launch Service failed: ' + e.message); }
    );
  };
  testWS.onopen = () => {
    context.dispatch({ type: 'SET_STATE', payload: 'service.alreadyRunning' });
    context.dispatch({ type: 'SET_CLIENT', payload: new Client(context) });
  };
}