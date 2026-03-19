/**
 * Known apps with their GitHub repo and Tizen package ID.
 * To add a new app, just add another entry here.
 *
 * repoName:  the last segment of the GitHub repo path, lowercase
 * packageId: the full Tizen app ID (packageId.AppName)
 */
export const KNOWN_APPS = [
    {
        repoName:  'tizenbrew',
        packageId: 'xvvl3S1bvH.TizenBrewStandalone',
    },
    {
        repoName:  'tizenbrewinstaller',
        packageId: 'xvvl3S1bTI.TizenBrewStandalone',
    },
    // Add more here, e.g.:
    // {
    //     repoName:  'mysamsungapp',
    //     packageId: 'xxxxxxxxxx.MyAppName',
    // },
];

// Derived lookup map for fast access — don't edit this
export const REPO_NAME_TO_PACKAGE_ID = Object.fromEntries(
    KNOWN_APPS.map(app => [app.repoName, app.packageId])
);