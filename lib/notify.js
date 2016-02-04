/*
 * Add-on to display friendly system style notifications to the user
 * (no more console searching!)
 *
 */

var isMac = /^darwin/.test(process.platform);
var isWin = /^win/.test(process.platform);

if (isMac) {
    var notify = require('osx-notifier');
} else if (isWin) {
    var notifier = require('node-notifier');
}

var debug = false;

function notifyUser() {

    // a bunch of notification codes to be re-used
    var codes = {
        UPLOAD_COMPLETE: 1,
        UPLOAD_ERROR: -1,
        ALL_DOWNLOADS_COMPLETE: 200,
        RECEIVED_FILE: 2,
        RECEIVED_FILE_ERROR: -2,
        RECEIVED_FILE_0_BYTES: -20,
        RECORD_NOT_FOUND: -2.1,
        NOT_IN_SYNC: -3,
        COMPLEX_ERROR: -500
    };

    // notifies the user in a non-command line kind of way
    // currently supports OSX notifactions only...
    // (consider using https://github.com/mikaelbr/node-notifier or https://github.com/dylang/grunt-notify)
    // TODO : notifications sent at the same time may not be displayed to the user in the normal fashion (os X)
    //        but are being received and exist in the notification center. Consider adding delay or merging notifications.
    function msg(code, args) {

        args = args || {};

        if (debug) {
            console.log('notifying with code: ' + code);
        }


        // default response
        var notifyArgs = {
            type: 'info',
            title: 'Unknown Notification',
            subtitle: 'WTF?',
            message: 'Please look into notifyUser() for code: ' + code
        };

        if (code == codes.UPLOAD_COMPLETE) {
            notifyArgs = {
                type: 'pass',
                title: 'Upload Complete',
                subtitle: args.file,
                message: 'Took no time at all!'
            };
        } else if (code == codes.UPLOAD_ERROR) {
            notifyArgs = {
                type: 'fail',
                title: 'Failed to Upload file',
                subtitle: '',
                message: args.file
            };

        } else if (code == codes.RECEIVED_FILE) {
            notifyArgs = {
                type: 'pass',
                title: 'Download Complete',
                subtitle: '',
                message: args.file + ' (' + args.table + ':' + args.field + ')'
            };
        } else if (code == codes.RECEIVED_FILE_ERROR) {
            notifyArgs = {
                type: 'fail',
                title: 'Failed to Download file',
                subtitle: '',
                message: args.file + ' (' + args.table + ':' + args.field + ')'
            };
        } else if (code == codes.RECORD_NOT_FOUND) {
            notifyArgs = {
                type: 'fail',
                title: 'Could not find record',
                subtitle: '',
                message: args.file + ' (' + args.table + ':' + args.field + ')'
            };
        } else if (code == codes.NOT_IN_SYNC) {
            notifyArgs = {
                type: 'fail',
                title: 'File not in sync!',
                subtitle: 'Please update your local version first!',
                message: args.file + ' (' + args.table + ':' + args.field + ')'
            };
        } else if (code == codes.RECEIVED_FILE_0_BYTES) {
            notifyArgs = {
                type: 'info',
                title: 'Record field has no data!',
                subtitle: 'Please add some content to your new file.',
                message: args.file + ' (' + args.table + ':' + args.field + ')'
            };
        } else if (code == codes.COMPLEX_ERROR) {
            notifyArgs = {
                type: 'fail',
                title: 'Connection Error',
                subtitle: '',
                message: 'Please see command line output for details.'
            };
        } else if (code == codes.ALL_DOWNLOADS_COMPLETE) {
            notifyArgs = {
                type: 'pass',
                title: 'All Downloads Complete',
                subtitle: '',
                message: 'Multiple files downloaded.'
            };
        }

        // open a URL when clicked if provided
        if (args.open) {
            notifyArgs.open = args.open;
        }

        if (isMac) {
            // osx-notify can't handle messages that start with a symbol. Fix that here.
            // test case: "(KeyFile)" should then be "_(KeyFile)". "KeyFile" should be ignored.
            var firstChar = notifyArgs.message.charAt(0),
                workaround = firstChar.replace(/^[^a-z]{0,1}/i, "_");
            if (workaround.length == 2) {
                // no issue (node js decided to prefix the '_' causing '_K' instead of '_')
            } else {
                // accepted first symbol by osx-notify is '_'
                notifyArgs.message = '_' + notifyArgs.message;
            }

            notify(notifyArgs);

        } else if (isWin) {
            // windows support?
            // linux support?

            var type = notifyArgs.type == 'fail' ? 'error' : 'info';
            notifier.notify({
                'title': notifyArgs.title,
                'message': notifyArgs.message,
                'sound': true,
                't': type
            });

        }
    }

    function setDebug() {
        debug = true;
    }
    return {
        msg: msg,
        codes: codes,
        setDebug: setDebug
    };
}

module.exports = notifyUser;
