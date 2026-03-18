import { ArrowDownIcon, ArrowPathIcon, TrashIcon, MagnifyingGlassIcon, BookmarkIcon, CubeIcon } from '@heroicons/react/16/solid';
import { useContext, useRef, useState } from 'react';
import { GlobalStateContext } from '../components/ClientContext.jsx';
import Item from '../components/Item.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import SignInQrCode from '../assets/signInQrCode.png';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'preact-iso';
import { Events } from '../components/WebSocketClient.js';
import { useEffect } from 'preact/hooks';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

const REPO_NAME_TO_PACKAGE_ID = {
    tizenbrew:          'xvvl3S1bvH.TizenBrewStandalone',
    tizenbrewinstaller: 'xvvl3S1bTI.TizenBrewStandalone',
};

function normalizeRepo(repo) {
    if (!repo) return '';
    return repo.trim()
        .replace(/^https?:\/\/github\.com\//i, '')
        .replace(/\.git$/i, '')
        .replace(/^github:/i, '')
        .replace(/^\/+|\/+$/g, '')
        .toLowerCase();
}

function repoLabel(repo) {
    if (!repo) return 'TizenBrew';
    const parts = repo.split('/');
    const last = parts[parts.length - 1];
    return last.charAt(0).toUpperCase() + last.slice(1);
}

function getInstalledInfo(repo) {
    if (typeof tizen === 'undefined') return { installed: false, version: null };
    const repoName = normalizeRepo(repo).split('/').pop();
    const pkgId = REPO_NAME_TO_PACKAGE_ID[repoName];
    if (!pkgId) return { installed: false, version: null };
    try {
        const appInfo = tizen.application.getAppInfo(pkgId);
        return { installed: true, version: appInfo.version };
    } catch (_) {
        return { installed: false, version: null };
    }
}

function isKnownRepo(repo) {
    return !!REPO_NAME_TO_PACKAGE_ID[normalizeRepo(repo).split('/').pop()];
}

export default function Home() {
    const isTizenApiAvailable = typeof tizen !== 'undefined' && tizen.application && tizen.application.getAppInfo;
    const context = useContext(GlobalStateContext);
    const { t } = useTranslation();
    const loc = useLocation();
    const didRunRef   = useRef(false);
    const lastCheckTs = useRef(0);
    const lastResetTs = useRef(0);
    const [resetModal, setResetModal] = useState(false);

    if (!isTizenApiAvailable) loc.route('/ui/dist/index.html/desktop');

    const activeRepo = context.state.sharedData.tizenBrewRepo;
    const label = repoLabel(activeRepo);
    const { installed, version } = getInstalledInfo(activeRepo);

    const ownPkgId = (() => {
        try { return tizen.application.getAppInfo().packageId; } catch (_) { return null; }
    })();

    useEffect(() => {
        const { client } = context.state;
        if (client !== null && client.socket && client.socket.readyState === WebSocket.OPEN && !didRunRef.current) {
            didRunRef.current = true;
            if (ownPkgId === 'xvvl3S1bTU') {
                alert(t('installer.installingAgain'));
                client.send({ type: Events.InstallPackage, payload: { url: 'reisxd/TizenBrewInstaller' } });
            }
            try {
                if (ownPkgId === 'xvvl3S1bTI') {
                    tizen.application.getAppInfo('xvvl3S1bTU.TizenBrewStandalone');
                    alert(t('installer.alreadyInstalled'));
                }
            } catch (_) {}
        }
    }, [context.state.client]);

    function handleCheck() {
        const now = Date.now();
        if (now - lastCheckTs.current < 1000) return;
        lastCheckTs.current = now;
        context.state.client.send({ type: Events.CheckTizenBrewConfig });
    }

    function handleResetRequest() {
        const now = Date.now();
        if (now - lastResetTs.current < 1000) return;
        lastResetTs.current = now;
        setResetModal(true);
    }

    function handleResetConfirm() {
        setResetModal(false);
        context.state.client.send({ type: Events.ResetTizenBrewConfig });
        // Return focus to the reset card
        setTimeout(() => setFocus('home-card-reset'), 80);
    }

    function handleResetCancel() {
        setResetModal(false);
        setTimeout(() => setFocus('home-card-reset'), 50);
    }

    return (
        <div className="relative isolate lg:px-8 pt-6">
            {resetModal && (
                <ConfirmModal
                    message={t('tizenBrewConfig.resetConfirm')}
                    onConfirm={handleResetConfirm}
                    onCancel={handleResetCancel}
                />
            )}

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
                            <span className='flex items-center gap-2'><ArrowPathIcon className='h-8 w-8 text-indigo-400' />{t('installer.update', { label })}</span>
                        ) : (
                            <span className='flex items-center gap-2'><ArrowDownIcon className='h-8 w-8 text-indigo-400' />{t('installer.install', { label })}</span>
                        )}
                    </h3>
                    <p className="mt-2 text-sm text-slate-300 break-all">Repo: {activeRepo}</p>
                    {installed && version && <p className="text-sm text-slate-300">{t('installer.installedVersion', { version })}</p>}
                    {!isKnownRepo(activeRepo) && <p className="text-xs text-slate-500 mt-1">{t('installer.versionUnknown')}</p>}
                </Item>

                <Item focusKey="home-card-usb" upFocusKey="sn:focusable-item-1" onClick={() => loc.route('/ui/dist/index.html/install-from-usb')}>
                    <h3 className='text-indigo-400 text-base/7 font-semibold'>
                        <span className='flex items-center gap-2'><ArrowDownIcon className='h-8 w-8 text-indigo-400' />{t('installer.installFromUSB')}</span>
                    </h3>
                </Item>

                <Item focusKey="home-card-gh" upFocusKey="sn:focusable-item-1" onClick={() => loc.route('/ui/dist/index.html/install-from-gh')}>
                    <h3 className='text-indigo-400 text-base/7 font-semibold'>
                        <span className='flex items-center gap-2'><ArrowDownIcon className='h-8 w-8 text-indigo-400' />{t('installer.installFromGH')}</span>
                    </h3>
                </Item>

                <Item focusKey="home-card-saved" upFocusKey="sn:focusable-item-1" onClick={() => loc.route('/ui/dist/index.html/saved-repos')}>
                    <h3 className='text-violet-400 text-base/7 font-semibold'>
                        <span className='flex items-center gap-2'><BookmarkIcon className='h-8 w-8 text-violet-400' />{t('savedRepos.button')}</span>
                    </h3>
                    <p className="mt-2 text-sm text-slate-400">{t('savedRepos.desc', { count: context.state.sharedData.repoList.length })}</p>
                    <p className="mt-1 text-xs text-slate-500 break-all">{t('savedRepos.active')}: {activeRepo}</p>
                </Item>

                {isTizenApiAvailable && (
                    <Item focusKey="home-card-modules" onClick={() => loc.route('/ui/dist/index.html/manage-modules')}>
                        <h3 className='text-indigo-300 text-base/7 font-semibold'>
                            <span className='flex items-center gap-2'><CubeIcon className='h-8 w-8 text-indigo-300' />{t('tbModules.homeButton')}</span>
                        </h3>
                        <p className="mt-2 text-sm text-slate-400">{t('tbModules.homeDesc')}</p>
                    </Item>
                )}

                {isTizenApiAvailable && (
                    <Item focusKey="home-card-check" onClick={handleCheck}>
                        <h3 className='text-sky-400 text-base/7 font-semibold'>
                            <span className='flex items-center gap-2'><MagnifyingGlassIcon className='h-8 w-8 text-sky-400' />{t('tizenBrewConfig.checkButton')}</span>
                        </h3>
                        <p className="mt-2 text-sm text-slate-400">{t('tizenBrewConfig.checkDesc')}</p>
                    </Item>
                )}

                {isTizenApiAvailable && (
                    <Item focusKey="home-card-reset" onClick={handleResetRequest}>
                        <h3 className='text-red-400 text-base/7 font-semibold'>
                            <span className='flex items-center gap-2'><TrashIcon className='h-8 w-8 text-red-400' />{t('tizenBrewConfig.resetButton')}</span>
                        </h3>
                        <p className="mt-2 text-sm text-slate-400">{t('tizenBrewConfig.resetDesc')}</p>
                    </Item>
                )}
            </div>
        </div>
    );
}