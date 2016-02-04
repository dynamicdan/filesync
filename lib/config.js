/*
 * Load settings and config used to identify project, connection and folder syncing information.
 */

var assert = require('assert-plus');
require('colors');
var fs = require('fs');
var path = require('path');
var restify = require('restify');
var util = require('util');

// non documented function. Worry about that some other day. It won't go away soon because nodejs relies on it!
var extend = require('util')._extend;

// the location of the config file (populated dynamically)
var config_file = '';

// initial config for folders and record matchup (can be overridden in app.config.json)
var CONFIG_RECORDS = path.join('..', 'lib', 'records.config.json');

function saveConfig(config) {
    fs.writeFile(config_file, JSON.stringify(config, null, 4), function (err) {
        if (err) console.log('Error updating/writing config file. path: ' + config_file);
        assert.ifError(err);
    });
}

function encodeCredentials(host) {
    assert.ok(host.user && host.pass, 'Invalid root config. user, pass or auth missing.');
    host.auth = new Buffer(host.user + ':' + host.pass).toString('base64');
    delete host.user;
    delete host.pass;
    return host;
}

function validateRootFolder(folder) {
    assert.ok(fs.existsSync(folder), util.format('root folder: "%s" was not found.', folder));
    assert.ok(fs.statSync(folder).isDirectory(), util.format('root folder: "%s" is not a directory.', folder));
}

function configValid(config) {
    if (!config) {
        console.error('Invalid configuration. Application exiting.'.red);
        process.exit(1);
        return false;
    }
    logConfig(config);
    return true;
}

function _getHomeDir() {
    // should also be windows friendly but not tested
    var ans = process.env[(process.platform.indexOf('win') >= 0) ? 'USERPROFILE' : 'HOME'];
    return ans;
}

function loadFolders(config) {
    var confRecords = require(CONFIG_RECORDS);
    // if true in the app.config.json file then we won't load our default folders
    if (!config.ignoreDefaultFolders) {

        // config.folders can extend/overwrite confRecords.folders if provided
        if (config.folders) {
            // keep track of any custom definitions to include in exports
            var keys = Object.keys(config.folders);
            for (var i in keys) {
                config.folders[keys[i]]._custom = true;
            }
            config.folders = extend(confRecords.folders, config.folders);
        } else {
            config.folders = confRecords.folders;
        }
    }
}

function getConfig() {
    var config = require(config_file);
    config.debug = config.debug || false;

    assert.object(config.roots, 'roots');

    var roots = Object.keys(config.roots);
    assert.ok(roots.length > 0, 'At least one root folder must be configured.');

    loadFolders(config);
    assert.object(config.folders, 'folders');

    var save = false;
    roots.forEach(function (root) {
        validateRootFolder(root);
        var host = config.roots[root];
        assert.ok(host.host, 'Invalid root config. host missing.');
        if (!host.auth) {
            config.roots[root] = encodeCredentials(host);
            save = true;
        }
    });

    if (save) {
        saveConfig(config);
        console.log('Configuration: credentials encoded.'.green);
    }

    configValid(config);

    // make it easier to find the root property
    roots.forEach(function (root) {
        config.roots[root].root = root;
    });

    return config;
}

/*
 * Utility function for getting ONLY the folders that the user
 * provided in their original JSON config file.
 */
function getCustomFolders(config) {
    var folders = {},
        keys = Object.keys(config.folders);

    for (var i in keys) {
        var k = keys[i];
        var obj = config.folders[k];
        if (obj._custom) {
            folders[k] = config.folders[k];
            delete folders[k]._custom;
        }
    }
    return folders;
}

// pathToConfig must exist or the (advanced) user has made a mistake that they can fix
function setConfigLocation(pathToConfig) {
    // resolve ~/ or ../ style paths
    config_file = path.resolve(pathToConfig);

    console.log('Using config file: ' + config_file.green);
    return config_file;
}


// debug
function logConfig(config) {
    console.log('');
    console.log('Root folder sync to instance mapping:');
    Object.keys(config.roots).forEach(function (root) {
        console.log('-', root, '|', config.roots[root].host);
    });
    console.log('');
    console.log('Root subfolder to table mapping:');
    Object.keys(config.folders).forEach(function (folder) {
        console.log('-', folder, '|', config.folders[folder].table);
    });
    console.log('');

    if (config.debug) {
        console.log(JSON.stringify(config));
    }
}


module.exports = {
    "getConfig": getConfig,
    "setConfigLocation": setConfigLocation,
    "getCustomFolders": getCustomFolders
};
