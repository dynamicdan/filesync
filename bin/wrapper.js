var fs = require("fs"); //require filesystem module
var mkdirp = require('mkdirp'); // for creating directories easy

switch (process.platform) {
    case "darwin":
        renameP("mac");
        break;
    case "win32":
        renameP("win");
        break;
    case "linux":
        renameP("linux");
        break;
}

function renameP(name) {
    fs.rename('package.' + name + '.json', 'package.json', function (ex) {
        if (ex)
            console.log("something went wrong: " + ex);
        else
            console.log('package.json renamed for your platform');
    });
}