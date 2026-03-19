"use strict";

const isTV = typeof tizen !== 'undefined';

module.exports.onStart = function () {
    console.log('Service started');
    const express = require('express');
    const fetch = require('node-fetch');
    const https = require('https');
    const adbhost = require('adbhost');
    const {
        readConfig,
        writeConfig,
        deleteConfig,
        canActuallyWriteConfig,
        canActuallyDeleteConfig,
        tryFixConfigPermissions
    } = require('./utils/configuration.js');
    const { fetchLatestRelease } = require('./utils/GitHubAPI.js');
    const { createSamsungCertificate, resignPackage } = require('./utils/SamsungCertificateCreation.js');
    const { writeFileSync, readFileSync, readdirSync, statSync, mkdirSync, existsSync } = require('fs');
    const { setValue } = require('./utils/Buxton2.js');
    const { join, dirname } = require('path');
    const { parsePackage, installPackage } = require('./utils/PackageInstallation.js');
    const { Connection, Events } = require('./utils/wsCommunication.js');
    const { homedir } = require('os');
    const AccessInfoHTMLPage = require('./utils/HTMLPage.js');
    const PushFile = require('./utils/FilePusher.js');

    let WebSocket;
    let adbClient;
    let wsClient = null;
    let canConnectToDevice = null;
    let isConnected = false;
    if (process.version === 'v4.4.3') {
        WebSocket = require('ws-old');
    } else {
        WebSocket = require('ws-new');
    }

    const app = express();
    if (!isTV) {
        console.log('Open up http://localhost:8091/ui/dist/index.html to access the TizenBrew Installer.');
        if (existsSync(`${process.platform === 'win32' ? 'C:\\' : '/'}snapshot/client`)) {
            app.use(express.static(`${process.platform === 'win32' ? 'C:\\' : '/'}snapshot/client`));
        } else app.use(express.static(join(__dirname, '../../')));
    }
    let isTizen7OrHigher = isTV && Number(tizen.systeminfo.getCapability('http://tizen.org/feature/platform.version').split('.')[0]) >= 7;
    const isTizen3 = isTV && tizen.systeminfo.getCapability('http://tizen.org/feature/platform.version').startsWith('3.0');
    const wsServer = new WebSocket.Server({ server: app.listen(8091) });

    function checkCanConnectToDevice() {
        fetch('http://127.0.0.1:8001/api/v2/').then(res => res.json())
            .then(json => {
                canConnectToDevice = (json.device.developerIP === '127.0.0.1' || json.device.developerIP === '1.0.0.127') && json.device.developerMode === '1';
            }).catch(() => {
                setTimeout(checkCanConnectToDevice, 1000);
            });
    }

    isTV && checkCanConnectToDevice();

    function createAdbConnection(ip) {
        return new Promise((resolve, reject) => {
            try {
                if (adbClient) {
                    if (adbClient._stream) {
                        adbClient._stream.removeAllListeners('connect');
                        adbClient._stream.removeAllListeners('error');
                        adbClient._stream.removeAllListeners('close');
                    }
                }

                adbClient = adbhost.createConnection({ host: ip || '127.0.0.1', port: 26101 });
                let hasConnected = false;
                const waitTimeout = setTimeout(() => {
                    if (hasConnected) resolve(adbClient);
                }, 1000);

                adbClient._stream.on('connect', () => {
                    hasConnected = true;
                    isConnected = true;
                    if (isTV) {
                        clearTimeout(waitTimeout);
                        resolve(adbClient);
                    }
                });

                adbClient._stream.on('error', (e) => {
                    adbClient = null;
                    hasConnected = false;
                    clearTimeout(waitTimeout);
                    if (e.code === 'ECONNREFUSED') {
                        reject(new Error('installerDesktop.sdbConnectionRefused'));
                    } else if (e.code === 'ECONNRESET') {
                        reject(new Error('installerDesktop.sdbConnectionReset'));
                    } else {
                        reject(new Error('ADB connection error: ' + e));
                    }
                });

                adbClient._stream.on('close', () => {
                    adbClient = null;
                    isConnected = false;
                    clearTimeout(waitTimeout);
                    reject(new Error('ADB connection closed.'));
                });
            } catch (e) {
                reject(new Error('ADB connection error: ' + e));
            }
        });
    }

    function mkdirRecursive(targetDir) {
        if (existsSync(targetDir)) return;
        const parent = dirname(targetDir);
        if (!existsSync(parent)) mkdirRecursive(parent);
        mkdirSync(targetDir);
    }

    function fetchWithCertFallback(url, options) {
        return fetch(url, options).catch(err => {
            const msg = String(err && err.message || err);
            const certErr = /certificate|unable to get local issuer|self signed/i.test(msg);
            if (!certErr) throw err;
            console.warn('[TLS fallback] Retrying download with relaxed certificate validation for:', url);
            return fetch(url, {
                ...options,
                agent: new https.Agent({ rejectUnauthorized: false })
            });
        });
    }

    wsServer.on('connection', (ws) => {
        const wsConn = new Connection(ws);
        wsClient = wsConn;
        ws.on('message', (message) => {
            let msg;
            try {
                msg = JSON.parse(message);
            } catch (e) {
                return wsConn.send(wsConn.Event(Events.Error, `Invalid JSON: ${message}`));
            }

            const { type, payload } = msg;

            switch (type) {
                case Events.InstallPackage: {
                    if (!isTizen3 && isTV) {
                        if (canConnectToDevice !== null && !canConnectToDevice) {
                            return wsConn.send(wsConn.Event(Events.Error, 'errors.debuggingNotEnabled'));
                        } else if (canConnectToDevice === null) return;
                    }
                    if (isTizen7OrHigher) {
                        const config = readConfig();
                        if (!config.authorCert || !config.distributorCert || !config.password) {
                            return wsConn.send(wsConn.Event(Events.InstallPackage, { response: 2 }));
                        }
                    }

                    function parseAndInstall(buffer) {
                        parsePackage(buffer)
                            .then(pkg => {
                                wsConn.send(wsConn.Event(Events.InstallationStatus, 'installStatus.installing'));
                                if (isTV) {
                                    if (!existsSync('/home/owner/share/tmp/sdk_tools')) mkdirRecursive('/home/owner/share/tmp/sdk_tools');
                                    writeFileSync(`/home/owner/share/tmp/sdk_tools/package.${pkg.isWgt ? 'wgt' : 'tpk'}`, buffer);
                                } else {
                                    PushFile(adbClient, `/home/owner/share/tmp/sdk_tools/package.${pkg.isWgt ? 'wgt' : 'tpk'}`, buffer, () => {
                                        installPackage(`/home/owner/share/tmp/sdk_tools/package.${pkg.isWgt ? 'wgt' : 'tpk'}`, pkg.packageId, adbClient)
                                            .then(result => {
                                                wsConn.send(wsConn.Event(Events.InstallationStatus, 'installStatus.installed'));
                                                wsConn.send(wsConn.Event(Events.InstallPackage, { response: 0, result }));
                                            })
                                            .catch(err => {
                                                wsConn.send(wsConn.Event(Events.Error, `Error installing package: ${err.message}`));
                                            });
                                    });
                                    return;
                                }

                                if (payload.url && payload.url === 'reisxd/TizenBrewInstaller' &&
                                    !isTV && existsSync(`${homedir()}/share/tizenbrewInstallerConfig.json`)) {
                                    PushFile(adbClient, '/home/owner/share/tizenbrewInstallerConfig.json', readFileSync(`${homedir()}/share/tizenbrewInstallerConfig.json`), () => {
                                        console.log('Config pushed to TV for Installer');
                                    });
                                }

                                if (isTizen3 && isTV) {
                                    Promise.resolve(installPackage(`/home/owner/share/tmp/sdk_tools/package.${pkg.isWgt ? 'wgt' : 'tpk'}`, pkg.packageId))
                                        .then(result => {
                                            setValue('db/sdk/develop/ip', 'string', '127.0.0.1');
                                            setValue('db/sdk/develop/mode', 'int32', '1');
                                            wsConn.send(wsConn.Event(Events.InstallationStatus, 'installStatus.installed'));
                                            wsConn.send(wsConn.Event(Events.InstallPackage, { response: 0, result }));
                                        })
                                        .catch(err => {
                                            wsConn.send(wsConn.Event(Events.Error, `Error installing package: ${err.message}`));
                                        });
                                } else if (isTV) {
                                    createAdbConnection()
                                        .then(adbClient => {
                                            installPackage(`/home/owner/share/tmp/sdk_tools/package.${pkg.isWgt ? 'wgt' : 'tpk'}`, pkg.packageId, adbClient)
                                                .then(result => {
                                                    wsConn.send(wsConn.Event(Events.InstallationStatus, 'installStatus.installed'));
                                                    wsConn.send(wsConn.Event(Events.InstallPackage, { response: 0, result }));
                                                    setTimeout(() => {
                                                        adbClient._stream.end();
                                                        adbClient._stream.destroy();
                                                    }, 5000);
                                                })
                                                .catch(err => {
                                                    wsConn.send(wsConn.Event(Events.Error, `Error installing package: ${err.message}`));
                                                });
                                        })
                                        .catch(err => {
                                            wsConn.send(wsConn.Event(Events.Error, err.message.includes('.') ? err.message : `Error creating ADB connection: ${err.message}`));
                                        });
                                }
                            })
                            .catch(err => {
                                wsConn.send(wsConn.Event(Events.Error, `Error parsing package: ${err.message}`));
                                console.error(err);
                            });
                    }

                    if (payload.url.split('/').length === 2) {
                        wsConn.send(wsConn.Event(Events.InstallationStatus, 'installStatus.fetching'));
                        fetchLatestRelease(payload.url)
                            .then(release => {
                                const asset = release.assets.find(a => a.name.endsWith('.wgt') || a.name.endsWith('.tpk'));
                                if (!asset) throw new Error('No .wgt/.tpk asset found in latest release.');
                                fetchWithCertFallback(asset.browser_download_url)
                                    .then(res => {
                                        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
                                        return res.buffer();
                                    })
                                    .then(buffer => {
                                        if (isTizen7OrHigher) {
                                            wsConn.send(wsConn.Event(Events.InstallationStatus, 'installStatus.resigning'));
                                            const config = readConfig();
                                            const certificates = {
                                                authorCert: Buffer.from(config.authorCert, 'base64').toString('binary'),
                                                distributorCert: Buffer.from(config.distributorCert, 'base64').toString('binary'),
                                                password: config.password
                                            };
                                            resignPackage(certificates, buffer)
                                                .then(resignedBuffer => {
                                                    wsConn.send(wsConn.Event(Events.InstallationStatus, 'installStatus.parsing'));
                                                    parseAndInstall(resignedBuffer);
                                                })
                                                .catch(err => {
                                                    wsConn.send(wsConn.Event(Events.Error, `Error resigning package: ${err.message}`));
                                                });
                                        } else parseAndInstall(buffer);
                                    })
                                    .catch(err => {
                                        wsConn.send(wsConn.Event(Events.Error, `Error fetching release asset: ${err.message}`));
                                    });
                            }).catch(err => {
                                wsConn.send(wsConn.Event(Events.Error, `Error fetching GitHub release: ${err.message}`));
                            });
                    } else {
                        const fileBuffer = readFileSync(payload.url);
                        if (isTizen7OrHigher) {
                            const config = readConfig();
                            const certificates = {
                                authorCert: Buffer.from(config.authorCert, 'base64').toString('binary'),
                                distributorCert: Buffer.from(config.distributorCert, 'base64').toString('binary'),
                                password: config.password
                            };
                            wsConn.send(wsConn.Event(Events.InstallationStatus, 'installStatus.resigning'));
                            resignPackage(certificates, fileBuffer)
                                .then(resignedBuffer => {
                                    wsConn.send(wsConn.Event(Events.InstallationStatus, 'installStatus.parsing'));
                                    parseAndInstall(resignedBuffer);
                                })
                                .catch(err => {
                                    wsConn.send(wsConn.Event(Events.Error, `Error resigning package: ${err.message}`));
                                });
                        } else {
                            wsConn.send(wsConn.Event(Events.InstallationStatus, 'installStatus.parsing'));
                            parseAndInstall(fileBuffer);
                        }
                    }
                    break;
                }

                case Events.NavigateDirectory: {
                    const directory = readdirSync(payload);
                    const metadata = [{
                        name: 'Go up one directory',
                        path: payload !== '/media' ? join(payload, '..') : '/media',
                        isDirectory: true
                    }];
                    for (const file of directory) {
                        const filePath = join(payload, file);
                        try {
                            const stats = statSync(filePath);
                            metadata.push({ name: file, path: filePath, isDirectory: stats.isDirectory() });
                        } catch (e) {}
                    }
                    wsConn.send(wsConn.Event(Events.NavigateDirectory, metadata));
                    break;
                }

                case Events.DeleteConfiguration: {
                    let result = deleteConfig();
                    if (!result.success) {
                        const fixResult = tryFixConfigPermissions();
                        if (fixResult.success) result = deleteConfig();
                    }
                    wsConn.send(wsConn.Event(Events.DeleteConfiguration, result));
                    break;
                }

                case Events.ConnectToTV: {
                    try {
                        createAdbConnection(payload)
                            .then(client => {
                                adbClient = client;
                                wsConn.send(wsConn.Event(Events.ConnectToTV, { success: true }));
                                const sysinfoCommand = adbClient.createStream('sysinfo:');
                                sysinfoCommand.on('data', (data) => {
                                    const INFOBUF_MAXLEN = 64;
                                    const platform_version = data.slice(INFOBUF_MAXLEN * 3, INFOBUF_MAXLEN * 4).toString().replace(/\0/g, '');
                                    isTizen7OrHigher = Number(platform_version.split('.')[0]) >= 7;
                                });
                            })
                            .catch(err => {
                                wsConn.send(wsConn.Event(Events.ConnectToTV, { success: false, error: err.message }));
                            });
                    } catch (e) {
                        wsConn.send(wsConn.Event(Events.ConnectToTV, { success: false, error: e.message }));
                    }
                    break;
                }

                default: {
                    wsConn.send(wsConn.Event(Events.Error, 'Invalid event type.'));
                    break;
                }
            }
        });
    });

    const appAccess = express();
    appAccess.use(express.urlencoded({ extended: false }));
    appAccess.use((request, response) => {
        if (request.method !== 'GET') {
            const body = JSON.parse(request.body.code);
            const accessInfo = { accessToken: body.access_token, userId: body.userId };
            const password = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-4);
            const authorInfo = {
                name: 'TizenBrew',
                email: body.inputEmailID,
                password,
                privilegeLevel: 'Partner'
            };

            function createCert(adbClient) {
                createSamsungCertificate(authorInfo, accessInfo, adbClient, isTV)
                    .then(certificate => {
                        const currentConfig = readConfig();
                        currentConfig.authorCert = Buffer.from(certificate.authorCert, 'binary').toString('base64');
                        currentConfig.distributorCert = Buffer.from(certificate.distributorCert, 'binary').toString('base64');
                        currentConfig.password = password;
                        if (isTV) {
                            if (!existsSync('/home/owner/share/tmp/sdk_tools')) mkdirRecursive('/home/owner/share/tmp/sdk_tools');
                            writeFileSync('/home/owner/share/tmp/sdk_tools/device-profile.xml', certificate.distributorXML);
                        } else {
                            PushFile(adbClient, '/home/owner/share/tmp/sdk_tools/device-profile.xml', Buffer.from(certificate.distributorXML, 'utf8'), () => {
                                console.log('Device profile pushed to TV');
                            });
                        }
                        writeConfig(currentConfig);
                        if (wsClient) wsClient.send(wsClient.Event(Events.InstallPackage, { response: 1 }));
                        response.status(200).send('Certificate creation was successful. You can now close this window.');
                    })
                    .catch(err => { response.status(500).json({ error: err.message }); });
            }

            if (isTV) {
                if (!adbClient && !isConnected) {
                    createAdbConnection().then(adbClient => createCert(adbClient)).catch(err => {
                        response.status(500).json({ error: err.message });
                    });
                } else createCert(adbClient);
            } else createCert(adbClient);
        } else {
            response.send(AccessInfoHTMLPage);
        }
    });

    appAccess.listen(4794);
};

!isTV && module.exports.onStart();