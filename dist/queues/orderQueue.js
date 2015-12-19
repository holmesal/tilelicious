'use strict';

var _fb = require('../utils/fb');

var _firebaseQueue = require('firebase-queue');

var _firebaseQueue2 = _interopRequireDefault(_firebaseQueue);

var _stripe = require('stripe');

var _stripe2 = _interopRequireDefault(_stripe);

var _ImageGenerationQueue = require('./ImageGenerationQueue');

var _ImageGenerationQueue2 = _interopRequireDefault(_ImageGenerationQueue);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var specs = {
    chargeCard: 'CHARGE_CARD',
    generatePrint: 'GENERATE_PRINT',
    createOrder: 'CREATE_ORDER'
};

var STRIPE_LIVE_KEY = process.env.STRIPE_LIVE_KEY;
var STRIPE_TEST_KEY = process.env.STRIPE_TEST_KEY;

console.info('stripe test key', JSON.stringify(process.env));

var stripe = (0, _stripe2.default)(STRIPE_TEST_KEY);

console.info('order queue up and running!');

var chargeCardQueue = new _firebaseQueue2.default(_fb.orderQueueRef, { specId: specs.chargeCard }, function (data, progress, resolve, reject) {
    console.info('got new order item, id=' + data.stripe.id);
    console.info(JSON.stringify(data));
    // First off, store this order somewhere permanent
    var orderRef = _fb.ordersRef.child(data.stripe.id);
    orderRef.set(data);

    // Attempt to charge this user's card via stripe
    stripe.charges.create({
        amount: data.order.costs.total,
        currency: 'usd',
        source: data.stripe.id,
        description: 'Charge for Victories print'
    }, function (err, charge) {
        if (err) {
            console.error(err);
            var rejectedChargeRef = _fb.rejectedChargesRef.child(data.stripe.id);
            rejectedChargeRef.set(err);
            reject(err);
        } else {
            console.info('charge succeeded...');
            // The charge succeeded
            orderRef.update({
                charge: charge
            });
            // TODO - push a queue item to generate this print
            data.charge = charge;
            resolve(data);
        }
    });
});

var generatePrintQueue = new _firebaseQueue2.default(_fb.orderQueueRef, { specId: specs.generatePrint }, function (data, progress, resolve, reject) {
    // where should this image be stored?
    var generationData = data.print;
    generationData.imageLocation = 'orders/' + data.stripe.id + '/generatedImage';
    (0, _ImageGenerationQueue2.default)(generationData).then(function (url) {
        data.generatedImage = url;
        resolve(data);
    }).catch(reject);
});