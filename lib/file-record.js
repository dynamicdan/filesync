/*
 * Everything to do with managing a record object and corresponding file
 */

require('colors');
var fs = require('fs-extra'),
    path = require('path'),
    crypto = require('crypto');

var method = FileRecord.prototype,
    syncDir = '.sync_data',
    SLASH = '/'; // cross platform path separator. (path.sep is not always good!!!)

function FileRecord(config, file) {
    this.filePath = normalisePath(file);
    this.config = config;
    this.rootDir = this.getRoot();
    this.errorList = [];
    this.logger = config._logger;
    this.meta = {};

    // assume all files already exist (toggled by watcher)
    this.setNewlyDiscoveredFile(false);
}

function makeHash(data) {
    var hash1 = crypto.createHash('md5').update(data).digest('hex');
    return hash1;
}

method.getFieldMap = function(filename, map) {

    if(typeof map.fields == 'undefined') {
        // if this is the case then the config doesn't specify which fields should be downloaded for the record.
        // this means that we are only interested in the full record
        // todo: support resyncing the full record
        this.logger.debug("No fields defined for this file type");
        this.logger.debug('map...');
        this.logger.debug(map);
        return null;
    }

    var suffixes = Object.keys(map.fields);

    // sort suffixes so most specific suffixes are looped through first...
    // ... otherwise similar suffixes (like ".js" vs ".condition.js") would be confused.
    suffixes.sort(function(a, b) {
        if(a.length > b.length) {
            return -1;
        }
        return 1;
    });
    for (var i = 0; i < suffixes.length; i++) {
        var suffix = suffixes[i];
        var match = filename.match(new RegExp(suffix + '$'));
        if (match) {
            var keyValue = filename.slice(0, match.index - 1);
            return {
                keyValue: keyValue,
                field: map.fields[suffix]
            };
        }
    }
    return null;
};

// fix windows path issues (windows can handle both '\' and '/' so be *nix friendly)
function normalisePath(p) {
    return p.replace(/\\/g, SLASH);
}


// ------------------------------------------------
// methods
// ------------------------------------------------


method.getRecordUrl = function () {
    var syncMap = this.getSyncMap(),
        root = syncMap.root,
        rootConfig = this.config.roots[root],
        host = rootConfig.host,
        protocol = rootConfig.protocol ? rootConfig.protocol : 'https',
        meta = this.getMeta(),
        url = protocol + '://' + host + '/' + syncMap.table + '.do?sys_id=' + meta.sys_id;

    // in order to work with notify we must have a strictly valid URL (no spaces)
    url = url.replace(/\s/g, "%20");

    return url;

};

/*
 * Returns path to the sync data file used to store meta data.
 * This function can get away with path.sep to work on all systems.
 * ('/' would also probably work.)
 */
method.getMetaFilePath = function () {
    var syncFileRelative = path.sep + syncDir + path.sep + this.getFolderName() + path.sep + this.getFileName();
    var hashFile = this.rootDir + syncFileRelative;
    return hashFile;
};

/**
 * Removes the hash/meta file
 */
method.clearMetaFile = function (callback) {
    var path = this.getMetaFilePath();
    var logger = this.logger;
    fs.remove(path, function (err) {
        if (err) {
            logger.warn('Error clearing cache file...', err);
            callback(false);
        } else {
            callback(true);
        }
    });
};
// track if a file has been discovered by the watcher or not as a "new" record field to download
method.setNewlyDiscoveredFile = function (isNew) {
    this._isNewFile = isNew;
};
method.isNewlyDiscoveredFile = function () {
    return this._isNewFile;
};

/**
 * Returns the full path to the file minus the path to the root dir
 */
method.getFilePathRelativeToRoot = function () {
    return this.filePath.replace(this.rootDir + SLASH, '');
};

method.getFileSubDirPath = function () {
    var p = this.getFilePathRelativeToRoot();
    return p.replace(this.getFolderName() + SLASH, '');
};

method.getFileName = function () {
    return path.basename(this.filePath);
};

