# rTorrentAutoDelete
A GUI for rTorrent to auto delete downloads with data via an FTP client, all written in Node.js

#### Main Feature
See your list of finished downloads and delete them with data in a single click or automated (tbd)

### Usage
From the root directory
1. Run `npm install`
2. Run `node app.js`
3. Open `localhost:2101` or your IP_ADDRESS:2101 with a Web Browser

#### Note
rTorrentAutoDelete is very much a work-in-progress and should be used with caution
This project was created to facilite batch deletion on download finished as currently with other GUIs it is a very painful process.

#### TODO
Following improvements are still yet to be done :

 * Improve listing GUI
 * Improve batch delete script to avoid timeouts
 * Make FTP client optional (delete keeping data)
 * Add syncthing support (delete on sync finished)