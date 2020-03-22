const express = require('express');
const app = express();
const fs = require('fs-extra');
const bodyParser = require('body-parser');
const url = require('url');
const FILEPATH_SETTINGS = __dirname + '/settings.json';
let Rtorrent = require('./rtorrentclient').RtorrentClient;
let Ftp = require('./ftpclient').FTPClient;
var rtorrent;
var ftp;

module.exports = {
    setup: function () {

        app.use(express.static('public'));
        app.use(bodyParser.urlencoded({ extended: true }));
        app.use(bodyParser.json());

        app.set('view engine', 'ejs');

        app.get('/', function (request, response) {
            fs.readFile(FILEPATH_SETTINGS, function (error, data) {
                if (error) {
                    response.send(error);
                } else {
                    response.render('index', JSON.parse(data));
                }
            });
        });

        app.get('/list', function (request, response) {
            let self = this;
            Promise.all([ftp.connect(), rtorrent.fetchAll("finished", ftp.mappingPath)]).then(results => {
                response.render('list', { torrents: results[results.length - 1] });
            }).catch(error => {
                response.send(error);
            });
        });

        app.post('/save', function (request, response) {
            const json = JSON.stringify(request.body);

            fs.writeFile(FILEPATH_SETTINGS, json, (error) => {
                if (error) {
                    response.send(error);
                } else {
                    rtorrent = new Rtorrent(request.body);
                    ftp = new Ftp(request.body);
                    response.redirect('/list');
                }
            });
        });

        app.get('/delete/all', function (request, response) {
            rtorrent.fetchAll("finished", ftp.mappingPath).then(results => {
                if (results.length == 0) {
                    response.redirect('/list');
                } else {
                    let torrent = results[0];
                    response.redirect(url.format({
                        pathname: '/delete',
                        query: {
                            'hash': torrent.hash,
                            'path': torrent.encodedPath,
                            'redir': encodeURIComponent('/delete/all')
                        }
                    }));
                }
            }).catch(error => {
                response.send(error);
            });
        });

        app.get('/delete', function (request, response) {
            const hash = request.query.hash;
            const path = decodeURIComponent(request.query.path);
            const redir = decodeURIComponent(request.query.redir);
            rtorrent.stopTorrent(hash).then(stopResult => {
                return ftp.removeFileOrDirectory(path);
            }).then(ftpDeleteResult => {
                return rtorrent.eraseTorrent(hash);
            }).then(eraseTorrentResult => {
                response.redirect( redir == 'undefined' ? '/list' : redir );
            }).catch(error => {
                response.send(error);
            });
        });

        app.listen(2101, function () {
            console.log('Listening on port 2101');
        });
    }
}