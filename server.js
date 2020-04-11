const express = require('express')
const app = express()
const fs = require('fs-extra')
const bodyParser = require('body-parser')
const url = require('url')
const http = require('http').Server(app)
const io = require('socket.io')(http)
const {default: PQueue} = require('p-queue')
const FILEPATH_SETTINGS = __dirname + '/settings.json'
let Promise = require('promise');
let Rtorrent = require('./rtorrentclient').RtorrentClient
let Ftp = require('./ftpclient').FTPClient
let Syncthing = require('./syncthingclient').SyncthingClient
var rtorrent
var ftp
var syncthing

function setupServices() {
    fs.readFile(FILEPATH_SETTINGS, function (error, data) {
        let json = JSON.parse(data)
        rtorrent = new Rtorrent(json)
        ftp = new Ftp(json)
        syncthing = new Syncthing(json)
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
    const queue = new PQueue({concurrency: 1})
    
    rtorrent.fetchAll("finished", ftp.mappingPath).then(results => {
        results.forEach(torrent => {
            io.emit('deletion', 'Deleting ' + torrent.name)
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

    let count = 0
    queue.on('active', () => {
        count++
        console.log('Working on item '+count)
    })

    queue.onEmpty().then(empty => {
        io.emit('deletion', 'Completed')
    })
}

module.exports = {

    setup: function () {
        app.use(express.static('public'))
        app.use(bodyParser.urlencoded({ extended: true }))
        app.use(bodyParser.json())

        app.set('view engine', 'ejs')

        app.get('/', function (request, response) {
            fs.readFile(FILEPATH_SETTINGS, function (error, data) {
                response.render('index', error ? null : JSON.parse(data))
            })
        })

        app.get('/list', function (request, response) {
            let self = this
            let services = [rtorrent.fetchAll(request.query.status, ftp.mappingPath), ftp.connect()]
            if (syncthing != null) {
                services.push(syncthing.status())
                syncthing.browse().then(result => {
                    console.log(result)
                })
            }

            Promise.all(services).then(results => {
                response.render('list', { torrents: results[0], syncthing: self.syncthing != 'undefined' ? results[results.length - 1] : null })
            }).catch(error => {
                response.send(error)
            })
        })

        app.post('/save', function (request, response) {
            const json = JSON.stringify(request.body)

            fs.writeFile(FILEPATH_SETTINGS, json, (error) => {
                if (error) {
                    response.send(error)
                } else {
                    response.redirect('/list')
                    rtorrent = new Rtorrent(request.body)
                    ftp = new Ftp(request.body)
                    syncthing = new Syncthing(request.body)
                }
            })
        })

        app.get('/delete/all', function (request, response) {            
            rtorrent.fetchAll("finished", ftp.mappingPath).then(results => {
                if (results.length == 0) {
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
            deleteTorrent(hash, path).then(eraseTorrentResult => {
                response.redirect( redir == 'undefined' ? '/list' : redir )
            }).catch(error => {
                response.send(error)
            })
        })

        http.listen(2101, function () {
            console.log('Listening on port 2101')
        })
    }
}