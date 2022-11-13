const express = require('express')
const app = express()
const fs = require('fs-extra')
const bodyParser = require('body-parser')
const url = require('url')
const http = require('http').Server(app)
const io = require('socket.io')(http)
const {default: PQueue} = require('p-queue')
const FILEPATH_SETTINGS = '/config/settings.json'
let Promise = require('promise');
let Rtorrent = require('./rtorrentclient').RtorrentClient
let Ftp = require('./ftpclient').FTPClient
let Syncthing = require('./syncthingclient').SyncthingClient
var rtorrent
var ftp
var syncthing
const queue = new PQueue({concurrency: 1})
var cron = require('node-cron');

function getSettings() {
    return new Promise(function(fulfill, reject) {
        fs.ensureFile(FILEPATH_SETTINGS, function(error) {
            if(!error) {
                fs.readJson(FILEPATH_SETTINGS, function(error, data) {
                    if(!error) {
                        fulfill(data)
                    } else {
                        reject(error)
                    }
                })
            } else {
                reject(error)
            }
        })
    })
}

function setSettings(data) {
    return new Promise(function(fulfill, reject) {
        fs.ensureFile(FILEPATH_SETTINGS, function(error) {
            if(error) {
                reject(error)
            } else {
                fs.writeJson(FILEPATH_SETTINGS, data, (error) => {
                    if (error) {
                        reject(error)
                    } else {
                        fulfill()
                    }
                })
            }
       })
    })
}

function resetServices() {
    rtorrent = null
    ftp = null
    syncthing = null
}

function setupServicesIfNeeded() {
    return new Promise(function(fulfill, reject) {
        if(!rtorrent || !ftp) {
            getSettings().then( json => {
                rtorrent = new Rtorrent(json)
                ftp = new Ftp(json)
                syncthing = new Syncthing(json)
                fulfill()
            }, error => {
                reject(error)
            })
        } else {
            fulfill()
        }
    })
}

function deleteTorrent(hash, path) {
    return new Promise(function (fulfill, reject) {
       rtorrent.stopTorrent(hash).then(stopResult => {
            return ftp.removeFileOrDirectory(path)
        }).then(ftpDeleteResult => {
            return rtorrent.eraseTorrent(hash)
        }).then(eraseTorrentResult => {
            fulfill(eraseTorrentResult)
        }).catch(error => {
            reject(error)
        })
    })
}

function deleteAllFinishedTorrentsWithSocketEmission() {
    if(queue.size !== 0 && queue.pending !== 0) {
        setTimeout(() => {
            io.emit('deletion', 'Please wait ' + queue.size+queue.pending + ' deletion in progress')
        }, 100);
        return
    }

    rtorrent.fetchAll("finished", ftp.mappingPath).then(results => {
        results.forEach(torrent => {
            io.emit('deletion', 'Queued for deletion ' + torrent.name)
            queue.add(() => new Promise(function (fulfill, reject) {
                deleteTorrent(torrent.hash, torrent.path).then(result => {
                    io.emit('deletion', 'Deleted ' + torrent.name)
                    fulfill(result)
                }, error => {
                    io.emit('deletion', 'An error occured while deleting' + torrent.name)
                    reject(error)
                })
            }))
        })
    })

    queue.on('idle', () => {
        io.emit('deletion', 'Completed')
    })
}

function syncCheck() {
    return new Promise(function (fulfill, reject) {
        if (syncthing != null) {
            syncthing.status().then(result => {
                if(result["state"] == "idle") {
                    fulfill(true)
                } else {
                    reject(result["state"])
                }
            },error => {
                reject(error)
            })
        } else {
            fulfill(true)
        }
    })
}

module.exports = {

    setup: function () {
        app.use(express.static('public'))
        app.use(bodyParser.urlencoded({ extended: true }))
        app.use(bodyParser.json())

        app.set('view engine', 'ejs')

        app.get('/', function (request, response) {
            getSettings().then( data => {
                response.render('index', data)
            }, _ => {
                response.render('index')
            })
        })

        app.get('/list', function (request, response) {
            let self = this
            setupServicesIfNeeded().then( _ => {
                let services = [rtorrent.fetchAll(request.query.status, ftp.mappingPath), ftp.connect()]
                if (syncthing != null) {
                    services.push(syncthing.status())
                }
    
                Promise.all(services).then(results => {
                    response.render('list', { torrents: results[0], syncthing: self.syncthing != 'undefined' ? results[results.length - 1] : null })
                }).catch(error => {
                    response.send(error)
                })
            }, error => {
                response.send(error)
            })
        })

        app.post('/save', function (request, response) {
            resetServices()
            setSettings(request.body).then( _ => {
                response.redirect('/list')
            }, error => {
                response.send(error)
            })
        })

        app.get('/delete/all', function (request, response) {
            Promise.all([syncCheck(), rtorrent.fetchAll("finished", ftp.mappingPath)]).then(results => {                
                if (results[1].length == 0) {
                    response.redirect('/list')
                } else {
                    response.render('delete')
                    deleteAllFinishedTorrentsWithSocketEmission()
                }
            }).catch(error => {
                response.send(error)
            })
        })

        app.get('/delete', function (request, response) {
            const hash = request.query.hash
            const path = decodeURIComponent(request.query.path)
            const redir = decodeURIComponent(request.query.redir)

            Promise.all([syncCheck(), deleteTorrent(hash, path)]).then(results => {
                response.redirect( redir == 'undefined' ? '/list' : redir )
            }).catch(error => {
                response.send(error)
            })
        })

        http.listen(2101, function () {
            console.log('Listening on port 2101')

            cron.schedule('0 */6 * * *', () => {
                console.log('Auto delete just ran. Scheduled for every 6 hours');
                deleteAllFinishedTorrentsWithSocketEmission();
            });
        })
    }
}