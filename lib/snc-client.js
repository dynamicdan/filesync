/*
 * The util that controls sending the actual server communications
 */

var http = require('http');
var restler = require('@mishguru/restler');
var url = require('url');
var util = require('util');

var logger = false;

// service takes args: <init fn>, <props>, <API>.
var sncClient = restler.service(function sncClient(config) {
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
        // allow testing on localhost/http but default to https
        protocol = config.protocol ? config.protocol : 'https',
        clientOptions = {
            baseURL: protocol + '://' + config.host
        };

    this.baseURL = clientOptions.baseURL;
    this.defaults.username = user;
    this.defaults.password = pass;
    this.defaults.headers = {
        'Content-Type': 'application/json',
        'Accepts': 'application/json'
    };

    // proxy support
    if (config.proxy) {
        this.defaults.proxy = {
            'host': config.proxy.host,
            'port': config.proxy.port
        };
    }

}, {
    // props already set in previous arguement
}, {

    table: function table(tableName) {
        var client = this;

        function validateResponse(result, res) {

            // consider moving low level debug to high level debug (end user as below)
            logResponse(result, res);

            var help = '';
            // special failing case (connections blocked etc.)
            if (result instanceof Error) {

                var errorList = {
                    'ECONNREFUSED': 'Missing internet connection or connection was refused!',
                    'ENOTFOUND': 'No connection available (do we have internet?)',
                    'ETIMEDOUT': 'Connection timed out. Internet down?'
                };

                help = errorList[result.code] || 'Something failed badly.. internet connection rubbish?';
                help += util.format('\ndetails: %j', result);
                logger.warn(help);
                logger.error(result);
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
                if (result instanceof Error) {
                    message += util.format('\ndetails: %j', result);
                }
                return new Error(message);
            }
            if (result instanceof Error) {
                return result;
            }
            if (result.error) {
                logger.error('ERROR found in obj.error : ', result.error);
                // DP TODO : Investigate: Error: json object is null
                return new Error(result.error);
                // this is actually not an error! It's just that the server didn't return anything to us
                //return null;
            }
            if (!result.records) {
                return new Error(util.format('Response missing "records" key: %j\nCheck server logs.', result));
            }
            return null;
        }

        function logResponse(result, res) {
            var resCode = res ? res.statusCode : 'no response';
            logger.debug('-------------------------------------------------------');
            logger.debug(result);
            // TODO - dropped extra debug support with restler migration
            // client.baseURL
            logger.debug('-------------------------------------------------------');
        }

        function send(request) {
            var maxRecords = request.rows || 1;
            var urlObj = {
                pathname: '/' + request.table + '.do',
                query: {
                    // JSONv2 not JSON (Eureka+)
                    JSONv2: '',
                    sysparm_record_count: maxRecords,
                    sysparm_action: request.action,
                    displayvalue: true
                }
            };

            if (request.parmName) {
                urlObj.query['sysparm_' + request.parmName] = request.parmValue;
            }

            var path = url.format(urlObj);
            logger.debug('snc-client send() path: ' + path);

            function handleResponse(result, res) {
                var err = validateResponse(result, res, request);
                request.callback(err, result);
            }

            // we may have some connection issues with TCP resets (ECONNRESET). Lets debug them further.
            try {
                if (request.postObj) {
                    // TODO - consider adding more callbacks here like timeout and error/fail etc.
                    client.post(path, {
                        data: JSON.stringify(request.postObj)
                    }).on('complete', handleResponse);
                } else {
                    client.get(path).on('complete', handleResponse);
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
                if(query.noClassName) {
                    // don't add the additional query constraint
                } else {
                    // ensures that tables that are extended are still restricted to 1 table
                    parms.parmValue += "^sys_class_name=" + tableName;
                }
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
});

module.exports = sncClient;
