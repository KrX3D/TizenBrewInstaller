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
import ManageModules from './pages/ManageModules.jsx';
import About from './pages/About.jsx';
import './components/i18n.js';
import { ExclamationCircleIcon } from '@heroicons/react/16/solid';
import { useTranslation } from 'react-i18next';
import Desktop from './pages/Desktop.jsx';
import { ToastContainer, useToast, setGlobalToast } from './components/Toast.jsx';

export default function App() {
  const headerRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const context = useContext(GlobalStateContext);
  const { t } = useTranslation();
  const { toasts, toast } = useToast();
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

  return (
    <ErrorBoundary>
      <LocationProvider>
        <Header ref={headerRef} />
        <div className="bg-slate-800 text-white overflow-hidden" style={{ height: `calc(100vh - ${headerHeight}px)` }}>
          <div className={`flex justify-center ${!context.state.sharedData.error.message ? 'hidden' : ''}`}>
            <div class="flex items-center p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 bg-slate-900 mt-8 w-[95vw] text-red-400" role="alert">
              <ExclamationCircleIcon className="h-[4vw] w-[2vw] mr-2" />
              <div>
                <span class="text-2xl">{t(context.state.sharedData.error.message, context.state.sharedData.error.args)}</span>
              </div>
            </div>
          </div>
          <Router>
            <Route component={Home}             path="/ui/dist/index.html" />
            <Route component={Desktop}          path="/ui/dist/index.html/desktop" />
            <Route component={InstallFromGitHub} path="/ui/dist/index.html/install-from-gh" />
            <Route component={InstallFromUSB}   path="/ui/dist/index.html/install-from-usb" />
            <Route component={SavedRepos}       path="/ui/dist/index.html/saved-repos" />
            <Route component={ManageModules}    path="/ui/dist/index.html/manage-modules" />
            <Route component={About}            path="/ui/dist/index.html/about" />
          </Router>
        </div>
        <ToastContainer toasts={toasts} onDismiss={toast.dismiss} />
      </LocationProvider>
    </ErrorBoundary>
  );
}

// ── Service startup ────────────────────────────────────────────────────────────
// Problem: window.location.reload() fires immediately after the service launch
// signal is sent, before the service process is actually ready to accept WS
// connections. This causes a reload loop (service started → reload → WS fails
// again → launch again → reload again…).
//
// Fix: track how many times we've launched in localStorage so we don't keep
// relaunching; wait 3 seconds after the launch signal before reloading so the
// service process has time to bind its port.
//
const LAUNCH_COUNT_KEY = 'tbInstallerServiceLaunchCount';
const LAUNCH_TS_KEY    = 'tbInstallerServiceLaunchTs';
const MAX_LAUNCHES     = 3;   // give up after 3 launch attempts per cold boot
const RELOAD_DELAY_MS  = 3000; // wait 3 s for the service to start before reload

function startService(context) {
  // Reset the counter if it's been more than 30 s since the last launch attempt
  // (i.e. user manually reopened the app after a crash)
  const lastTs = Number(localStorage.getItem(LAUNCH_TS_KEY) || 0);
  if (Date.now() - lastTs > 30_000) {
    localStorage.removeItem(LAUNCH_COUNT_KEY);
  }

  const testWS = new WebSocket('ws://localhost:8091');

  testWS.onerror = () => {
    const launches = Number(localStorage.getItem(LAUNCH_COUNT_KEY) || 0);
    if (launches >= MAX_LAUNCHES) {
      // Stop trying — show an error instead of an infinite reload loop
      context.dispatch({
        type: 'SET_ERROR',
        payload: { message: 'service.failedToStart', disappear: false }
      });
      localStorage.removeItem(LAUNCH_COUNT_KEY);
      localStorage.removeItem(LAUNCH_TS_KEY);
      return;
    }

    localStorage.setItem(LAUNCH_COUNT_KEY, String(launches + 1));
    localStorage.setItem(LAUNCH_TS_KEY, String(Date.now()));

    const pkgId = tizen.application.getCurrentApplication().appInfo.packageId;
    const serviceId = pkgId + '.InstallerService';

    tizen.application.launchAppControl(
      new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/service'),
      serviceId,
      function () {
        context.dispatch({ type: 'SET_STATE', payload: 'service.started' });
        // Give the service process time to bind port 8091 before reloading
        setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
      },
      function (e) {
        alert('Launch Service failed: ' + e.message);
      }
    );
  };

  testWS.onopen = () => {
    // Connected — clear the launch counter; we're good
    localStorage.removeItem(LAUNCH_COUNT_KEY);
    localStorage.removeItem(LAUNCH_TS_KEY);

    context.dispatch({ type: 'SET_STATE', payload: 'service.alreadyRunning' });
    context.dispatch({ type: 'SET_CLIENT', payload: new Client(context) });
  };
}