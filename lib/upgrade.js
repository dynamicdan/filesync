var path = require('path');
var fs = require('fs-extra');


function upgradeNeeded(config, callback) {
    var oldSyncDir = syncDirWrong(config);
    var winConfigUpgrade = oldWindowsPath(config);
    var needsUpgrade = oldSyncDir || winConfigUpgrade;

    callback(needsUpgrade);
}

function oldWindowsPath(config) {
    for (var r in config.roots) {
        if(r.indexOf("\\") >= 0) {
            console.log('Please change your config file to use unix/mac/web style paths instead of old school windows paths');
            return true;
        }
    }
    return false;
}

function syncDirWrong(config) {
    for (var r in config.roots) {

        var oldDir = path.join(r, '.sync');
        //console.log('Checking for old dir: ' + oldDir);
        if (fs.existsSync(oldDir)) {
            console.log('Please remove ' + oldDir + ' and re-run with "--resync"');
            return true;
        }
    }
    return false;
}


module.exports = upgradeNeeded;
