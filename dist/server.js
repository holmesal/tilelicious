'use strict';

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _httpProxy = require('http-proxy');

var _httpProxy2 = _interopRequireDefault(_httpProxy);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var API_KEY = new Buffer('0gkrd0lh-sijv-7xjo:y2al-e81r2lfuzmh6').toString('base64');
var PRINTFUL_API = 'http://api.theprintful.com';
console.info(API_KEY);

var proxy = _httpProxy2.default.createProxyServer({
    //auth: `Basic ${API_KEY}`
});

proxy.on('proxyReq', function (proxyReq, req, res, options) {
    proxyReq.setHeader('Authorization', 'Basic ' + API_KEY);
    //proxyReq.setHeader('Content-Type', null)
    console.info(req.headers);
    console.info(req.body);
});

proxy.on('proxyRes', function (proxyRes, req, res) {
    console.info(res.headers);
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
});

_http2.default.createServer(function (req, res) {
    //res.end('ello ello!');
    proxy.web(req, res, {
        target: PRINTFUL_API
    });
}).listen(process.env.PORT || 5000);