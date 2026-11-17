import i18next from 'i18next';
import { recordInstalledAppId } from '../utils/versionInfo.js';
import { getGitHubToken, setGitHubToken, formatResetTime } from '../utils/githubToken.js';
import { onInstallProgress, onInstallResult, onInstallError, onInstallFatal } from '../utils/installQueue.js';

const Events = {
    InstallPackage:           1,
    NavigateDirectory:        2,
    Error:                    3,
    InstallationStatus:       4,
    DeleteConfiguration:      5,
    ConnectToTV:              6,
    InstallFile:              7,
    GitHubTokenAddress:       8,
    GitHubToken:              9,
};

// The service sends either a plain string (often an i18n key) or
// { key, args } for errors that need values, e.g. the rate-limit reset time.
function errorText(payload) {
    if (payload && typeof payload === 'object' && payload.key) {
        const args = Object.assign({}, payload.args);
        if (args.reset !== undefined) args.time = formatResetTime(args.reset) || '?';
        return i18next.t(payload.key, args);
    }
    return i18next.t(payload);
}

class Client {
    constructor(context) {
        this.context = context;
        this.socket = new WebSocket('ws://localhost:8091');
        this.socket.onopen = this.onOpen.bind(this);
        this.socket.onmessage = this.onMessage.bind(this);
        this.socket.onerror = () => location.reload();
    }

    onOpen() {}

    onMessage(event) {
        const data = JSON.parse(event.data);
        const { type, payload } = data;
        const toast = window.__globalToast;

        switch (type) {
            case Events.InstallPackage: {
                const requiresResigning = payload.response === 2;
                if (requiresResigning) {
                    onInstallFatal(i18next.t('queue.needsCertificate'));
                    this.context.dispatch({ type: 'SET_QR_CODE', payload: true });
                } else if (payload.response === 0) {
                    if (payload.packageInfo?.appId && this.lastInstallUrl && this.lastInstallUrl !== 'reisxd/TizenBrewInstaller') {
                        recordInstalledAppId(this.lastInstallUrl, payload.packageInfo.appId);
                        this.context.dispatch({ type: 'REFRESH_VERSIONS' });
                    }

                    const installFailedLine = payload.result.split('\n').find(line => line.includes('install failed'));
                    onInstallResult(!installFailedLine, installFailedLine);
                    if (installFailedLine) {
                        this.context.dispatch({
                            type: 'SET_ERROR',
                            payload: { message: i18next.t('installStatus.installFailed', { line: installFailedLine }), disappear: false }
                        });
                        if (installFailedLine.includes('Check certificate error')) {
                            this.send({ type: Events.DeleteConfiguration });
                        }
                    }
                } else {
                    this.context.dispatch({ type: 'SET_QR_CODE', payload: false });
                }
                break;
            }
            case Events.NavigateDirectory: {
                this.context.dispatch({ type: 'SET_DIRECTORY', payload });
                break;
            }
            case Events.Error: {
                const message = errorText(payload);
                onInstallError(message);
                this.context.dispatch({
                    type: 'SET_ERROR',
                    payload: { message, disappear: false }
                });
                break;
            }
            case Events.GitHubTokenAddress: {
                this.context.dispatch({ type: 'SET_GITHUB_TOKEN_URLS', payload: payload.urls || [] });
                break;
            }
            case Events.GitHubToken: {
                if (payload && payload.token) {
                    setGitHubToken(payload.token);
                    if (toast) toast.success(i18next.t('githubToken.receivedToast'), 5000);
                    // Re-check versions now that the limit is higher.
                    this.context.dispatch({ type: 'REFRESH_VERSIONS' });
                }
                break;
            }
            case Events.InstallationStatus: {
                this.context.dispatch({ type: 'SET_STATE', payload });
                onInstallProgress();
                if (payload === 'installStatus.installed') {
                    this.context.dispatch({ type: 'REFRESH_VERSIONS' });
                }
                break;
            }
            case Events.ConnectToTV: {
                this.context.dispatch({ type: 'SET_CONNECTED_TO_TV', payload: payload.success });
                if (!payload.success) {
                    this.context.dispatch({
                        type: 'SET_ERROR',
                        payload: { message: payload.error, disappear: false }
                    });
                }
                break;
            }
        }
    }

    send(data) {
        if (data.type === Events.InstallPackage) {
            this.lastInstallUrl = data.payload?.url;
            const token = getGitHubToken();
            if (token && data.payload) data = { ...data, payload: { ...data.payload, githubToken: token } };
        }
        this.socket.send(JSON.stringify(data));
    }
}

export { Events };
export default Client;
