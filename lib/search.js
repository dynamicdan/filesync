// non documented function. Worry about that some other day. It won't go away soon because nodejs relies on it!
var extend = require('util')._extend;

var FileRecordUtil = require('./file-record');

var method = Search.prototype;

function Search(config, snc) {
    this.config = config;
    this.snc = snc;
    this.logger = config._logger;
}

method.getResults = function (queryObj, callback) {
    var logger = this.logger,
        snc = this.snc,
        config = this.config,
        recordsFound = {},
        _this = this,
        db = {
            table: queryObj.table || '',
            query: queryObj.query || '',
            rows: queryObj.rows || 5 // default
        };

    var table = '',
        folObj,
        fieldInList,
        fields,
        callCount = 0;


    if (queryObj.demo) {
        logger.info('- - - - Running in Demo mode - - - -'.yellow);
        db.table = 'sys_script';
        db.query = 'sys_updated_by' + '=' + 'admin' + '^ORDERBYDESC' + 'sys_updated_on';
        queryObj.table = db.table;
        logger.info('Using search options: ', db);
    }

    function receivedRecords(records) {
        callCount--;
        // only callback once all queries have completed
        if (callCount <= 0) {
            var len = Object.keys(recordsFound).length;
            logger.info('Total records found: %s'.green, len);
            logger.info('(max records returned per search set to %s)', db.rows);
            callback(_this, queryObj, recordsFound);
        }
    }

    // for each folder and field in folder query for records
    // (handles searching only one table as well if set)
    for (var folder in config.folders) {

        folObj = config.folders[folder];
        table = folObj.table;
        fields = folObj.fields;

        // Check if we're only looking for one table
        if (queryObj.table && table != db.table) {
            continue;
        }

        db.key = folObj.key;
        db.folder = folder;
        db.table = table;

        for (fieldInList in fields) {
            db.fieldSuffix = fieldInList;
            callCount++;
            getRecords(fields[fieldInList], db, receivedRecords);
        }
    }

    if (queryObj.table && callCount === 0) {
        logger.warn('No table config defined for: %s', queryObj.table);
    }

    function getRecords(fieldName, db, cb) {
        //logger.debug('args:', arguments);

        // we have a problem with objects "passed by reference" and so we make a local var here
        var loc = {},
            locDB = extend(loc, db);

        snc.table(locDB.table).getRecords(locDB, function (err, obj) {
            if (err) {
                logger.info('ERROR in query or response.'.red);
                logger.info(err);
                cb([]);
                return;
            }
            if (obj.records.length === 0) {
                logger.info('No records found on %s:'.yellow, locDB.table);
                cb([]);
                return;
            }

            var recordIndex;
            for (recordIndex in obj.records) {
                var record = obj.records[recordIndex],
                    recordName = record[locDB.key],
                    sys_id = record.sys_id,
                    recordData = record[fieldName];


                logger.debug('Record Found: "' + recordName + '"');
                logger.debug('- Created on ' + record.sys_created_on);
                logger.debug('- Updated by ' + record.sys_updated_by + ' on ' + record.sys_updated_on);


                var isSCSSRecord = FileRecordUtil.isSCSS(recordName);
                // check that it is really a SCSS file and not a CSS file!
                if (locDB.fieldSuffix == 'scss' && !isSCSSRecord) {
                    continue; // skip, not applicable for this folder
                }
                if (locDB.fieldSuffix == 'css' && isSCSSRecord) {
                    continue; // skip, not applicable for this folder
                }

                recordsFound[sys_id] = {
                    recordName: recordName,
                    recordData: recordData,
                    table: locDB.table,
                    folder: locDB.folder,
                    fieldSuffix: locDB.fieldSuffix
                };

                var additionalProps = ['sys_id', 'sys_updated_on', 'sys_updated_by'];
                for (var i = 0; i < additionalProps.length; i++) {
                    var key = additionalProps[i];
                    recordsFound[sys_id][key] = record[key];
                }

            }

            logger.info('Found %s records for %s'.green, (recordIndex * 1 + 1), locDB.table);

            cb(obj.records);

        });
    }

};

module.exports = {
    Search: Search
};
