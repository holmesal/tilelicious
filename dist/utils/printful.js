'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.handleWebhook = exports.createOrder = exports.getItem = exports.items = exports.ENDPOINT = exports.API_KEY = undefined;

var _superagent = require('superagent');

var _superagent2 = _interopRequireDefault(_superagent);

var _slack = require('./slack');

var _slack2 = _interopRequireDefault(_slack);

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
                console.info(err);
                reject(err);
            } else {
                console.info(res.body);
                resolve(res.body.result);
            }
        });
    });
};

var handleWebhook = exports.handleWebhook = function handleWebhook(body) {
    return new Promise(function (resolve, reject) {
        console.info('got webhook!', body);
        if (body.type === 'package_shipped') {
            (0, _slack2.default)(':package::truck::airplane_departure: package shipped via *' + body.shipment.carrier + '+' + body.shipment.service + '* from printful!\n\n                en route to *' + body.order.recipient.name + '* in *' + body.order.recipient.city + ', ' + body.order.recipient.state_name + ', ' + body.order.recipient.country_name + '*\n\n                track this package: ' + body.shipment.tracking_url);
        } else if (body.type === 'order_failed') {
            (0, _slack2.default)(':cry::poop: order failed for reason *' + body.data.reason + '*\n\n                you should probably go here and fix shit: https://www.theprintful.com/dashboard/default');
        } else if (body.type === 'order_canceled') {
            (0, _slack2.default)(':japanese_ogre: an order to *' + body.order.recipient.name + '* was cancelled. I sure hope this was intentional');
        } else {
            reject();
        }
        resolve();
    });
};