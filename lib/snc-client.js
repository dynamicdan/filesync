/*
 * The util that controls sending the actual server communications
 */

var http = require('http');
var restify = require('restify');
var url = require('url');
var util = require('util');

var logger = false;

// testing
// https.globalAgent.options.secureProtocol = 'SSLv3_method';

function sncClient(config) {
    var debug = config.debug;
    // ideally we use a kick ass logger passed in via config.
    logger = config._logger ? config._logger : {
        debug: function () {
            console.log('please define your debugger (winston)');
        },
        info: function () {
            console.log('please define your debugger (winston)');
        },
        error: function () {
            console.log('please define your debugger (winston)');
        }
    };
    var auth = new Buffer(config.auth, 'base64').toString(),
        parts = auth.split(':'),
        user = parts[0],
        pass = parts[1],
        // support testing on localhost but default to https
        protocol = config.protocol ? config.protocol : 'https',
        clientOptions = {
            url: protocol + '://' + config.host
        };

    // supports self-signed certificate issues and invalid SSL certs (eg. dev env.)
    if (config.acceptBadSSL) {
        logger.warn("We are using an insecure SSL connection.".red);
        clientOptions.rejectUnauthorized = false; // fixes UNABLE_TO_VERIFY_LEAF_SIGNATURE
    }

    // we may have some connection issues with TCP resets (ECONNRESET). Lets debug them further.
    try {
        var client = restify.createJsonClient(clientOptions);
        client.basicAuth(user, pass);
    } catch (err) {
        logger.error('Some error happend', err);
    }

    function table(tableName) {

        function validateResponse(err, req, res, obj, request) {

            // consider moving low level debug to high level debug (end user as below)
            logResponse(err, req, res, obj, request);

            var help = '';
            // special failing case (connections blocked etc.)
            if (!res && err) {

                var errorList = {
                    'ECONNREFUSED': 'Missing interent connection or connection was refused!',
                    'ENOTFOUND': 'No connection available (do we have internet?)',
                    'ETIMEDOUT': 'Connection timed out. Internet down?'
                };

                help = errorList[err.code] || 'Something failed badly.. internet connection rubbish?';
                help += util.format('\ndetails: %j', err);
                logger.warn(help);
                return new Error(help);
            }

            // standard responses
            if (res.statusCode !== 200) {

                if (res.statusCode === 401) {
                    help = 'Check credentials.';
                } else if (res.statusCode === 302) {
                    help = 'Verify JSON Web Service plugin is activated.';
                }

                var message = util.format('%s - %s', res.statusCode, http.STATUS_CODES[res.statusCode]);
                if (help) {
                    message += ' - ' + help;
                }
                if (err) {
                    message += util.format('\ndetails: %j', err);
                }
                return new Error(message);
            }
            if (err) {
                return err;
            }
            if (obj.error) {
                logger.error('ERROR found in obj.error : ', obj.error);
                // DP TODO : Investigate: Error: json object is null
                return new Error(obj.error);
                // this is actually not an error! It's just that the server didn't return anything to us
                //return null;
            }
            if (!obj.records) {
                return new Error(util.format('Response missing "records" key: %j\nCheck server logs.', obj));
            }
            return null;
        }

        function logResponse(err, req, res, obj, request) {
            var resCode = res ? res.statusCode : 'no response';
            logger.debug('-------------------------------------------------------');
            logger.debug(err);
            logger.debug('HTTP ' + req.method + ':', client.url.host, req.path,
                '\nrequest:', request.postObj || '',
                '\nresponse:', util.inspect({
                    statusCode: resCode,
                    body: obj
                }, true, 10)
            );
            logger.debug('-------------------------------------------------------');
        }

        function send(request) {
            var maxRecords = request.rows || 1;
            var urlObj = {
                pathname: '/' + request.table + '.do',
                query: {
                    // DP@SNC change : JSONv2 not JSON (Eureka+)
                    JSONv2: '',
                    sysparm_record_count: maxRecords,
                    sysparm_action: request.action
                }
            };

            if (request.parmName) {
                urlObj.query['sysparm_' + request.parmName] = request.parmValue;
            }

            var path = url.format(urlObj);
            logger.debug('snc-client send() path: ' + path);

            function handleResponse(err, req, res, obj) {
                err = validateResponse(err, req, res, obj, request);
                request.callback(err, obj);
            }

            // we may have some connection issues with TCP resets (ECONNRESET). Lets debug them further.
            try {
                if (request.postObj) {
                    client.post(path, request.postObj, handleResponse);
                } else {
                    client.get(path, handleResponse);
                }
            } catch (err) {
                logger.error('Some connection error happend...', err);
                // fail hard!
                process.exit(1);
            }
        }

        function getRecords(query, callback) {
            var parms = {
                table: tableName,
                action: 'getRecords',
                parmName: 'query',
                parmValue: query,
                rows: 1,
                callback: callback
            };
            if (query.query) {
                parms.parmValue = query.query;
                // ensures that tables that are extended are still restricted to 1 table
                parms.parmValue += "^sys_class_name=" + tableName;
            }
            if (query.rows) {
                parms.rows = query.rows;
            }
            if (query.sys_id) {
                parms.parmName = 'sys_id';
                parms.parmValue = query.sys_id;
            }

            send(parms);
        }

        function get(id, callback) {
            send({
                table: tableName,
                action: 'get',
                parmName: 'sys_id',
                parmValue: id,
                callback: callback
            });
        }

        function insert(obj, callback) {
            logger.warn('DP TODO : insert not yet tested nor supported!');
            //send({table: tableName, action: 'insert', postObj: obj, callback: callback});
        }

        /**
         * Update an instance record
         * @param query {object} - contains query data
         * @param callback {function}
         */
        function update(query, callback) {
            var parms = {
                table: tableName,
                action: 'update',
                parmName: 'query',
                parmValue: query.query,
                postObj: query.payload,
                callback: callback
            };

            // sys_id based updates
            if (query.sys_id) {
                parms.parmName = 'sys_id';
                parms.parmValue = query.sys_id;
            }
            send(parms);
        }

        return {
            get: get,
            getRecords: getRecords,
            insert: insert,
            update: update
        };
    }

    return {
        table: table
    };
}

module.exports = sncClient;
