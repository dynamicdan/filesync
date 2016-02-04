var path = require('path'),
    moment = require('moment');

var api,
    config,
    logger;

var testFile = {
    name: 'JSUtil',
    field: 'script',
    suffix: 'js',
    folder: 'script_includes',
    table: 'sys_script_include'
};

function runTests(apiObj, configObj) {
    api = apiObj;
    config = configObj;
    logger = configObj._logger;

    var testQueue = [],
        nextTest,
        testsPassed = 0;


    // *******************************
    // Queue all tests here

    testQueue.push(clearTestFileHistory);
    testQueue.push(testDownload);
    testQueue.push(testUpdateRecord);
    testQueue.push(testSyncConflict);

    testQueue.push(testForLocalDataLoss);

    // missing tests
    //testQueue.push(testFolderSetup);
    //testQueue.push(testExportConfig);
    //testQueue.push(testUpgradeNeeded);
    //testQueue.push(testSearch);

    // *******************************


    var totalTests = testQueue.length;

    function testDone(passed) {
        if (passed) {
            testsPassed++;
            nextTest = testQueue.shift();
            if (nextTest) {
                nextTest(testDone);
            } else {
                logger.test("Tests passed: " + testsPassed);
                logger.test("Tests failed: 0");
                logger.test("Testing Complete.".green);

                process.exit(1);
            }
        } else {
            logger.test("Tests passed: " + testsPassed);
            logger.test("Tests failed: " + (totalTests - testsPassed));
            logger.test("TESTS FAILED. Stopping tests.".red);

            process.exit(1);
        }
    }

    logger.test(('Running ' + testQueue.length + ' test(s).').bold);
    logger.test('Test file in use:', testFile);

    // start tests
    nextTest = testQueue.shift();
    nextTest(testDone);
}

function getTestFilePath() {
    // this should be an out of the box file available on Dublin, Eureka, Fuji...
    var testFilePath = path.join(getRoot(), testFile.folder, testFile.name + '.' + testFile.suffix);
    return testFilePath;
}

function clearTestFileHistory(callback) {
    logger.test('TEST RUNNING: clearTestFileHistory()'.yellow);
    var testFilePath = getTestFilePath();
    var fileObj = api.trackFile(testFilePath);
    fileObj.clearMetaFile(callback);
}

function getTestFile(callback) {
    var testFilePath = getTestFilePath();

    logger.test('Creating test file: ' + testFilePath);
    api.addFile(testFilePath, callback);
}

function getRoot() {
    var roots = Object.keys(config.roots);
    return roots[0];
}

/*
 * Calls addFile to download a record
 */
function testDownload(callback) {
    logger.test('TEST RUNNING: testDownload()'.yellow);
    getTestFile(fileAdded);

    function fileAdded(complete) {
        if (complete) {
            logger.test('[PASS]:'.green + ' testDownload()');
        } else {
            logger.test('[FAIL]:'.red + ' testDownload()');
        }
        callback(complete);
    }
}

/**
 * Wrapper for api.push (nothing more)
 */
function updateRecord(snc, db, callback) {
    logger.test('Attempting record update:', db.table, db.query, db.field);

    api.push(snc, db, function (complete) {
        if (!complete) {
            logger.test('Could not save record'.red);
            callback(false);
            return;
        }
        callback(complete);
    });
}

/*
 * Test trying to update an existing record
 *
 * 1. get file
 * 2. modify local file
 * 3. trigger send of file
 */
function testUpdateRecord(callback) {

    logger.test('TEST RUNNING: testUpdateRecord()'.yellow);

    var snc = api.getSncClient(getRoot());
    var file = getTestFilePath();

    var uniqueString = 'FileSync testUpdateRecord (' + moment().format('x') + ')';

    getTestFile(fileAdded);

    function fileAdded(complete) {
        if (complete) {
            updateLocalFile(file, uniqueString);
        } else {
            logger.test('[FAIL]:'.red + ' testUpdateRecord()');
            callback(complete);
        }

    }

    function updateLocalFile(file, additionalContent) {
        api.readFile(file, function (data) {
            var body = {
                'script': data + "\n// " + additionalContent
            };

            api.writeFile(file, body.script, function (fileWritten) {
                if (fileWritten) {
                    api.send(file, sendResult);
                } else {
                    logger.test('[FAIL]:'.red + ' testSyncConflict() - could not update local file contents');
                    callback(false);
                }
            });
        });
    }

    function sendResult(complete) {
        if (complete) {
            logger.test('testUpdateRecord() - we were able to update the remote instance version');
            confirmFile(file, uniqueString);
        } else {
            logger.test('[FAIL]:'.red + ' testUpdateRecord() - we could not update the remote instance');
            callback(false);
        }
    }

    function confirmFile(file, subString) {
        getTestFile(function (resp) {
            api.readFile(file, function (data) {
                // check if file contains unique content
                if (data.indexOf(subString) >= 0) {
                    logger.test('[PASS]:'.green + ' testUpdateRecord() - we can confirm the content on the server is correct');
                    callback(true);
                } else {
                    logger.test('[FAIL]:'.red + ' testUpdateRecord() - file downloaded is not what was pushed');
                    callback(false);
                }
            });
        });
    }
}

