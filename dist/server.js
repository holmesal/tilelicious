'use strict';

var _printful = require('./utils/printful');

var _expressHttpProxy = require('express-http-proxy');

var _expressHttpProxy2 = _interopRequireDefault(_expressHttpProxy);

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _url = require('url');

var _url2 = _interopRequireDefault(_url);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var app = (0, _express2.default)();

app.use('/printful-proxy', (0, _expressHttpProxy2.default)(_printful.ENDPOINT, {

    filter: function filter(req, res) {
        var path = _url2.default.parse(req.url).path;
        //console.info(path);
        if (path === '/' || path === '/tax/rates' || path === '/shipping/rates') {
            return true;
        } else {
            return false;
        }
    },

    forwardPath: function forwardPath(req, res) {
        return _url2.default.parse(req.url).path;
    },

    intercept: function intercept(rsp, data, req, res, callback) {
        res.set('Access-Control-Allow-Origin', '*');
        callback(null, data);
    },

    decorateRequest: function decorateRequest(req, res) {
        req.headers['Authorization'] = 'Basic ' + _printful.API_KEY;
        return req;
    }

}));

app.get('/', function (req, res) {
    return res.send('hiiiii');
});

app.post('/printful-hooks', function (req, res) {
    (0, _printful.handleWebhook)(req.body).then(function () {
        return res.end('ok');
    }).catch(function (err) {
        return res.status(500).send('oh shit.');
    });
});

var port = process.env.PORT || 5000;

var server = app.listen(port, function () {
    return console.info('server running at http://' + server.address().address + ':' + server.address().port);
});