method.getFolderName = function () {
    // remove file name from path
    var dir = path.dirname(this.filePath),
        // remove root from path
        relativePath = dir.replace(this.rootDir + SLASH, ''),
        // get array of sub directories
        dirs = relativePath.split(SLASH),
        // first sub dir is the "key" folder name used in mapping to a table
        baseDir = dirs[0];

    return baseDir;
};

method.debug = function () {
    this.logger.info(('filePath: ' + this.filePath).green);

};

method.getLocalHash = function () {
    var metaData = this.getMeta();
    if (metaData) {
        return metaData.syncHash;
    }
    this.logger.warn('--------- sync data not yet existing ---------------'.red);
    return '';
};

method.updateMeta = function (obj) {
    var keys = Object.keys(obj);
    for (var k in keys) {
        var key = keys[k];
        this.meta[key] = obj[key];
    }
    this.logger.debug('updated meta : ', this.meta);
};

method.saveHash = function (data, callback) {
    this.logger.debug('Saving meta/hash data for file: ' + this.filePath);
    this.updateMeta({
        syncHash: makeHash(data)
    });

    this._saveMeta(callback);
};

method._saveMeta = function (callback) {
    var dataFile = this.getMetaFilePath();
    var outputString = JSON.stringify(this.meta);
    var _this = this;

    fs.outputFile(dataFile, outputString, function (err) {
        if (err) {
            _this.logger.error('Could not write out meta file'.red, dataFile);
            callback(false);
        } else {
            callback(true);
        }
    });
};

method.getMeta = function () {
    // have we already got the meta object cached?
    if (this.meta.syncHash) {
        return this.meta;
    }

    var metaFilePath = this.getMetaFilePath(),
        fContents = '',
        metaObj;

    try {
        fContents = fs.readFileSync(metaFilePath, 'utf8');
        metaObj = JSON.parse(fContents);
        this.meta = metaObj;
        return metaObj;
    } catch (err) {
        // don't care. (the calling function will then fail the sync check as desired)
        this.logger.warn('--------- meta data file not yet existing ---------------'.red);
        this.logger.warn('File in question: ' + metaFilePath);
    }
    return false;
};


method.getRoot = function () {
    // cache
    if (this.rootDir) return this.rootDir;

    var root = path.dirname(this.filePath);

    // help find the root path on windows
    // (config json file cannot use '\\' or '\' paths; even if on windows)
    root = normalisePath(root);

    while (!this.config.roots[root]) {
        var up = path.dirname(root);
        if (root === up) throw new Error('Failed to find root folder.');
        root = up;
    }
    return root;
};


method.getSyncMap = function () {
    var folder = this.getFolderName();
    var fileName = this.getFileName();

    // validate parent folder is mapped
    var map = this.config.folders[folder];
    if (!map) {
        this.logger.warn('No mapping for this folder: %s', folder);
        return null;
    }

    // validate file suffix is mapped
    var fieldMap = this.getFieldMap(fileName, map);
    if (!fieldMap) {
        // note that full_record download will not have a mapped suffix
        this.logger.warn('No field map fileName: %s',fileName);
        return null;
    }

    map.keyValue = fieldMap.keyValue;
    map.fileName = fieldMap.keyValue;
    // special sass case
    if (isSCSS(this.filePath)) {
        map.keyValue += '_scss';
    }
    map.field = fieldMap.field;
    map.root = this.rootDir;
    this.syncMap = map;
    return map;
};

function isSCSS(filePath) {
    // can check both filePath and record name
    if (filePath.indexOf('.scss') > 0 || filePath.indexOf('_scss') >= 0) {
        return true;
    }
    return false;
}

method.validFile = function () {
    // path cannot start with a dot or it will be invisible!
    if(this.getFileName().indexOf('.') === 0) {
        return false;
    }

    return this.getSyncMap();
};
method.errors = function () {
    if (this.errorList.length > 0) {
        return this.errorList;
    }
    return false;
};
method.addError = function (str) {
    this.errorList.push(str);
};

module.exports = {
    FileRecord: FileRecord,
    makeHash: makeHash,
    isSCSS: isSCSS,
    normalisePath: normalisePath
};
