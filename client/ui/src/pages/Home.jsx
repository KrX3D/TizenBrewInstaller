import { ArrowDownIcon, ArrowPathIcon, TrashIcon, MagnifyingGlassIcon, BookmarkIcon } from '@heroicons/react/16/solid';
import { useContext, useRef } from 'react';
import { GlobalStateContext } from '../components/ClientContext.jsx';
import Item from '../components/Item.jsx';
import SignInQrCode from '../assets/signInQrCode.png';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'preact-iso';
import { Events } from '../components/WebSocketClient.js';
import { useEffect } from 'preact/hooks';

export default function Home() {
    const isTizenApiAvailable = typeof tizen !== 'undefined' && tizen.application && tizen.application.getAppInfo;
    const context = useContext(GlobalStateContext);
    const { t } = useTranslation();
    const loc = useLocation();
    // Prevent the auto-check from firing more than once even if deps re-evaluate
    const didAutoCheck = useRef(false);

    if (!isTizenApiAvailable) loc.route('/ui/dist/index.html/desktop');

    let isTizenBrewInstalled = false;
    let installedVersion = null;
    try {
        const appInfo = tizen.application.getAppInfo('xvvl3S1bvH.TizenBrewStandalone');
        isTizenBrewInstalled = true;
        installedVersion = appInfo.version;
    } catch (e) { }

    useEffect(() => {
        if (
            context.state.client !== null &&
            context.state.client.socket &&
            context.state.client.socket.readyState === WebSocket.OPEN &&
            !didAutoCheck.current
        ) {
            didAutoCheck.current = true;

            const appInfo = tizen.application.getAppInfo();
            if (appInfo.packageId === 'xvvl3S1bTU') {
                alert(t('installer.installingAgain'));
                context.state.client.send({
                    type: Events.InstallPackage,
                    payload: { url: 'reisxd/TizenBrewInstaller' }
                });
            }

            try {
                if (appInfo.packageId === 'xvvl3S1bTI') {
                    tizen.application.getAppInfo('xvvl3S1bTU.TizenBrewStandalone');
                    alert(t('installer.alreadyInstalled'));
                }
            } catch (e) { }

            context.state.client.send({ type: Events.CheckTizenBrewConfig });
        }
    }, [context.state.client, context.state.client?.socket?.readyState]);

    return (
        <div className="relative isolate lg:px-8">
            {context.state.sharedData.qrCodeShow && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="p-8 rounded-2xl shadow-2xl max-w-full">
                        <h3 className="text-3xl font-bold mb-4">{t('resigning.resigningRequired')}</h3>
                        <p className="text-xl mb-4 whitespace-pre">{t('resigning.resigningRequiredDesc')}</p>
                        <img
                            src={SignInQrCode}
                            alt="Sign In QR Code"
                            className="mt-2 w-80 h-80 max-w-full max-h-[60vw] object-contain mx-auto border-8 rounded-lg"
                        />
                        <p className="mt-4 text-lg">{t('resigning.resigningRequiredAccessInfo', { ip: webapis.network.getIp() })}</p>
                        <p className="mt-4 text-lg">{t('resigning.resigningDeviceSameNetwork')}</p>
                    </div>
                </div>
            )}
            <div className="mx-auto flex flex-wrap justify-center gap-4 top-4 relative">
                <Item onClick={() => {
                    context.state.client.send({
                        type: Events.InstallPackage,
                        payload: { url: context.state.sharedData.tizenBrewRepo }
                    });
                }}>
                    <h3 className='text-indigo-400 text-base/7 font-semibold'>
                        {isTizenBrewInstalled ? (
                            <span className='flex items-center gap-2'>
                                <ArrowPathIcon className='h-8 w-8 text-indigo-400' />
                                {t('installer.updateTB')}
                            </span>
                        ) : (
                            <span className='flex items-center gap-2'>
                                <ArrowDownIcon className='h-8 w-8 text-indigo-400' />
                                {t('installer.installTB')}
                            </span>
                        )}
                    </h3>
                    <p className="mt-2 text-sm text-slate-300 break-all">Repo: {context.state.sharedData.tizenBrewRepo}</p>
                    {installedVersion && <p className="text-sm text-slate-300">Installed: {installedVersion}</p>}
                </Item>

                <Item onClick={() => loc.route('/ui/dist/index.html/install-from-usb')}>
                    <h3 className='text-indigo-400 text-base/7 font-semibold'>
                        <span className='flex items-center gap-2'>
                            <ArrowDownIcon className='h-8 w-8 text-indigo-400' />
                            {t('installer.installFromUSB')}
                        </span>
                    </h3>
                </Item>

                <Item onClick={() => loc.route('/ui/dist/index.html/install-from-gh')}>
                    <h3 className='text-indigo-400 text-base/7 font-semibold'>
                        <span className='flex items-center gap-2'>
                            <ArrowDownIcon className='h-8 w-8 text-indigo-400' />
                            {t('installer.installFromGH')}
                        </span>
                    </h3>
                </Item>

                <Item onClick={() => loc.route('/ui/dist/index.html/saved-repos')}>
                    <h3 className='text-violet-400 text-base/7 font-semibold'>
                        <span className='flex items-center gap-2'>
                            <BookmarkIcon className='h-8 w-8 text-violet-400' />
                            {t('savedRepos.button')}
                        </span>
                    </h3>
                    <p className="mt-2 text-sm text-slate-400">
                        {t('savedRepos.desc', { count: context.state.sharedData.repoList.length })}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 break-all">
                        {t('savedRepos.active')}: {context.state.sharedData.tizenBrewRepo}
                    </p>
                </Item>

                {isTizenApiAvailable && (
                    <Item onClick={() => {
                        context.state.client.send({ type: Events.CheckTizenBrewConfig });
                    }}>
                        <h3 className='text-sky-400 text-base/7 font-semibold'>
                            <span className='flex items-center gap-2'>
                                <MagnifyingGlassIcon className='h-8 w-8 text-sky-400' />
                                {t('tizenBrewConfig.checkButton')}
                            </span>
                        </h3>
                        <p className="mt-2 text-sm text-slate-400">{t('tizenBrewConfig.checkDesc')}</p>
                    </Item>
                )}
                {isTizenApiAvailable && (
                    <Item onClick={() => {
                        context.state.client.send({ type: Events.ResetTizenBrewConfig });
                    }}>
                        <h3 className='text-red-400 text-base/7 font-semibold'>
                            <span className='flex items-center gap-2'>
                                <TrashIcon className='h-8 w-8 text-red-400' />
                                {t('tizenBrewConfig.resetButton')}
                            </span>
                        </h3>
                        <p className="mt-2 text-sm text-slate-400">{t('tizenBrewConfig.resetDesc')}</p>
                    </Item>
                )}
            </div>
        </div>
    );
}