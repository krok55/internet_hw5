var myHttp = require("./myHttp");
var http = require('http');

var port = 8887;
var resourceMap = {
    '/hi': '/a',
    '/': '/profile.html'
};
var rootFolder = 'C:\\Users\\LEO\\Documents\\HUJI\\Internet Technologies\\hw4\\www';

var server = myHttp.createStaticHTTPServer(resourceMap, rootFolder);

server.startServer(port);

setTimeout(function () {
    server.stopServer(port);
}, 10000000);