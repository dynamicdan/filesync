var netrc = require('netrc');
var netrcConfig = netrc();

function getCredentials(hostname) {
    var settings = netrcConfig[hostname] || {};

    return {
        user: settings['login'],
        pass: settings['password']
    };
}

function hasCredentials(hostname) {
    var credentials = getCredentials(hostname);
    return credentials.user != null && credentials.pass != null;
}

module.exports = {
    getCredentials: getCredentials,
    hasCredentials: hasCredentials
};