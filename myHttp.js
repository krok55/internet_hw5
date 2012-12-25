var net = require('net');
//var url = require('url');
//var qs = require('querystring');
var fs = require('fs');
var path = require('path');
var settings = require('./settings');
/***************** TODO ************************

 1. Add keep-alive upon receiving one            NO NEED
 2. Support all kind of headers (with spaces, multiple lines     DONE
 3. support all kind of characters in file name  DONE
 4. finish status - make sure it contains right names (As in ex4) CONTAINS RIGHT NAMES
 5. implement stopServer
 6. add support for params in GET (seperated by '?')    DONE
 7. make sure content-length is there for POST (otherwise output an error)  DONE
 8. limit the size of headers , values and filename     DONE
 9. support for full path in URI (GET http://127.0.0.1 HTTP/1.1)

 *************************************************/
function createStaticHTTPServer(pResourceMap, pRootFolder) {
    //try {
    function Server () {

        /*******************/
        /* Private Members */
        /*******************/

        var that = this;
        var isStarted = false;
        var startedTime = 0;
        var numOfSuccessfulRequests = 0;
        var numOfCurrentRequests = 0;
        var numOfTotalRequests = 0;
        var resourceMap = pResourceMap;
        var rootFolder = pRootFolder;
        var port = null;
        var server = null;


        var CONTENT_TYPES = {
            "js" : "application/javascript",
            "txt" : "text/plain",
            "html" : "text/html",
            "htm" : "text/html",
            "css" : "text/css",
            "jpg" : "image/jpeg",
            "jpeg" : "image/jpeg",
            "gif" : "image/gif",
            "png" :"image/png",
            "ico" : "image/vnd.microsoft.icon"
        };



        /******************/
        /* Public Members */
        /******************/


        /*******************/
        /* Private Methods */
        /*******************/
        function Mutex() {
            var waitQueue = [];
            var that = this;

            function execute() {
                var code;
                var param;
                if(waitQueue.length > 0) {
                    code = (waitQueue[0])[0];
                    param = (waitQueue[0])[1];
                    code(param);
                }
            }
            this.lock = function(param,code) {
                if(!code || !param) throw new Error('Must specify code to the mutex');

                waitQueue.push([code, param]);
                console.log('Locked');
                if(waitQueue.length === 1) {
                    code(param);
                }
            };

            this.unlock = function() {
                var func = null;
                if(waitQueue.length > 0) {
                    console.log('Unlocked');
                    waitQueue.shift();
                }
                execute();
            }

            this.sizeOfQueue = function () {
                return waitQueue.length;
            }
        }





        /*********************/
        /* Interface Methods */
        /*********************/

        this.startServer = function (pPort,callBack) {

            if(port != null) {
                console.log('ERROR: The server is already listening to port ' + port + '\n');
                if(callBack) {
                    callBack();
                }
                return;
            }
            port = pPort;
            console.log('Starting server at port: ' + port + '\n');

            startedTime = new Date();
            server = net.createServer({allowHalfOpen: false});



            // Server event handlers //

            function onServerConnection(socket) {

                //var isSocketActive = false;
                var isKeepAlive = false;
                var numOfSocketRequests = 0;
                var activeFileName = null;

                var fileType = '';
                var requestedFile = '';
                var fileLocation = '';

                //for function onSocketData
                var dataCollectedSoFar = '';
                var bodyCollectedSoFar = '';
                var parsedHeader = {};
                var isTimeout = true;
                var mutex = new Mutex();
                console.log('Server connected at port: ' + port + '\n');

                if(numOfCurrentRequests >= settings.MAX_REQUESTS) {
                    reportError(503,'Server overloaded - no more new connections accepted');
                    return;
                }
                /* responds to a request */
                function respond(parsedData, callback) {
                    console.log('responding...\n');

                    // reset timeout
                    //socket.setTimeout(0);
                    isTimeout = false;
                    socket.setTimeout(settings.LAST_REQUEST_TIMEOUT_SEC * 1000, function() {
                        isTimeout = true;
                        onSocketTimeout();
                    });
                    // executed upon a successful request parsing...

                    isKeepAlive = !((parsedData.httpVersion === '1.0' && parsedData['Connection'].toString().toLowerCase() === 'keep-alive') || parsedData['Connection'] === 'close');


                    console.log('parsedData.RequestURI: ' + parsedData.RequestURI);

                    if(parsedData.RequestURI === '/status') {
                         writeStatus(callback);
                        return;
                    }
                    /*					    //print parsed data to console
                     var output = '';
                     for (property in parsedData) {
                     output += (property.toString() + ': ' + parsedData[property]+'\n');
                     }
                     console.log('PARSED_DATA:\n' + output + '\nEND_OF_PARSED_DATA');*/


                    console.log('Num of current requests:  '+ numOfCurrentRequests + '\n');
                    fileType = '';
                    requestedFile = (!resourceMap[parsedData.RequestURI]) ? parsedData.RequestURI : resourceMap[parsedData.RequestURI];
                    requestedFile = path.normalize(requestedFile);
                    /*
                     if(requestedFile[0] !== path.sep) {
                     reportError(403,'Forbidden! the requested uri must start with '/'');
                     return {};
                     }
                     */
                    if(requestedFile[0] !== path.sep ) {
                        requestedFile =path.normalize( '/' + requestedFile);
                    }
                    fileLocation = path.join(rootFolder,path.normalize(requestedFile));
                    activeFileName = fileLocation;
                    console.log('parsed file is ' + requestedFile);

                    fileType = path.extname(fileLocation).slice(1);

                    // check for correct method
                    if (!CONTENT_TYPES[fileType]) {
                        reportError(415, 'Invalid file type (' + fileType + ') requested',callback);
                        return;
                    }

                    // validate that the requested URI is a valid file
                    fs.exists(fileLocation, function (isExist) {
                        if(!isExist) {
                            reportError(404,'The File (' + fileLocation + ') was not found',callback);
                            return;
                        }
                        fs.stat(fileLocation, function (err, stat) {
                            if(err) {
                                reportError(500,'Internal Server Error',callback);
                                return;
                            }
                            if(!stat.isFile()) {
                                reportError(404,'The File (' + fileLocation + ') was not found',callback);
                                return;
                            }
                            console.log('File size is ' + stat.size + '\n');

                            writeFile(fileLocation,CONTENT_TYPES[fileType],stat.size, callback);
                        });
                    });
                }

                function writeStatus(callback) {
                    var resourceMapOutput = '';
                    var rm = that.status().resourceMap;
                    for (var property in rm) {
                        if(!property)  property = 'null';
                        resourceMapOutput += (property.toString() + ' : ' + rm[property]+'<br />');
                    }

                    var content = '<html><body><h1> Status: </h1><br />';
                    content += 'isStarted = ' + (that.status().isStarted ? 'True' : 'False') + '<br />';
                    content += 'startedDate = ' + that.status().startedDate.toDateString() + ', ' + that.status().startedDate.toTimeString() + '<br />';
                    content += 'port = ' + that.status().port + '<br />';
                    content += 'resourceMap = <br />' + resourceMapOutput;
                    content += 'numOfCurrentRequests = ' + that.status().numOfCurrentRequests + '<br />';
                    content += 'precntageOfSuccesfulRequests = ' + that.status().precntageOfSuccesfulRequests + '<br />';

                    content += '</body></html>';
                    writeHeader(200,'OK',CONTENT_TYPES['html'],content.length, function () {
                        if(!socket.writable) {
                            isKeepAlive = false;
                            cleanUpAndClose();
                            return;
                        }

                        socket.write(content + '\r\n', function () {
                            cleanUpAndClose();
                            if(callback)
                                callback();
                        });
                    });
                }

                /* report error and display an HTML on the screen */
                function reportError(errorId, errorMessage, callback) {
                    console.log('reporting error: ' + errorId + ' ' + errorMessage);
                    var content = '<html><body><h1>' + errorId + ' : ' + errorMessage + '</h1></body></html>\r\n';
                    writeHeader(errorId,errorMessage,CONTENT_TYPES['html'],content.length, function () {
                        if(!socket.writable) {
                            isKeepAlive = false;
                            cleanUpAndClose();
                            return;
                        }
                        socket.write(content + '\r\n', function () {
                            cleanUpAndClose();
                            if(callback)
                                callback();
                        });
                    });
                }

                /* manages statistics and destroys the sokcet */
                function cleanUpAndClose() {
                    console.log('Cleaning-up before closing... \n');
                    //if(!isSocketActive) return;
                    //isSocketActive = false;
                    if(numOfCurrentRequests < 0) throw {"msg" : "impossible number of current requests"};
                    if(numOfSocketRequests > numOfCurrentRequests) throw {"msg" : "the are more socket requests than total - impossible!"};
                    //if(numOfSocketRequests === 0) return;

                    if(!isKeepAlive) {
                        numOfCurrentRequests -= numOfSocketRequests;
                        numOfSocketRequests = 0;
                        isTimeout = false;
                        socket.end();
                    }
                    else if(numOfSocketRequests > 0) {
                        numOfSocketRequests--;
                        numOfCurrentRequests--;
                    }
                    console.log('Num of current requests:  '+ numOfCurrentRequests + '\n');
                }

                /* outputs a file to the client browser */
                function writeFile(fileLocation, contentType,fileSize,callback) {
                    var readStream = fs.createReadStream(fileLocation);
                    // ReadStream event handlers //

                    function onStreamEnd() {

                        if(!socket.writable) {
                            isKeepAlive = false;
                            cleanUpAndClose();
                            return;
                        }
                        console.log('Read a total of ' + fileSize + ' bytes from ' + fileLocation + '\n');
                        socket.write('\r\n');
                        cleanUpAndClose();
                        if(callback)
                            callback();
                    }

                    function onStreamClose() {
                        console.log('File ' + fileLocation +' is closed.\n');
                    }

                    function onStreamError() {
                        console.log('Error reading the file... \n');
                        readStream.destroy();
                        reportError(500,"Unable to open file",callback);
                    }

                    function onStreamOpen() {
                        console.log('Opening the file...\n');
                    }
                    // add event listeners
                    readStream.on('open',onStreamOpen);
                    //readStream.on('data',onStreamData);
                    readStream.on('end',onStreamEnd);
                    readStream.on('close',onStreamClose);
                    readStream.on('error',onStreamError);

                    writeHeader(200,'OK',contentType,fileSize, function () {
                        if(!socket.writable) {
                            isKeepAlive = false;
                            cleanUpAndClose();
                            return;
                        }
                        readStream.pipe(socket,{end:false});
                    });
                }

                /* writes a header */
                function writeHeader(code,message,contentType,contentSize, callBackFunction) {
                    var content = 'HTTP/1.1 ' + code + ' ' + message + '\r\n';
                    if(!socket.writable) {
                        isKeepAlive = false;
                        cleanUpAndClose();
                        return;
                    }

                    if(code === 200)
                        numOfSuccessfulRequests++;

                    content += 'Host: ' + socket.address().address + ' \r\n';
                    content += 'Accept-Ranges: binary \r\n';
                    content += 'Content-Type: ' + contentType + '\r\n';
                    content += 'Content-Length: '+ contentSize + '\r\n\r\n';

                    //console.log('Content: ' + content);

                    socket.write(content,callBackFunction);
                }

                function parseData(data) {
                    //console.log('---------data: ' + data);

                    var parsedData = {};
                    var bodyLengthRemaining = 0;



                    //console.log('Data received:' + '\n' + data + '\n');

                    dataCollectedSoFar += data.toString();

                    if(dataCollectedSoFar.length >= settings.MAX_MESSAGE_SIZE) {
                        reportError(413,'HTTP Request exceeds 10MB - blocked due to security reasons');
                        return {};
                    }
                    //a new line within a certain amount of time
                    if(dataCollectedSoFar.indexOf('\r\n\r\n') === -1) {
                        return;
                    } else if (!parsedHeader['Method']) {
                        parsedHeader = parseHeader(dataCollectedSoFar.slice(0, dataCollectedSoFar.indexOf('\r\n\r\n')));
                        bodyCollectedSoFar = dataCollectedSoFar.slice(dataCollectedSoFar.indexOf('\r\n\r\n') + '\r\n\r\n'.length);
                    } else {
                        bodyCollectedSoFar += data.toString();
                    }

                    if (!parsedHeader['Method']) {
                        return;
                    }

                    if(mutex.sizeOfQueue() >= settings.MAX_REQUESTS_PER_CONNECTION) {
                        reportError(503,'Too many requests from the same connection.');
                        return {};
                    };
                    if (parsedHeader['Method']==='GET') {
                        mutex.lock(parsedHeader, function (header) {
                            numOfCurrentRequests++;
                            numOfTotalRequests++;
                            numOfSocketRequests++;
                            respond(header, function() {
                                mutex.unlock();
                            });
                        });

                        dataCollectedSoFar = bodyCollectedSoFar;
                        bodyCollectedSoFar = '';
                        parsedHeader = {};
                        parseData('');
                        // return;
                    } else {//POST
                        bodyLengthRemaining = parsedHeader['content-length'] - bodyCollectedSoFar.length;

                        if (bodyLengthRemaining <= 0) {
                            if (bodyLengthRemaining === 0) {
                                parsedData = parseBody(bodyCollectedSoFar, parsedHeader);
                                mutex.lock(parsedData, function (header) {
                                    numOfCurrentRequests++;
                                    numOfTotalRequests++;
                                    numOfSocketRequests++;
                                    respond(header, function () {
                                        mutex.unlock();
                                    });

                                });
                                dataCollectedSoFar = '';
                                parsedHeader = {};
                            } else {
                                parsedData = parseBody(bodyCollectedSoFar.slice(0, bodyLengthRemaining), parsedHeader);
                                //data for next request
                                dataCollectedSoFar = dataCollectedSoFar.slice(bodyLengthRemaining);
                                mutex.lock(parsedData, function (header) {
                                    numOfCurrentRequests++;
                                    numOfTotalRequests++;
                                    numOfSocketRequests++;
                                    respond(header, function () {
                                        mutex.unlock();
                                    });
                                });
                                parsedHeader = {};
                                parseData('');
                            }
                        }
                    }
                }
                /*Returns an object containing all the information about the HTTP request in the initial line and headers.
                 The object maps strings to strings for all fields. Note: all headers are lower-case strings!*/
                function parseHeader(data) {
                    //console.log('parsing request header');
                    //console.log('data: ' + data);
                    var parsedData = {};
                    var splitLine = '';
                    var splitDataLines = data.split('\r\n');
                    var splitInitialLine = splitDataLines[0].split(' ');

                    var headerName = '';
                    var headerValue = '';
                    var length = 0;

                    var splitURI = [];

                    // check maximum header size
                    if(data.length >= settings.MAX_HEADER_SIZE) {
                        reportError(413,'Header is limited to 8KB');
                        return {};
                    }

                    // check maximum string size of the first line
                    if(splitDataLines[0].length >= settings.MAX_STRING_LENGTH) {
                        reportError(414,'Initial line (probably URI) is too long');
                        return {};
                    }
                    //check initial line has exactly 3 arguments
                    if (splitInitialLine.length!==3) {
                        console.log('Request in invalid format.');
                        reportError(400, 'Request in invalid format. Initial line does not have exactly 3 arguments (has only '+ splitInitialLine.length+')');
                        return {};
                    }

                    //check method is GET or POST
                    if (splitInitialLine[0]!=='GET' && splitInitialLine[0]!=='POST') {
                        console.log('Request in invalid format. Method is: ' + splitInitialLine[0]);
                        reportError(405, 'Request method must be GET or POST.');
                        return {};
                    }

                    if (splitInitialLine[2].trim()!=='HTTP/1.0' && splitInitialLine[2].trim()!=='HTTP/1.1') {
                        console.log('Request in invalid format. HTTP/[Ver] is: ' + splitInitialLine[2]);
                        reportError( 505, 'HTTP version is not supported or note specified correctly');
                        return {};
                    }

                    parsedData['Method'] = splitInitialLine[0];
                    splitURI = decodeURIComponent(splitInitialLine[1]).toString().split('?');

                    parsedData['RequestURI'] = splitURI[0];//get the URI itself (without url parameters
                    if(splitURI.length > 1) {
                        parsedData['URIParameters'] = splitURI[1];//get the URI itself (without url parameters
                    }
                    parsedData['HttpVersion'] = splitInitialLine[2].slice('HTTP/'.length);

                    //console.log('hi');
                    //request headers
                    for (var i = 1; i < splitDataLines.length; ++i) {


                        headerValue = splitDataLines[i].toString();

                        // check maximum string size of the first line
                        if(headerValue.length >= settings.MAX_STRING_LENGTH) {
                            reportError(413,'Header field is too big');
                            return {};
                        }
                        //console.log('firstChar' + headerValue[0]);
                        if(i > 1 && (headerValue[0] === '\t' || headerValue[0] === ' ' )) {
                            if(headerValue.match(new RegExp('[:]'))) {
                                reportError(400,'Invalid Header structure (1)');
                                return {};
                            }
                            // join this value to the previous header
                            headerValue = headerValue.replace(/^\s+|\s+$/g,'');
                            parsedData[headerName] += headerValue;
                            continue;
                        }
                        splitLine = splitDataLines[i].split(':');

                        if(splitLine.length < 2) {
                            reportError(400,'Invalid Header structure (2) on line: '+splitDataLines[i]);
                            return {};
                        }

                        headerName = splitLine[0].toString().toLocaleLowerCase();
                        headerValue = splitLine[1].toString();

                        if(headerName.length < 1 || headerValue.length < 1) {
                            reportError(400,'Invalid Header structure (3)');
                            return {};
                        }

                        if(headerName.match(new RegExp('\\s|\\t'))) {
                            reportError(400,'Invalid Header structure (4)');
                            return {};
                        }

                        headerValue = headerValue.replace(/^\s+|\s+$/g,'');
                        //headerValue.replace(' ','');
                        //headerValue.replace('\t','');

                        //parsedData[splitLine[0].toString().toLowerCase()] = splitLine[1].trim();
                        parsedData[headerName] = headerValue;
                    }

                    //if POST, check for Content-Length header

                    if (splitInitialLine[0] === 'POST') {
                        length = parsedData['content-length'];
                        if (!length || parseFloat(length) != parseInt(length) || parseInt(length) < 0) {
                            console.log('Request in invalid format. Method type is POST and no Content-Length was specified.');
                            reportError(411, 'POST method requires Content-length header');
                            return {};
                        }
                    }

                    // if exist, validate "connection" header.

                    if(parsedData['connection']) {
                        if( parsedData['connection'] !== 'close' &&  parsedData['connection'].toString().toLowerCase() !== 'keep-alive') {
                            console.log('Connection header is invalid: '+parsedData['connection']);
                            reportError(400, 'Invalid Connection header');
                            return {};
                        }
                    }
                    /*
                     //print parsed data to console
                     var output = '';
                     for (property in parsedData) {
                     output += (property.toString() + ': ' + parsedData[property]+'\n');
                     }
                     console.log('PARSED_DATA:\n' + output + '\nEND_OF_PARSED_DATA');
                     */
                    return parsedData;
                }

                function parseBody(data, parsedHeader) {
                    console.log('parsing request body');
                    //var parsedData = parsedHeader;
                    parsedHeader['RequestBody'] = data;
                    return parsedHeader;
                }



                // Socket event handlers

                function onSocketConnected() {
                    console.log('Socket connection successfully established.\n');
                }

                function onSocketData(data) {
                    //console.log('---------data: ' + data);
                    parseData(data);
                }

                function onSocketEnd() {
                    console.log('The client-side has requested to close the connection\n');
                    //isSocketActive = false;

                    isKeepAlive = false;
                    cleanUpAndClose();

                    /*
                     if(isSocketActive) {
                     isKeepAlive = false;
                     }
                     else {
                     socket.end();
                     socket.destroy();
                     }
                     */
                }

                function onSocketError() {
                    console.log('Socket Error\n');
                    cleanUpAndClose();
                }

                function onSocketTimeout() {
                    if(socket.writable && isTimeout) {
                        console.log('Socket Timeout\n');
                        isKeepAlive = false;
                        reportError(408,'Timeout');
                        cleanUpAndClose();
                    }

                }

                function onSocketClose(had_error) {
                    console.log('Socket is closed for file:' + activeFileName + (had_error ? ' due to an error' : '') + '\n');
                    //socket.setTimeout(0);
                }

                function onSocketDrain() {
                    //console.log('Socket is drained\n');
                }

                // add socket event listeners...

                socket.on('connect', onSocketConnected);
                socket.on('data', onSocketData);
                socket.on('end', onSocketEnd);
                socket.on('error',onSocketError);
                socket.on('timeout',onSocketTimeout);
                socket.on('drain',onSocketDrain);
                socket.on('close',onSocketClose);
                socket.setTimeout(settings.LAST_REQUEST_TIMEOUT_SEC * 1000);
            }


            function onServerClose() {
                // This handler is just for debugging.. should not be executed at any time
                console.log('Server was unexpectedly closed - terminating program\n');
                //throw {msg : 'Server stopped without an explicit order'};
                that.stopServer(port,callBack);
            }


            function onServerListening() {
                console.log('Server is listening on port ' + port + '\n');
                this.isStarted = true;
                if(callBack) {
                    callBack();
                }
            }


            function onServerError() {
                console.log('The server has encountered an error\n');
                //throw {msg : 'Internal server error \n'};
                that.stopServer(port,callBack);
            }

            // add server event listeners...
            server.on('connection',onServerConnection);
            server.on('error',onServerError);
            server.on('listening',onServerListening);
            server.on('close',onServerClose);
            // start listening...
            server.listen(parseInt(port));
        };

        this.stopServer = function (pPort,callBack) {
            if(port != pPort) {
                console.log('ERROR: The server is not listening to port ' + pPort + '\n');
                if(callBack) {
                    callBack();
                }
            }
            console.log('Stopping server activity at port: ' + port + '\n');
            try{
                server.close(function () {
                    port = null;
                    isStarted = false;
                    console.log('Server finished closing.\n');
                });
            }
            catch(e) {
                console.log('myHttp Exception: '+e.message);
            }
            finally {
                port = null;
                isStarted = false;
                if(callBack) {
                    callBack();
                }
            }

        };

        this.status = function () {
            return {
                isStarted: isStarted,
                startedDate: startedTime,
                port: port,
                resourceMap: resourceMap,
                numOfCurrentRequests: numOfCurrentRequests,
                precntageOfSuccesfulRequests: (numOfTotalRequests === 0) ? 0 : (numOfSuccessfulRequests / numOfTotalRequests * 100)
            };
        }


    }
    return new Server();
    //}
    /*
     catch (e) {
     console.log('FATAL ERROR: The server will be closed');
     return null;
     }
     */
}


exports.createStaticHTTPServer = createStaticHTTPServer;
