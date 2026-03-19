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
import About from './pages/About.jsx';
import './components/i18n.js';
import { ExclamationCircleIcon } from '@heroicons/react/16/solid';
import { useTranslation } from 'react-i18next';
import Desktop from './pages/Desktop.jsx';
import { ToastContainer, useToast, setGlobalToast } from './components/Toast.jsx';
import { fetchAllVersionInfo } from './utils/versionInfo.js';

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

    const repoList = context.state.sharedData.repoList;
    if (!repoList || repoList.length === 0) return;

    // Delay slightly so the toast system is fully mounted
    setTimeout(() => {
      const t = window.__globalToast;
      if (!t) return;

      fetchAllVersionInfo(repoList).then(results => {
        const updatable = results.filter(r => r.updateAvailable);
        if (updatable.length === 0) return;

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
    }, 1200);
  }, [context.state.client]);

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
            <Route component={About}             path="/ui/dist/index.html/about" />
          </Router>
        </div>
        <ToastContainer toasts={toasts} onDismiss={toast.dismiss} />
      </LocationProvider>
    </ErrorBoundary>
  );
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