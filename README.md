# rTorrentAutoDelete
A lightweight GUI for rTorrent to auto delete finished downloads with data using a FTP client, all written in Node.js

#### Main Feature
* See your list of finished downloads and delete them with data in a single click or automated.
* Delete your downloads via FTP instead of using a rtorrent client.
* Delete only when syncthing is not in progress to ensure that files were synced first.
* Automatically delete your downloads every 6 hours

### Installation
From the root directory
1. Run `npm install`
2. Run `node app.js`
3. Open `localhost:2101` or your IP_ADDRESS:2101 with a Web Browser

### unRAID installation
1. Click on "Docker" tab in the unRAID webui
2. In "Template repositories:" field add https://github.com/shaheel/docker-templates
3. Click on "Save" button
4. On the "Docker" tab, click "Add Container" button
5. Select "rtorrent-auto-delete-node", fill out the required fields, mainly Config path.
6. Click on "Apply"
7. Once the image is downloaded, it will appear in the "Docker Containers" sub-tab

#### Note
rTorrentAutoDelete is very much a work-in-progress and should be used with caution
This project was created to facilite batch deletion on finished downloads as currently with other GUIs for rTorrent it is a very painful process.

#### TODO
Following improvements are still yet to be done (by order of priority) :

 * Add a setting to change number of minute of hours to auto delete
 * Handle errors on validating settings with a proper GUI.
 * Improve listing GUI.
 * Make FTP client optional (delete keeping data)
