#!/usr/bin/env node

// ---------------------------------------------------
// 3rd party modules

var argv = require('minimist')(process.argv.slice(2));
//console.dir(argv);

var chokidar = require('chokidar');
require('colors');
var fs = require('fs-extra');
var path = require('path');
// used to generate a hash of a file
var crypto = require('crypto');
var glob = require("glob");
var winston = require('winston');
var moment = require('moment');

// ---------------------------------------------------
// custom imports
var configLoader = require('../lib/config'),
    config = {},
    upgradeNeeded = require('../lib/upgrade'),
    sncClient = require('../lib/snc-client'),
    notify = require('../lib/notify'),
    SearchUtil = require('../lib/search'),
    Search = SearchUtil.Search,
    runTests = require('../lib/tests'),
    FileRecordUtil = require('../lib/file-record'),
    FileRecord = FileRecordUtil.FileRecord,
    makeHash = FileRecordUtil.makeHash;

// our wrapper for winston used for logging
var logit = {};

// custom vars
var notifyObj = notify();
var notifyUserMsg = notifyObj.msg,
    notifyEnabled = true,
    // list of supported notification messages defined in notify.js
    msgCodes = notifyObj.codes;

var DOWNLOAD_OK = 1,
    DOWNLOAD_FAIL = -1,
    multiDownloadStatus = DOWNLOAD_OK;


var isMac = /^darwin/.test(process.platform);
//var isWin = /^win/.test(process.platform);

var testsRunning = false;

var chokiWatcher = false,
    chokiWatcherReady = false,
    chokiWatcherIgnore = ["**/.*"]; // ignore hidden files/dirs

var filesInQueueToDownload = 0,
    filesToPreLoad = {};

// a list of FileRecord objects indexed by file path for easy access
var fileRecords = {};

// ---------------------------------------------------

// entry point
function init() {

    if (argv.help) {
        displayHelp();
        process.exit(1);
        return;
    }

    // get config
    try {
        if (!argv.config) {
            console.log('The config argument must be specified (eg. --config app.config.json)'.red);
            console.log('Run with --help for more info');
            process.exit(1);
        }
        configLoader.setConfigLocation(argv.config);
        config = configLoader.getConfig();
    } catch (e) {
        winston.error('Configuration error:'.red, e.message);
        process.exit(1);
    }

    //config.debug = true;
    setupLogging();

    if (config.debug) {
        notifyObj.setDebug();
    }

    // Apply custom file watcher ignore rules
    if (config.ignoreFiles) {
        chokiWatcherIgnore = config.ignoreFiles;
    }

    function start(upgradeBlocks) {
        if (upgradeBlocks) {
            logit.error('Upgrade is needed. Please check the Readme and change logs online.'.red);
            process.exit(1);
        }


        if (argv.test) {
            logit.info('TEST MODE ACTIVATED'.green);
            testsRunning = true;
            runTests({
                addFile: addFile,
                getSncClient: getSncClient,
                readFile: readFile,
                writeFile: writeFile,
                send: send,
                push: push,
                trackFile: trackFile
            }, config);
            return;
        }

        if (argv.export) {
            if (argv.export === true || argv.export.length < 4) {
                logit.error('Please specify a proper export location.');
                logit.error('Eg. --export ~/Desktop/config.json');
                process.exit(1);
            }
            exportCurrentSetup(argv.export);
            return;
        }

        if (config.createAllFolders || argv.setup) {
            setupFolders(config, function () {
                logit.info('Created folders required for syncing records'.green);
            });
        }
        // pre add some files defined per root in config
        if (config.preLoad) {
            addConfigFiles();
        }

        // experimental search option (needs testing and cleanup)
        if (argv.search) {

            var queryObj = {
                query: argv.search_query || '',
                table: argv.search_table || '',
                download: argv.download || false,
                rows: argv.records_per_search || false,
            };

            // support search via config file
            if (argv.search.length > 0 && config.search[argv.search]) {
                var searchObj = config.search[argv.search];
                queryObj.query = searchObj.query || queryObj.query;
                queryObj.table = searchObj.table || queryObj.table;
                queryObj.download = searchObj.download || queryObj.download;
                queryObj.rows = searchObj.records_per_search || queryObj.rows;
            } else {
                logit.info('Note: running in demo mode as no defined search in your config file was found/specified.'.yellow);
                queryObj.demo = true;
            }


            logit.info('Performing search'.green);
            logit.info(queryObj);

            logit.info("Note: only the first root defined is supported for searching.\n".yellow);
            var firstRoot = getFirstRoot(),
                snc = getSncClient(firstRoot); // support first root for now

            var s = new Search(config, snc);
            s.getResults(queryObj, processFoundRecords);
            return;
        }

        // callback dependency
        if (argv.resync || config._resyncFiles) {
            // retest this!
            config._resyncFiles = true;
            resyncExistingFiles();
        }

        initComplete();
    }

    function initComplete() {
        if (filesInQueueToDownload !== 0) {
            // if files are being downloaded then the watcher will be started when
            // the download queue is cleared. Assumes all downloads complete before user
            // needs to download new files.
            return;
        }
        logit.log('initComplete.. starting watcher..');
        watchFolders();
    }

    upgradeNeeded(config, start);
}

