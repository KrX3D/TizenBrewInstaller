import i18next from 'i18next';

const Events = {
    InstallPackage: 1,
    NavigateDirectory: 2,
    Error: 3,
    InstallationStatus: 4,
    DeleteConfiguration: 5,
    ConnectToTV: 6,
    CheckTizenBrewConfig: 7,
    ResetTizenBrewConfig: 8,
};

class Client {
    constructor(context) {
        this.context = context;
        this.socket = new WebSocket('ws://localhost:8091');
        this.socket.onopen = this.onOpen.bind(this);
        this.socket.onmessage = this.onMessage.bind(this);
        this.socket.onerror = () => location.reload();
    }

    onOpen() {
    }

    onMessage(event) {
        const data = JSON.parse(event.data);
        const { type, payload } = data;
        const toast = window.__globalToast;

        switch (type) {
            case Events.InstallPackage: {
                // Handle package installation statuses
                const requiresResigning = payload.response === 2;
                if (requiresResigning) {
                    this.context.dispatch({
                        type: 'SET_QR_CODE',
                        payload: true
                    });
                } else if (payload.response === 0) {
                    const installFailedLine = payload.result.split('\n').find(line => line.includes('install failed'));
                    if (installFailedLine) {
                        this.context.dispatch({
                            type: 'SET_ERROR',
                            payload: {
                                message: i18next.t('installStatus.installFailed', { line: installFailedLine }),
                                disappear: false
                            }
                        });

                        if (installFailedLine.includes('Check certificate error')) {
                            this.send({
                                type: Events.DeleteConfiguration
                            });
                        }
                    }
                } else {
                    this.context.dispatch({
                        type: 'SET_QR_CODE',
                        payload: false
                    });
                }
                break;
            }

            case Events.NavigateDirectory: {
                // Handle directory navigation
                this.context.dispatch({
                    type: 'SET_DIRECTORY',
                    payload: payload
                });
                break;
            }

            case Events.Error: {
                // Handle errors
                this.context.dispatch({
                    type: 'SET_ERROR',
                    payload: {
                        message: i18next.t(payload),
                        disappear: false
                    }
                });
                break;
            }

            case Events.InstallationStatus: {
                // Handle installation status updates
                this.context.dispatch({
                    type: 'SET_STATE',
                    payload: payload
                });
                break;
            }

            case Events.ConnectToTV: {
                // Handle connection to the TV
                this.context.dispatch({
                    type: 'SET_CONNECTED_TO_TV',
                    payload: payload.success
                });
                
                if (!payload.success) {
                    this.context.dispatch({
                        type: 'SET_ERROR',
                        payload: {
                            message: payload.error,
                            disappear: false
                        }
                    });
                }
                break;
            }

            case Events.CheckTizenBrewConfig: {
                if (!toast) break;
                if (!payload.exists) {
                    toast.info(i18next.t('tizenBrewConfig.notFound'));
                    break;
                }
                if (payload.error) {
                    toast.error(i18next.t('tizenBrewConfig.statError', { error: payload.error }));
                    break;
                }
                const sizeKb = (payload.size / 1024).toFixed(1);
                const mtime = new Date(payload.mtime).toLocaleString();
                const permStr = [
                    payload.readable ? i18next.t('tizenBrewConfig.readable') : null,
                    payload.writable ? i18next.t('tizenBrewConfig.writable') : null,
                ].filter(Boolean).join(', ') || i18next.t('tizenBrewConfig.noPermissions');
                toast.info(
                    i18next.t('tizenBrewConfig.fileInfo', { sizeKb, mtime, permStr }),
                    6000
                );
                break;
            }

            case Events.ResetTizenBrewConfig: {
                if (!toast) break;
                switch (payload.status) {
                    case 'success':
                        toast.success(i18next.t('tizenBrewConfig.resetSuccess'));
                        break;
                    case 'notFound':
                        toast.info(i18next.t('tizenBrewConfig.notFound'));
                        break;
                    case 'permissionDenied':
                        toast.error(i18next.t('tizenBrewConfig.permissionDenied'));
                        break;
                    case 'error':
                        toast.error(i18next.t('tizenBrewConfig.resetError', { error: payload.message }));
                        break;
                    default:
                        break;
                }
                break;
            }
        }
    }

    send(data) {
        this.socket.send(JSON.stringify(data));
    }
}

export { Events };
export default Client;