class Connection {
    constructor(connection) {
        this.connection = connection;
    }

    send(data) {
        this.connection.send(JSON.stringify(data));
    }

    Event(event, payload) {
        return { type: event, payload };
    }
}

const Events = {
    InstallPackage:         1,
    NavigateDirectory:      2,
    Error:                  3,
    InstallationStatus:     4,
    DeleteConfiguration:    5,
    ConnectToTV:            6,
    CheckTizenBrewConfig:   7,
    ResetTizenBrewConfig:   8,
    GetTBModules:           9,
    AddTBModule:            10,
    RemoveTBModule:         11,
    CheckConfigurationAccess: 12,
};

module.exports = { Connection, Events };