function getFirstRoot() {
    var roots = config.roots,
        keys = Object.keys(roots),
        firstRoot = keys[0];
    return firstRoot;
}

function updateFileMeta(file, record) {
    fileRecords[file].updateMeta({
        sys_id: record.sys_id,
        sys_updated_on: record.sys_updated_on,
        sys_updated_by: record.sys_updated_by
    });
}


/**
 * Remove problematic characters for saving to a file
 * @param pathPart {string} - a folder or file name (not full path) to normalise
 * @return {string} - updated path
 */
function normaliseRecordName(pathPart) {
    var newName = pathPart;
    newName = newName.replace(/\//g, '_');
    newName = newName.replace(/\*/g, '_');
    newName = newName.replace(/\\/g, '_');

    return newName;
}

/**
 * Adds some text to the end of the filename
 * @param postFix {string} - text to add
 * @param path {string} - current file path or file name
 * @return {string} - updated path
 */
function updateFileName(postFix, path) {
    var extension = path.split('.').pop(),
        regEx = new RegExp('\.' + extension),
        updated = path.replace(regEx, postFix + '.' + extension);

    return updated;
}

function processFoundRecords(searchObj, queryObj, records) {
    var firstRoot = getFirstRoot(),
        basePath = config.roots[firstRoot].root,
        totalFilesToSave = 0,
        totalErrors = 0;

    processRecords();

    function processRecords() {
        for (var i in records) {
            var record = records[i];

            var fileSystemSafeName = normaliseRecordName(record.recordName);
            // TODO : support saving in subdirs via config.folders[record.folder].subDirPattern
            var fileName = record.folder + '/' + fileSystemSafeName + '.' + record.fieldSuffix;
            var filePath = basePath + '/' + fileName;


            // allow records with the same name to be saved properly
            if (config.ensureUniqueNames) {
                filePath = updateFileName('_' + record.sys_id, filePath);
            }

            // seems like protected records that are read-only hide certain fields from view
            if (typeof records[i].recordData == 'undefined') {
                logit.warn('Found but will ignore to protected record: ' + filePath);
                totalErrors++;
                continue;
            }

            var validData = record.recordData.length > 0;
            if (validData) {
                logit.info('File to create: ' + filePath);
            } else {
                logit.info('Found but will ignore due to no content: ' + filePath);
                totalErrors++;
            }

            if (queryObj.download) {
                // don't save files of 0 bytes as this will confuse everyone
                if (validData) {
                    totalFilesToSave++;
                    saveFoundFile(filePath, record);
                }
            }
        }
        if (!queryObj.download) {
            if (totalErrors > 0) {
                logit.warn('Finished searching for files. %s file(s) will not be saved (see output above).', totalErrors);
            }
            process.exit(1);
        }
    }


    // save both the sync hash file and record as file.
    function saveFoundFile(file, record) {

        var data = record.recordData;

        if (!trackFile(file)) {
            logit.error('File (path) is not valid %s', file);
            totalFilesToSave--;
            totalErrors++;
            return;
        }

        updateFileMeta(file, record);

        fileRecords[file].saveHash(data, function (saved) {
            if (!saved) {
                logit.error('Failed to write out sync data file for %s', file);
                totalFilesToSave--;
                totalErrors++;
            } else {
                // no issues writing sync file so write out record to file

                fs.outputFile(file, data, function (err) {
                    totalFilesToSave--;
                    if (err) {
                        logit.error('Failed to write out file %s', file);
                        totalErrors++;
                    } else {
                        logit.info('Saved file %s', file);
                    }

                    // done writing out files.
                    if (totalFilesToSave <= 0) {
                        doneSaving();
                    }
                });
            }
        });
    }

    function doneSaving() {
        if (totalErrors > 0) {
            logit.warn('Finished creating files with errors. %s file(s) failed to save or had 0 bytes as content (see output above).',
                totalErrors);
        } else {
            logit.info('Finished creating files.');
        }
        process.exit(1);
    }
}

/*
 * Get a list of all the files and add it to "filesToPreLoad"
 */
function resyncExistingFiles() {
    var watchedFolders = Object.keys(config.roots);
    var roots = [];
    for (var i = 0; i < watchedFolders.length; i++) {
        // match all files in all directories (excludes .hidden dirs by default)
        roots.push(watchedFolders[i] + '/**/*');
    }
    var pattern = roots.join('');
    // can be multiple sets
    if (roots.length > 1) {
        pattern = '{' + roots.join(',') + '}';
    }

    glob(pattern, {
        nodir: true
    }, function (err, files) {
        if (err) logit.error('Exception:', err);

        if (files.length === 0) {
            logit.info('No files found to resync'.red);
            watchFolders();
        }

        // files is an array of filenames.
        for (var x in files) {
            //logit.info(('Adding file: '+files[x]).blueBG);
            addToPreLoadList(files[x], {
                filePath: files[x]
            });
        }
    });
}


function notifyUser(code, args) {
    // depending on the notification system, we could flood the OS and get blocked by security
    //   Eg. too many open files via terminal-notifier-pass.app launches)
    if (notifyEnabled) {
        notifyUserMsg(code, args);
    }
}

function addConfigFiles() {
    var filesToGet = 0;
    // each root
    for (var r in config.roots) {
        var basePath = r,
            root = config.roots[r];
        if (root.preLoadList) {
            // each folder (assume typed correctly)
            for (var folder in root.preLoadList) {
                // each file to create
                for (var file in root.preLoadList[folder]) {
                    var filePath = path.join(r, folder, root.preLoadList[folder][file]);
                    addToPreLoadList(filePath, {
                        filePath: filePath
                    });
                    filesToGet++;
                }
            }
        }
    }
    logit.log(('Downloading ' + filesToGet + ' files...').green + '(disable this by setting preLoad to false in your config file.)');
}

function addToPreLoadList(filePath, options) {
    options = options || {
        filePath: filePath
    };
    // only process if we don't already have it in the list
    if (typeof filesToPreLoad[filePath] == 'undefined') {
        filesToPreLoad[filePath] = options;
        addFile(filePath);
    }
}

function addIfNotPresent(filePath) {
    fs.exists(filePath, function (exists) {
        if (!exists) {
            addFile(filePath);
        }
    });
}


function displayHelp() {
    var msgs = ['--help                   :: shows this message',
                '--config <file>          :: specify a path to your app.config.json file',
                '--setup                  :: will create your folders for you',
                '--test                   :: will self test the tool and connection',
                '--resync                 :: will re-download all the files to get the latest server version',
                '--export <file>          :: export the current setup including downloaded records for quickstart',
                '--search <search config> :: will run a search on the instance for matching records based on the ' +
                                            'defined search config in the app.config.json file',
                '--download               :: applies to searching and will download the found records'

               ];
    console.log('Help'.green);
    console.log('List of options:');
    for (var i in msgs) {
        console.log(' ' + msgs[i]);
    }
}

function handleError(err, context) {
    logit.error(err);
    if (context) {
        logit.error('  handleError context:', context);
    }
}

function getSncClient(root) {
    var host = config.roots[root];
    if (!host._client) {
        host._logger = logit;
        host.debug = config.debug;
        host._client = sncClient(host);
    }
    return host._client;
}

/*
 * Copy the current config file in use and output a version without
 * sensitive data but with the preLoadList filled in as per the
 * current list of downloaded records.
 * */
function exportCurrentSetup(exportConfigPath) {

    logit.info('Creating new config file...');
    var exportConfig = {
        "roots": config.roots,
        "search": config.search,
        "folders": configLoader.getCustomFolders(config),
        "preLoad": true,
        "createAllFolders": true
    };

    var watchedFolders = Object.keys(config.roots);

    for (var i in watchedFolders) {
        // remove sensitive data that may exist
        delete exportConfig.roots[watchedFolders[i]].auth;
        // overwrite remaining sensitive data
        exportConfig.roots[watchedFolders[i]].user = '<your user name>';
        exportConfig.roots[watchedFolders[i]].pass = '<your password (which will be encrypted)>';

        exportConfig.roots[watchedFolders[i]].preLoadList = {};
    }

    var chokiWatcher = chokidar.watch(watchedFolders, {
            persistent: true,
            // ignores use anymatch (https://github.com/es128/anymatch)
            ignored: chokiWatcherIgnore
        })
        .on('add', function (file, stats) {
            // add all files that have content..
            //  files without content will confuse the person starting
            //  and could be considered irrelevant.
            if (stats.size > 0) {
                logit.info('File to export: %s', file);
                var f = new FileRecord(config, file),
                    folder = f.getFolderName(),
                    fileName = f.getFileName(),
                    rootDir = f.getRoot();

                // add to appropriate preLoadList folder array
                if (!exportConfig.roots[rootDir].preLoadList[folder]) {
                    exportConfig.roots[rootDir].preLoadList[folder] = [];
                }
                exportConfig.roots[rootDir].preLoadList[folder].push(fileName);
            }
        })
        .on('ready', function () {
            logit.debug('Exporting config: %j', exportConfig);

            fs.writeFile(exportConfigPath, JSON.stringify(exportConfig, null, 4), function (err) {
                if (err) {
                    logit.eror('Error updating/writing config file. path: %s', exportConfigPath);
                } else {
                    logit.info('Export complete'.green);
                    logit.info('Export location: %s'.green, exportConfigPath);
                }
                process.exit(1);
            });

        });
}

/* keep track of files waiting to be processed
 * and disable watching files to avoid double processing
 */
function queuedFile() {
    if (chokiWatcher) {
        //logit.info('*********** Killed watch *********** '.green);
        chokiWatcher.close();
        chokiWatcher = false;
    }
    filesInQueueToDownload++;
    logit.info(('Files left in queue: ' + filesInQueueToDownload).redBG);

    // more than 2 files in the queue? Lets disable notify to avoid the ulimit issue
    if (filesInQueueToDownload > 2 && notifyEnabled) {
        notifyEnabled = false;
        // reset multi file download status to OK.
        multiDownloadStatus = DOWNLOAD_OK;
    }
}

/*
 * When done processing a file consider if we can re-enable
 * notifications and watching for changed files.
 */
function decrementQueue() {
    filesInQueueToDownload--;
    logit.info(('Files left in queue: ' + filesInQueueToDownload).blueBG);
    if (filesInQueueToDownload === 0) {

        // re-enable notifications (notifications only disabled when multiple files in queue)
        if (!notifyEnabled) {
            notifyEnabled = true;
            // show one notification to represent if all files were downloaded or not
            if (multiDownloadStatus == DOWNLOAD_FAIL) {
                logit.error('Some or all files failed to download'.red);
                notifyUser(msgCodes.COMPLEX_ERROR);
            } else {
                notifyUser(msgCodes.ALL_DOWNLOADS_COMPLETE);
            }
        }
        // restart watch
        if (!chokiWatcher) {
            // do not start watching folders straight away as there may be IO streams
            // being closed which will cause a "change" event for chokidar on the file.
            setTimeout(function () {
                watchFolders();
            }, 200); // delay for 200 milliseconds to be sure that chokidar won't freak out!
        }
    }
}

function validResponse(err, obj, db, map, fileRecord) {
    if (err) {
        notifyUser(msgCodes.COMPLEX_ERROR, {
            open: fileRecord.getRecordUrl()
        });
        handleError(err, db);
        return false;
    }

    if (obj.records.length === 0) {
        logit.info('No records found:'.yellow, db);
        fileRecord.addError("No records found");

        notifyUser(msgCodes.RECORD_NOT_FOUND, {
            table: map.table,
            file: map.keyValue,
            field: map.field,
            open: fileRecord.getRecordUrl()
        });
        return false;
    }

    return true;
}

function receive(file, allDoneCallBack) {
    var map = fileRecords[file].getSyncMap(),
        fileMeta = fileRecords[file].getMeta();

    logit.debug('Adding:', {
        file: file,
        table: map.table,
        field: map.field
    });

    // we are about to download something!!
    queuedFile();

    var snc = getSncClient(map.root);

    // note: creating a new in scope var so cb gets correct map - map.name was different at cb exec time
    var db = {
        table: map.table,
        field: map.field,
        query: map.key + '=' + map.keyValue,
        sys_id: fileMeta.sys_id || false
    };

    snc.table(db.table).getRecords(db, function (err, obj) {
        var isValid = validResponse(err, obj, db, map, fileRecords[file]);
        if (!isValid) {
            decrementQueue();
            allDoneCallBack(false);
            return false;
        }

        var record = obj.records[0],
            objData = record[db.field],
            objName = record.name; // TODO : use objName instead of file var.


        // legacy concept (still needed??... TODO: don't allow creation of 0 byte files!)
        if (record[db.field].length < 1) {
            logit.warn('**WARNING : this record is 0 bytes'.red);
            fileRecords[file].addError('This file was downloaded as 0 bytes. Ignoring sync. Restart FileSync and then make changes to upload.');

            notifyUser(msgCodes.RECEIVED_FILE_0_BYTES, {
                table: map.table,
                file: map.keyValue,
                field: map.field,
                open: fileRecords[file].getRecordUrl()
            });
        }

        logit.info('Received:'.green, db);


        writeFile(file, objData, function (complete) {

            var wasNewlyDiscovered = fileRecords[file].isNewlyDiscoveredFile();

            // already written file or ignored file
            fileRecords[file].setNewlyDiscoveredFile(false);

            // we did not write out the file because this would result in overwriting needed data
            if (!complete && wasNewlyDiscovered) {
                // send the process down the correct path
                logit.info('Local has been modified (not added) and will now be sent.');
                decrementQueue();
                send(file, allDoneCallBack);
                return; // don't do any callback.. we came down the wrong path anyway!
            }

            if (!complete) {
                notifyUser(msgCodes.RECEIVED_FILE_ERROR, {
                    table: map.table,
                    file: map.keyValue,
                    field: map.field,
                    open: fileRecords[file].getRecordUrl()
                });

                decrementQueue();
                allDoneCallBack(complete);

            } else {

                updateFileMeta(file, record);

                // write out hash for collision detection
                fileRecords[file].saveHash(record[db.field], function (saved) {
                    if (saved) {
                        notifyUser(msgCodes.RECEIVED_FILE, {
                            table: map.table,
                            file: map.keyValue,
                            field: map.field,
                            open: fileRecords[file].getRecordUrl()
                        });

                        logit.info('Saved:'.green, file);
                    } else {
                        logit.error('SERIOUS ERROR: FAILED TO SAVE META FILE FOR SYNC RESOLUTION.'.red);
                        notifyUser(msgCodes.COMPLEX_ERROR);
                    }

                    decrementQueue();
                    allDoneCallBack(saved);
                });
            }

        });
    });
}

/**
 * Writes out a file so long as it is empty
 */
function writeFile(file, data, callback) {
    // file was discovered as "new" by watcher (chokidar)
    var mustBeEmpty = fileRecords[file].isNewlyDiscoveredFile();

    // are we expecting that the file is empty?
    if (mustBeEmpty) {
        /*
         * File overwrite check here.
         * The file must either not exist or be empty before we attempt
         * to overwrite it. Fixes an edge case race condition where the chokidar watcher
         * thought that our file was empty (due to atomic saves?) but it really wasn't
         * this caused an "addFile" call instead of an "updateRecord" process :-(
         *
         */

        readFile();
    } else {
        outputFile();
    }


    function readFile() {
        fs.readFile(file, 'utf8', function (err, data) {
            if (err || data.length > 0) {
                callback(false);
            } else {
                outputFile();
            }
        });
    }

    function outputFile() {
        fs.outputFile(file, data, function (err) {
            if (err) {
                handleError(err, file);
                callback(false);
                return;
            }
            callback(true);
        });
    }
}

// it is expected that the file always exists (otherwise die hard)
function readFile(file, callback) {
    fs.readFile(file, 'utf8', function (err, data) {
        if (err) {
            notifyUser(msgCodes.COMPLEX_ERROR);
            logit.info(('Error trying to read file: '.red) + file);
            handleError(err, {
                file: file
            });
        } else {
            callback(data);
        }
    });
}

/**
 * push some data to overwrite an instance record
 * @param snc {snc-client}
 * @param db {object} - the data to use in the post...
 * var db = {
            table: map.table,
            field: map.field,
            query: map.key + '=' + map.keyValue,
            sys_id: fileMeta.sys_id || false,
            payload: {},
        };
        // payload for a record update (many fields and values can be set)
        db.payload[db.field] = data;

 * @param callback {function}
 */
function push(snc, db, callback) {
    snc.table(db.table).update(db, function (err, obj) {
        if (err) {
            handleError(err, db);
            callback(false);
            return;
        }

        callback(true);
    });
}

function send(file, callback) {

    // default callback
    callback = callback || function (complete) {
        if (!complete) {
            logit.error(('Could not send file:  ' + file).red);
        }
    };
    readFile(file, function (data) {

        var map = fileRecords[file].getSyncMap(),
            fileMeta = fileRecords[file].getMeta();

        var snc = getSncClient(map.root);
        var db = {
            table: map.table,
            field: map.field,
            query: map.key + '=' + map.keyValue,
            sys_id: fileMeta.sys_id || false,
            payload: {},
        };
        // payload for a record update (many fields and values can be set)
        db.payload[db.field] = data;


        // only allow an update if the instance is still in sync with the local env.
        instanceInSync(snc, db, map, file, data, function (err, obj) {

            if (!obj.inSync) {
                notifyUser(msgCodes.NOT_IN_SYNC, {
                    table: map.table,
                    file: map.keyValue,
                    field: map.field,
                    open: fileRecords[file].getRecordUrl()
                });
                logit.warn('Instance record is not in sync with local env ("%s").', map.keyValue);
                callback(false);
                return;
            }
            if (obj.noPushNeeded) {
                logit.info('Local has no changes or remote in sync; no need for push/send.');
                callback(true);
                return;
            }


            logit.info('Updating instance version ("%s").', map.keyValue);
            push(snc, db, function (complete) {
                if (complete) {
                    // update hash for collision detection
                    fileRecords[file].saveHash(data, function (saved) {
                        if (saved) {
                            notifyUser(msgCodes.UPLOAD_COMPLETE, {
                                file: map.keyValue,
                                open: fileRecords[file].getRecordUrl()
                            });
                            logit.info('Updated instance version: %s.%s : query: %s', db.table, db.field, db.query);
                            logit.debug('Updated instance version:', db);

                        } else {
                            notifyUser(msgCodes.COMPLEX_ERROR);
                        }
                        callback(saved);
                    });
                } else {
                    notifyUser(msgCodes.UPLOAD_ERROR, {
                        file: map.keyValue,
                        open: fileRecords[file].getRecordUrl()
                    });
                    callback(complete);
                }

            });
        });
    });
}

function addFile(file, callback) {

    if (!trackFile(file)) return;

    // default callback
    callback = callback || function (complete) {
        if (!complete) {
            logit.info(('Could not add file:  ' + file).red);
            multiDownloadStatus = DOWNLOAD_FAIL;
        }
    };

    logit.info('Syncing record from instance to file', file);
    receive(file, callback);
}

function onChange(file, stats) {
    if (fileHasErrors(file)) {
        return false;
    }
    if (stats.size > 0) {
        logit.info('Potentially syncing changed file to instance', file);
        send(file);
    } else {
        logit.info('Syncing empty file from instance', file);
        receive(file, function (complete) {});
    }
}

function fileHasErrors(file) {
    var f = fileRecords[file] ? fileRecords[file] : false;
    if (!f) {
        trackFile(file);
        return true;
    }
    var errors = f.errors();
    if (errors) {
        logit.info('This file (' + file + ') failed to work for us previously. Skipping it. Previous errors on file/record: ', errors);
        return true;
    }
    return false;
}

/*
 * Track this file in our fileRecords list.
 * Return the file or false if not valid
 */
function trackFile(file) {

    var f = fileRecords[file] ? fileRecords[file] : false;
    // existing, check for errors
    if (f) {
        if (fileHasErrors(file)) {
            return false; // can't process
        }
        return f;
    } else {
        // new, check if valid
        f = new FileRecord(config, file);
        if (f.validFile()) {
            fileRecords[file] = f;
        } else {
            return false; // not valid in terms of mapped files in config
        }
    }
    return f;
}

/*
 * Check if the server record has changed AND is different than our local version.
 *
 * Cases:
 *  1. computed hash of the file before and after is the same                  = PASS
 *  2. hash of the remote record and local file are the same                   = PASS
 *  3. hash of the previous downloaded file and the remote record are the same = PASS
 *     (nobody has worked on the server record)
 *
 *  All other scenarios are considered a FAIL meaning that the instance version is
 *  not in sync with the local version.
 *
 * If file and record are in sync then inSync is true.
 * If case 3 then noPushNeeded is false to signify that the remote version can
 * be updated.
 */
function instanceInSync(snc, db, map, file, newData, callback) {

    // first lets really check if we have a change
    var previousLocalVersionHash = fileRecords[file].getLocalHash();
    var newDataHash = makeHash(newData);
    if (previousLocalVersionHash == newDataHash) {
        callback(false, {
            inSync: true,
            noPushNeeded: true
        });
        return; // no changes
    }

    logit.info('Comparing remote version with previous local version...');

    snc.table(db.table).getRecords(db, function (err, obj) {
        obj.inSync = false; // default to false to assume not in sync (safety first!)
        obj.noPushNeeded = false; // default to false to assume we must upload

        var isValid = validResponse(err, obj, db, map, fileRecords[file]);
        if (!isValid) {
            callback(err, obj);
            return false;
        }

        logit.info('Received: %s.%s query: %s sys_id ? %s'.green, db.table, db.field, db.query, db.sys_id);
        logit.debug('Received:'.green, db);

        var remoteVersion = obj.records[0][db.field],
            remoteHash = makeHash(remoteVersion);

        // CASE 1. Records local and remote are the same
        if (newDataHash == remoteHash) {
            // handle the scenario where the remote version was changed to match the local version.
            // when this happens update the local hash as there would be no collision here (and nothing to push!)
            obj.inSync = true;
            obj.noPushNeeded = true;
            // update local hash.
            fileRecords[file].saveHash(newData, function (saved) {
                if (!saved) {
                    logit.error('Failed to update hash file for %s', file);
                }
            });

            // CASE 2. the last local downloaded version matches the server version (stanard collision test scenario)
        } else if (remoteHash == previousLocalVersionHash) {
            obj.inSync = true;
        }
        // CASE 3, the remote version changed since we last downloaded it = not in sync
        callback(err, obj);
    });
}


function watchFolders() {

    // Watching folders will currently screw up our testing so don't do it when running tests.
    if (testsRunning) return;

    logit.info('*********** Watching for changes ***********'.green);
    var watchedFolders = Object.keys(config.roots);
    chokiWatcher = chokidar.watch(watchedFolders, {
            persistent: true,
            // ignores use anymatch (https://github.com/es128/anymatch)
            ignored: chokiWatcherIgnore
        })
        .on('add', function (file, stats) {

            if (chokiWatcherReady) {

                // ensure a file object exists
                if (trackFile(file)) {
                    // ensure file is really empty
                    if (stats && stats.size > 0) {
                        // these files can be ignored (we only process empty files)
                        return;
                    } else {

                        // track file as a newly discovered file
                        fileRecords[file].setNewlyDiscoveredFile(true);

                        addFile(file);
                    }
                }

            } else {
                trackFile(file);
            }
        })
        .on('change', onChange)
        .on('ready', function () {
            chokiWatcherReady = true;
        })
        .on('error', function (error) {
            logit.error('Error watching files:'.red, error);
        });
    // TODO : clear up old hash files when files removed..
    // .on('unlink', function(path) {logit.info('File', path, 'has been removed');})
}

// for each root create the folders because we are lazy ppl
function setupFolders(config, callback) {
    var dirsExpected = 0,
        dirsCreated = 0;

    dirsExpected = Object.keys(config.roots).length * Object.keys(config.folders).length;

    function dirError(err) {
        if (err) logit.info(err);
        dirsCreated++;
        if (dirsCreated >= dirsExpected) {
            // we are done creating all the folders
            callback();
        }
    }

    // for each root create our dirs
    for (var r in config.roots) {
        //logit.info('found r: '+r);
        for (var f in config.folders) {
            var newDir = path.join(r, f);
            fs.ensureDir(newDir, dirError);
        }
    }
}

/*
 * @debug Bool : true to set log level to (include) debug
 */
function setupLogging() {
    var logger = new(winston.Logger)({
        transports: [
        new(winston.transports.Console)({
                timestamp: function () {
                    return moment().format("HH:mm:ss");
                    //return moment().format("YY-MM-DD HH:mm:ss");
                    //return Date.now();
                },
                colorize: true,
                prettyPrint: true
            })
    ]
    });

    // support easier debugging of tests
    logit.test = function () {
        console.log('...............');
        if (typeof arguments[0] == 'string') {
            this.info(arguments[0].underline);
        } else {
            this.info(arguments[0]);
        }
        for (var i = 1; i < arguments.length; i++) {
            this.info(' - ', arguments[i]);
        }
        //console.log('...............');
    };

    logger.extend(logit);

    if (config.debug) {
        logger.level = 'debug';
    }

    // support for 3rd party logging (eg, FileRecord, notify and Search)
    config._logger = logit;
}



init();
