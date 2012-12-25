exports.LAST_REQUEST_TIMEOUT_SEC = 2;
exports.MAX_STRING_LENGTH = 255;
exports.MAX_HEADER_SIZE = 8192, // the header size is also 8KB
exports.MAX_MESSAGE_SIZE = 10485760 // maximum request size (10MB)
exports.MAX_REQUESTS_PER_CONNECTION = 1000 // no more than 1000 is allowed (for keep-alive mechanism)
exports.MAX_REQUESTS = 2000000 // limit on a total number of requests