/*
 * Tests trying to upload a record that has already been changed on the server
 *
 * 1. update server side record
 * 2. update local file
 * 3. TRY to use local file to update server record (should be rejected)
 */
function testSyncConflict(callback) {
    logger.test('TEST RUNNING: testSyncConflict()'.yellow);

    var snc = api.getSncClient(getRoot());
    var file = getTestFilePath();
    var uniqueString = 'FileSync testSyncConflict (' + moment().format('x') + ')';

    api.readFile(file, function (data) {
        var body = {
            'script': data + "\n// " + uniqueString
        };

        var db = {
            table: testFile.table,
            query: 'name=' + testFile.name,
            field: testFile.field,
            sys_id: testFile.sys_id,
            payload: body
        };

        updateRecord(snc, db, recordSaved);
    });

    function recordSaved(complete) {
        if (complete) {
            // server record updated, now update local file
            api.writeFile(file, 'whatever', function (fileWritten) {
                if (fileWritten) {
                    api.send(file, sendResult);
                } else {
                    logger.test('[FAIL]:'.red + ' testSyncConflict() - could not update local file contents');
                }
            });
        } else {
            logger.test('[FAIL]:'.red + ' testSyncConflict() - could not update instance record');
            callback(false);
        }
    }

    function sendResult(complete) {
        // there was no sync conflict but should have been so we fail
        if (complete) {
            logger.test('[FAIL]:'.red + ' testSyncConflict() - we overwrote our online record without a sync conflict');
            callback(false);
        } else {
            // there was a sync conflict and the record was not updated (as expected);
            logger.test('[PASS]:'.green + ' testSyncConflict() - we received a sync conflict and the record was not updated');
            callback(true);
        }
    }
}

/*
 * Some File I/O ops can confuse the watcher ("atomic save") so we have implemented
 * functionality to ensure files with content are not overwritten. This should test that.
 *
 * 1. Get test file
 * 2. Update local file content
 * 3. Simulate sending file that has been flagged as "newly discovered"
 *   .. should cause an upload
 *
 * Note: no need to retest functions using addFile() as new logic is only in
 * watcher function.
 *  "fileRecords[file].setNewlyDiscoveredFile(true);"
 *
 */
function testForLocalDataLoss(callback) {
    logger.test('TEST RUNNING: testForLocalDataLoss()'.yellow);

    var testFilePath = getTestFilePath();

    // add our file
    getTestFile(function (resp) {

        if (resp) {
            var uniqueString = 'FileSync testForLocalDataLoss (' + moment().format('x') + ')';

            // now modify the file
            // (assume no call back needed because file read+write should be faster than getTestFile())
            updateLocalFile(testFilePath, uniqueString);

            logger.test('Simulating found file via addFile() call');

            getTestFile(function (success) {
                if (success) {
                    logger.test('[PASS]:'.green + ' testForLocalDataLoss() - we were able to avoid overwriting a changed file.');
                } else {
                    logger.test('[FAIL]:'.red + ' testForLocalDataLoss() - could not send changed file');
                }
                callback(success);
            });
        } else {
            callback(false);
        }
    });


    function updateLocalFile(file, additionalContent) {
        api.readFile(file, function (data) {
            var body = {
                'script': data + "\n// " + additionalContent
            };

            api.writeFile(file, body.script, function (fileWritten) {
                if (fileWritten) {
                    logger.test('Updated local file. Setting file as "newly discovered".');

                    var fileObj = api.trackFile(testFilePath);
                    fileObj.setNewlyDiscoveredFile(true);

                } else {
                    logger.test('[FAIL]:'.red + ' testForLocalDataLoss() - could not update local file contents');
                    callback(false);
                }
            });
        });
    }

}

module.exports = runTests;
