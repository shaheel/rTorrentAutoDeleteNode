const ftp = require("basic-ftp");
var Promise = require('promise');

function FTPClient(json) {
    this.settings = {
        host: json.ftpHost,
        port: json.ftpPort,
        user: json.ftpUsername,
        password: json.ftpPassword,
        secure: json.ftpSecure === 'on' ? true : false,
    }

    this.mappingPath = json.mappingFtpPath;
    this.client = new ftp.Client();
}

FTPClient.prototype.connect = function () {
    let self = this;
    return new Promise(function (fulfill, reject) {
        if (self.client.closed) {
            self.client.access(self.settings)
                .then(ftpResponse => {
                    fulfill(ftpResponse);
                })
                .catch(error => {
                    reject(error);
                });
        } else {
            fulfill();
        }
    });
};

FTPClient.prototype.close = function () {
    let self = this;
    return new Promise(function (fulfill, reject) {
        if (self.client.closed) {
            fulfill();
        } else {
            self.client.close().then(value => {
                fulfill(value);
            }).catch(error => {
                reject(error);
            });
        }
    });
};

FTPClient.prototype.list = function (path) {
    let self = this;
    return new Promise(function (fulfill, reject) {
        self.connect().then(connectResult => {
            return self.client.list(path);
        }).then(result => {
            fulfill(result);
        }).catch(error => {
            reject(error);
        });
    });
};

FTPClient.prototype.removeFileOrDirectory = function (path) {
    let self = this;
    return new Promise(function (fulfill, reject) {
        self.connect().then(connectResult => {
            return self.client.removeDir(path);
        }).then(result => {
            fulfill(result);
        }).catch(error => {
            if(error.code == 550) {
                self.client.remove(path).then(result => {
                    fulfill(result);
                }, error => {
                    reject(error);
                });
            } else {
                reject(error);
            }
        });
    });
};

module.exports = {
    FTPClient: FTPClient
}