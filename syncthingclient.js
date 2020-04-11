const syncthing = require('node-syncthing')
const Promise = require('promise')

function SyncthingClient(json) {
    if(!json.syncthingHost) {
        return null
    }

    const options = {
        host: json.syncthingHost,
        port: json.syncthingPort,
        apiKey: json.syncthingApiKey,
        username: json.syncthingUsername,
        password: json.syncthingPassword,
        https: json.syncthingSecure
    };

    this.folder = json.syncthingFolderID
    this.client = syncthing(options)
}

SyncthingClient.prototype.status = function () {
    let self = this;
    return new Promise(function (fulfill, reject) {
        self.client.db.status(self.folder).then( result => {
            fulfill(result)
        }, error => {
            reject(error)
        });
    });
}

SyncthingClient.prototype.browse = function () {
    let self = this;
    return new Promise(function (fulfill, reject) {
        self.client.db.browse(self.folder).then( result => {
            fulfill(result)
        }, error => {
            reject(error)
        });
    });
}

module.exports = {
    SyncthingClient: SyncthingClient
}