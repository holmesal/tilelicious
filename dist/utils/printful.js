'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.handleWebhook = exports.createOrder = exports.getItem = exports.items = exports.ENDPOINT = exports.API_KEY = undefined;

var _superagent = require('superagent');

var _superagent2 = _interopRequireDefault(_superagent);

var _slack = require('./slack');

var _slack2 = _interopRequireDefault(_slack);

var _log = require('../log');

var _log2 = _interopRequireDefault(_log);

var _email = require('./email');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var API_KEY = exports.API_KEY = new Buffer(process.env.PRINTFUL_API_KEY).toString('base64');
var ENDPOINT = exports.ENDPOINT = 'http://api.theprintful.com';
var items = exports.items = {
    '12x16': {
        unframed: {
            external_id: '12x16_unframed',
            variant_id: 1349,
            quantity: 1,
            retail_price: '20.00',
            named: 'Unframed 12x16'
        },
        framed: {
            external_id: '12x16_franed',
            variant_id: 1350,
            quantity: 1,
            retail_price: '50.00',
            named: 'Framed 12x16'
        }
    },
    '18x24': {
        unframed: {
            external_id: '18x24_unframed',
            variant_id: 1,
            quantity: 1,
            retail_price: '45.00',
            named: 'Unframed 18x24'
        },
        framed: {
            external_id: '18x24_framed',
            variant_id: 3,
            quantity: 1,
            retail_price: '80.00',
            named: 'Framed 18x24'
        }
    }
};

var getItem = exports.getItem = function getItem(size, framed) {
    var framedString = framed ? 'framed' : 'unframed';
    return items[size][framedString];
};

var createOrder = exports.createOrder = function createOrder(order) {
    return new Promise(function (resolve, reject) {
        _superagent2.default.post(ENDPOINT + '/orders').send(order).set('Authorization', 'Basic ' + API_KEY).end(function (err, res) {
            if (err) {
                _log2.default.info(err);
                reject(err);
            } else {
                _log2.default.info(res.body);
                resolve(res.body.result);
            }
        });
    });
};

var handleWebhook = exports.handleWebhook = function handleWebhook(body) {
    return new Promise(function (resolve, reject) {
        var data = body.data;

        _log2.default.info(body);
        if (body.type === 'package_shipped') {
            // Send the user a shipping confirmation
            (0, _email.sendPrintShippedEmail)(data.order.recipient.email, data.shipment.tracking_url, data.order.external_id);
            // Let us know in slack
            (0, _slack2.default)(':package::truck::airplane_departure: package `' + data.order.external_id + '` (printful id: `' + data.order.id + '`) shipped via *' + data.shipment.carrier + '+' + data.shipment.service + '* from printful!\n\n                en route to *' + data.order.recipient.name + '* in *' + data.order.recipient.city + ', ' + data.order.recipient.state_name + ', ' + data.order.recipient.country_name + '*\n\n                track this package: ' + data.shipment.tracking_url);
        } else if (body.type === 'order_failed') {
            (0, _slack2.default)(':cry::poop: order failed for reason *' + data.reason + '*\n\n                you should probably go here and fix shit: https://www.theprintful.com/dashboard/default');
        } else if (body.type === 'order_canceled') {
            (0, _slack2.default)(':japanese_ogre: an order to *' + data.order.recipient.name + '* was cancelled. I sure hope this was intentional');
        } else {
            reject();
        }
        resolve();
    });
};