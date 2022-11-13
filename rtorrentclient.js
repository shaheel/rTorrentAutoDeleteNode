var Xmlrpc = require('xmlrpc');
var Promise = require('promise');

function RtorrentClient(json) {
    const options = {
        host: json.host,
        port: json.port,
        path: json.path,
        basic_auth: {
            user: json.username,
            pass: json.password
        }
    }

    this.mappingPath = json.mappingRtorrentPath
    this.client = json.ssl === "on" ? Xmlrpc.createSecureClient(options) : Xmlrpc.createClient(options)
}

RtorrentClient.prototype.call = function (command, data) {
    let self = this
    return new Promise(function (fulfill, reject) {
        self.client.methodCall(command, data, function (error, value) {
          if (error) reject(error)
          else fulfill(value)
        })
    })
}

// https://github.com/roastlechon/nodejs-rtorrent/blob/master/src/node/lib/rtorrent.js
RtorrentClient.prototype.getStatus = function (value) {
	if (value[0] === '1' && value[1] === '1' && value[2] === '0' && value[3] === '1') {
		return 'seeding';
	} else if (value[0] === '1' && value[1] === '0' && value[2] === '0' && value[3] === '0') {
		return 'finished';
	} else if (value[0] === '0' && value[1] === '1' && value[2] === '0' && value[3] === '1') {
		return 'downloading';
	} else if (value[0] === '0' && value[1] === '0' && value[2] === '0' && value[3] === '1') {
		// stopped in the middle
		return 'stopped';
	} else if (value[0] === '0' && value[1] === '0' && value[2] === '0' && value[3] === '0') {
		// i dont know stopped
		return 'stopped';
	} else if (value[0] === '0' && value[1] === '1' && value[2] === '0' && value[3] === '0') {
		return 'paused';
	} else if (value[0] === '1' && value[1] === '1' && value[2] === '0' && value[3] === '0') {
		// seeding pause
		return 'paused';
	} else if (value[0] === '1' && value[1] === '0' && value[2] === '0' && value[3] === '1') {
		return 'finished';
	} else if (value[2] === '1') {
		return 'checking';
	}
}

RtorrentClient.prototype.getVariables = function () {
    return ["",
    "main",
    "d.name=",
    "d.hash=",
    "d.directory=",
    "d.is_multi_file=",
    // Following variables are used to fetch status via slice in mapTorrents function
    "d.get_complete=",
    "d.is_open=",
    "d.is_hash_checking=",
    "d.get_state=",
   ];
}

RtorrentClient.prototype.mapTorrents = function (torrents, otherMapPath) {

    let self = this
    function getPath(name, directory, isMultiFile, otherMapPath) {
        let result
        if (isMultiFile === '1') {
            result = directory
        } else {
            result = directory + '/' + name
        }

        if(otherMapPath != 'undefined') {
            result = result.replace(self.mappingPath, otherMapPath)
        }

        return result
    }

    return torrents.map(torrent => ({
        name: torrent[0],
        hash: torrent[1],
        path: getPath(torrent[0], torrent[2], torrent[3], otherMapPath),
        encodedPath: encodeURIComponent(getPath(torrent[0], torrent[2], torrent[3], otherMapPath)),
        status: this.getStatus(torrent.slice(torrent.length - 4, torrent.length))
    }));
}

RtorrentClient.prototype.fetchAll = function (status, otherMapPath) {
    let self = this
    return new Promise(function (fulfill, reject) {
        self.call("d.multicall2", self.getVariables())
        .done(function (torrents) {
            let result = self.mapTorrents(torrents, otherMapPath)

            if(status != null) {
                result = result.filter(function(torrent) {
                    return torrent["status"] == status
                })
            }

            fulfill(result)

        }, reject)
    })
}

RtorrentClient.prototype.fetchAllRaw = function () {
    let self = this
    return new Promise(function (fulfill, reject) {
        self.call("d.multicall2", self.getVariables())
        .done(function (torrents) {
            fulfill(torrents)
        }, reject)
    })
}

RtorrentClient.prototype.stopTorrent = function(hash) {
    return this.call("d.stop", [hash]);
}

RtorrentClient.prototype.eraseTorrent = function(hash) {
    return this.call("d.erase", [hash]);
}

module.exports = {
    RtorrentClient: RtorrentClient
}