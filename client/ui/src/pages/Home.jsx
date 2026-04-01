import { ArrowDownIcon, ArrowPathIcon, BookmarkIcon } from '@heroicons/react/16/solid';
import { useContext, useRef, useState, useEffect } from 'preact/hooks';
import { GlobalStateContext } from '../components/ClientContext.jsx';
import Item from '../components/Item.jsx';
import SignInQrCode from '../assets/signInQrCode.png';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'preact-iso';
import { Events } from '../components/WebSocketClient.js';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import {
    repoLabel,
    isKnownRepo,
    getInstalledVersion,
    fetchLatestVersionInfo,
    isUpdateAvailable
} from '../utils/versionInfo.js';

const PKG_ID_TIZENBREW_USB_DEMO = 'xvvl3S1bTU';
const PKG_ID_TIZENBREW_INSTALLER = 'xvvl3S1bTI';
const APP_ID_TIZENBREW_USB_DEMO = 'xvvl3S1bTU.TizenBrewStandalone';

export default function Home() {
    const isTizenApiAvailable = typeof tizen !== 'undefined' && tizen.application && tizen.application.getAppInfo;
    const context = useContext(GlobalStateContext);
    const { t } = useTranslation();
    const loc = useLocation();
    const didRunRef = useRef(false);

    if (!isTizenApiAvailable) loc.route('/ui/dist/index.html/desktop');

    const activeRepo = context.state.sharedData.tizenBrewRepo;
    const versionRefreshTick = context.state.sharedData.versionRefreshTick || 0;
    const label = repoLabel(activeRepo);
    const installedVersion = getInstalledVersion(activeRepo);
    const installed = installedVersion !== null;

    const [latestVersion, setLatestVersion] = useState(null);
    const [latestSource, setLatestSource] = useState('unavailable');
    const [loadingLatest, setLoadingLatest] = useState(false);

    // Only start the version fetch once the WebSocket client is confirmed alive,
    // and wait 2 s before the first attempt so the network stack has time to settle
    // (especially important after a cold reboot on Tizen).
    useEffect(() => {
        if (!activeRepo || !context.state.client) return;

        setLatestVersion(null);
        setLatestSource('unavailable');
        setLoadingLatest(true);

        let cancelled = false;
        let timer = null;

        function loadLatest(attempt) {
            fetchLatestVersionInfo(activeRepo)
                .then(info => {
                    if (cancelled) return;

                    if ((info.latestSource || 'unavailable') === 'unavailable' && attempt < 2) {
                        timer = setTimeout(() => loadLatest(attempt + 1), 3000);
                        return;
                    }

                    setLatestVersion(info.latestVersion);
                    setLatestSource(info.latestSource || 'unavailable');
                    setLoadingLatest(false);
                })
                .catch(() => {
                    if (cancelled) return;
                    if (attempt < 2) {
                        timer = setTimeout(() => loadLatest(attempt + 1), 3000);
                    } else {
                        setLoadingLatest(false);
                    }
                });
        }

        // 2 s grace period: lets the service finish starting and gives the TV
        // network stack time to come up before we hit the GitHub API.
        timer = setTimeout(() => loadLatest(0), 2000);

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeRepo, versionRefreshTick, context.state.client]);

    const updateAvailable = isUpdateAvailable(installedVersion, latestVersion);

    const ownPkgId = (() => {
        try { return tizen.application.getAppInfo().packageId; } catch (_) { return null; }
    })();

    useEffect(() => {
        const { client } = context.state;
        if (client !== null && client.socket && client.socket.readyState === WebSocket.OPEN && !didRunRef.current) {
            didRunRef.current = true;
            if (ownPkgId === PKG_ID_TIZENBREW_USB_DEMO) {
                alert(t('installer.installingAgain'));
                client.send({ type: Events.InstallPackage, payload: { url: 'reisxd/TizenBrewInstaller' } });
            }
            try {
                if (ownPkgId === PKG_ID_TIZENBREW_INSTALLER) {
                    tizen.application.getAppInfo(APP_ID_TIZENBREW_USB_DEMO);
                    alert(t('installer.alreadyInstalled'));
                }
            } catch (_) {}
        }
    }, [context.state.client]);

    useEffect(() => {
        const retries = [60, 180, 420, 900];
        retries.forEach(delay => {
            setTimeout(() => {
                if (window.location.pathname === '/ui/dist/index.html' || window.location.pathname === '/ui/dist/index.html/') {
                    setFocus('home-card-install');
                }
            }, delay);
        });
    }, []);

    return (
        <div className="relative isolate lg:px-8 pt-6">
            {context.state.sharedData.qrCodeShow && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="p-8 rounded-2xl shadow-2xl max-w-full">
                        <h3 className="text-3xl font-bold mb-4">{t('resigning.resigningRequired')}</h3>
                        <p className="text-xl mb-4 whitespace-pre">{t('resigning.resigningRequiredDesc')}</p>
                        <img src={SignInQrCode} alt="Sign In QR Code" className="mt-2 w-80 h-80 max-w-full max-h-[60vw] object-contain mx-auto border-8 rounded-lg" />
                        <p className="mt-4 text-lg">{t('resigning.resigningRequiredAccessInfo', { ip: webapis.network.getIp() })}</p>
                        <p className="mt-4 text-lg">{t('resigning.resigningDeviceSameNetwork')}</p>
                    </div>
                </div>
            )}

            <div className="mx-auto flex flex-wrap justify-center gap-x-2 top-4 relative">
                <Item focusKey="home-card-install" upFocusKey="sn:focusable-item-1" onClick={() => {
                    context.state.client.send({ type: Events.InstallPackage, payload: { url: activeRepo } });
                }}>
                    <h3 className='text-indigo-400 text-base/7 font-semibold'>
                        {installed ? (
                            <span className='flex items-center gap-2'>
                                <ArrowPathIcon className={`h-8 w-8 ${updateAvailable ? 'text-amber-400' : 'text-indigo-400'}`} />
                                <span className={updateAvailable ? 'text-amber-400' : ''}>{t('installer.update', { label })}</span>
                            </span>
                        ) : (
                            <span className='flex items-center gap-2'>
                                <ArrowDownIcon className='h-8 w-8 text-indigo-400' />
                                {t('installer.install', { label })}
                            </span>
                        )}
                    </h3>
                    <p className="mt-2 text-sm text-slate-300 break-all">Repo: {activeRepo}</p>
                    {installed && installedVersion && (
                        <p className="text-sm text-slate-300">
                            {t('installer.installedVersion', { version: installedVersion })}
                        </p>
                    )}
                    {latestVersion && (
                        <p className={`text-sm mt-1 ${updateAvailable ? 'text-amber-400 font-semibold' : 'text-slate-400'}`}>
                            Latest: {latestVersion}
                            {latestSource === 'cache_fresh' ? ' (cached)' : ''}
                            {latestSource === 'cache_stale' ? ' (cached, online check failed)' : ''}
                            {updateAvailable ? ' ⬆ Update available' : (installed && latestSource === 'online') ? ' ✓ Up to date' : ''}
                        </p>
                    )}
                    {loadingLatest && !latestVersion && (
                        <p className="text-xs text-slate-500 mt-1">Checking latest version...</p>
                    )}
                    {!loadingLatest && !latestVersion && latestSource === 'unavailable' && (
                        <p className="text-xs text-amber-400 mt-1">Could not check latest version online.</p>
                    )}
                    {!isKnownRepo(activeRepo) && (
                        <p className="text-xs text-slate-500 mt-1">{t('installer.versionUnknown')}</p>
                    )}
                </Item>

                <Item focusKey="home-card-usb" upFocusKey="sn:focusable-item-1" onClick={() => loc.route('/ui/dist/index.html/install-from-usb')}>
                    <h3 className='text-indigo-400 text-base/7 font-semibold'>
                        <span className='flex items-center gap-2'>
                            <ArrowDownIcon className='h-8 w-8 text-indigo-400' />
                            {t('installer.installFromUSB')}
                        </span>
                    </h3>
                </Item>

                <Item focusKey="home-card-gh" upFocusKey="sn:focusable-item-1" onClick={() => loc.route('/ui/dist/index.html/install-from-gh')}>
                    <h3 className='text-indigo-400 text-base/7 font-semibold'>
                        <span className='flex items-center gap-2'>
                            <ArrowDownIcon className='h-8 w-8 text-indigo-400' />
                            {t('installer.installFromGH')}
                        </span>
                    </h3>
                </Item>

                <Item focusKey="home-card-saved" upFocusKey="sn:focusable-item-1" onClick={() => loc.route('/ui/dist/index.html/saved-repos')}>
                    <h3 className='text-violet-400 text-base/7 font-semibold'>
                        <span className='flex items-center gap-2'>
                            <BookmarkIcon className='h-8 w-8 text-violet-400' />
                            {t('savedRepos.button')}
                        </span>
                    </h3>
                    <p className="mt-2 text-sm text-slate-400">{t('savedRepos.desc', { count: context.state.sharedData.repoList.length })}</p>
                    <p className="mt-1 text-xs text-slate-500 break-all">{t('savedRepos.active')}: {activeRepo}</p>
                </Item>
            </div>
        </div>
    );
}