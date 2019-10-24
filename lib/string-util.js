
var method = StringUtil.prototype;


function StringUtil() {

}

/**
 * Returns the last part of the string counting backwards from
 * end to (end - num)
 */
method.lastChars = function(s, num) {
    var rev = this.reverse(s);
    return this.reverse(rev.substring(0, num));
};

method.reverse = function(s) {
    return s.split('').reverse().join('');
};

method.extractSysIdFromName = function(str) {
    var regEx = new RegExp("[a-z0-9]{32,}", "gi"),
        matches;
    if (typeof str != 'string') {
        return false;
    }

    matches = str.match(regEx);

    if (matches && matches.length > 0) {
        // assumes only one sys_id str
        var match = matches[0];
        // let's make sure we didn't match to much crud at the start.
        match = this.lastChars(match, 32);

        return match;
    }

    return false;
};

method.extractTableFromName = function(str) {
    var table = '';
    var start, end;

    // this is the most complex case so handle it first
    if (str.indexOf('uri=') >= 0) {
        /*
         * Example
         * http://localhost:16008/nav_to.do?uri=%2Fsp_widget.do%3Fsys_id%3Df37aa302cb70020000f8d856634c9cfc%26sysparm_record_target%3Dsp_widget
         *
         * OR
         *
         * http://localhost:16008/nav_to.do?uri=sp_angular_provider.do?sys_id=06e836f0d722120023c84f80de6103a1"
         *
         */
        // normalise the string
        str = str.replace(/\%2F/g, '').replace(/\%3F/g, '');
        start = str.replace('_list', '').split('.do');
        end = start[1].split('uri=');
        table = end.pop();

    } else if (str.indexOf('.do') >= 0) {
        /*
         * Example
         * http://localhost:16008/sp_widget.do?sys_id=c6545050ff223100ba13ffffffffffe8&sysparm_record_target=sp_widget
         *
         */
        start = str.split('.do');
        end = start[0].split('/');
        table = end.pop();

    } else {
        /*
         * Example
         * sp_widget_c6545050ff223100ba13ffffffffffe8
         */
        var sys_id = method.extractSysIdFromName(str);
        table = str.replace('_' + sys_id, '');
    }

    return table;
};

/**
 * Remove problematic characters for saving to a file
 * @param pathPart {string} - a folder or file name (not full path) to normalise
 * @return {string} - updated path
 */
method.normaliseRecordName = function(pathPart) {
    var newName = pathPart;
    newName = newName.replace(/\//g, '_');
    newName = newName.replace(/\*/g, '_');
    newName = newName.replace(/\\/g, '_');

    return newName;
};


module.exports = {
    StringUtil: StringUtil
};
