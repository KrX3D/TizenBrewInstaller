"use strict";

const {
    existsSync,
    readFileSync,
    writeFileSync,
    unlinkSync,
    mkdirSync,
    openSync,
    closeSync,
    accessSync,
    constants,
    chmodSync
} = require("fs");
const { homedir } = require("os");

const CONFIG_PATH = `${homedir()}/share/tizenbrewInstallerConfig.json`;

function getDefaultConfig() {
    return {
        authorCert: null,
        distributorCert: null,
        password: null
    };
}

function ensureShareDir() {
    if (!existsSync(`${homedir()}/share`)) {
        mkdirSync(`${homedir()}/share`);
    }
}

function readConfig() {
    if (!existsSync(CONFIG_PATH)) {
        return getDefaultConfig();
    }

    try {
        return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    } catch (_) {
        return getDefaultConfig();
    }
}

function writeConfig(config) {
    ensureShareDir();

    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 4), {
        encoding: "utf8",
        mode: 0o666
    });
}

function canActuallyWriteConfig() {
    try {
        if (!existsSync(CONFIG_PATH)) {
            return true;
        }

        accessSync(CONFIG_PATH, constants.R_OK | constants.W_OK);

        // Real test: try opening for read/write
        const fd = openSync(CONFIG_PATH, "r+");
        closeSync(fd);

        return true;
    } catch (_) {
        return false;
    }
}

function canActuallyDeleteConfig() {
    try {
        if (!existsSync(CONFIG_PATH)) {
            return true;
        }

        // Deleting depends on directory permissions / security context,
        // not only file mode. Best local probe we can do here:
        accessSync(`${homedir()}/share`, constants.W_OK);
        return true;
    } catch (_) {
        return false;
    }
}

function tryFixConfigPermissions() {
    try {
        if (!existsSync(CONFIG_PATH)) {
            return { success: true, reason: "missing" };
        }

        // This may help on normal Unix permissions,
        // but won't bypass Tizen ownership/security labeling.
        chmodSync(CONFIG_PATH, 0o666);

        return {
            success: canActuallyWriteConfig(),
            reason: "chmod_attempted"
        };
    } catch (e) {
        return {
            success: false,
            reason: e.message
        };
    }
}

function deleteConfig() {
    if (!existsSync(CONFIG_PATH)) {
        return { success: true, deleted: false, reason: "missing" };
    }

    try {
        unlinkSync(CONFIG_PATH);
        return { success: true, deleted: true };
    } catch (e) {
        return {
            success: false,
            deleted: false,
            reason: e.message
        };
    }
}

module.exports = {
    CONFIG_PATH,
    readConfig,
    writeConfig,
    deleteConfig,
    canActuallyWriteConfig,
    canActuallyDeleteConfig,
    tryFixConfigPermissions
};