'use strict';

var _fb = require('../utils/fb');

var _firebaseQueue = require('firebase-queue');

var _firebaseQueue2 = _interopRequireDefault(_firebaseQueue);

var _stripe = require('stripe');

var _stripe2 = _interopRequireDefault(_stripe);

var _ImageGenerationQueue = require('./ImageGenerationQueue');

var _ImageGenerationQueue2 = _interopRequireDefault(_ImageGenerationQueue);

var _email = require('../utils/email');

var _printful = require('../utils/printful');

var _slack = require('../utils/slack');

var _slack2 = _interopRequireDefault(_slack);

var _log = require('../log');

var _log2 = _interopRequireDefault(_log);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var specs = {
    chargeCard: 'CHARGE_CARD',
    generatePrint: 'GENERATE_PRINT',
    createOrder: 'CREATE_ORDER',
    sendPrintGeneratedEmail: 'SEND_PRINT_GENERATED_EMAIL',
    storeCompletedOrder: 'STORE_COMPLETED_ORDER'
};

var STRIPE_LIVE_KEY = process.env.STRIPE_LIVE_KEY;
var STRIPE_TEST_KEY = process.env.STRIPE_TEST_KEY;

_log2.default.info('order queue up and running!');

var chargeCardQueue = new _firebaseQueue2.default(_fb.orderQueueRef, { specId: specs.chargeCard }, function (data, progress, resolve, reject) {
    _log2.default.info('got new order item, id=' + data.stripe.id);
    _log2.default.info(JSON.stringify(data));
    // First off, store this order somewhere permanent
    var orderRef = _fb.ordersRef.child(data.stripe.id);
    orderRef.set(data);

    // Live or test?
    var stripe = void 0;
    if (data.stripe.livemode) {
        console.info('using LIVE stripe key!');
        stripe = (0, _stripe2.default)(STRIPE_LIVE_KEY);
    } else {
        console.info('using TEST stripe key!');
        stripe = (0, _stripe2.default)(STRIPE_TEST_KEY);
    }

    // Attempt to charge this user's card via stripe
    stripe.charges.create({
        amount: data.order.costs.total,
        currency: 'usd',
        source: data.stripe.id,
        description: 'Charge for Victories print',
        receipt_email: data.stripe.email
    }, function (err, charge) {
        if (err) {
            _log2.default.error(err);
            var rejectedChargeRef = _fb.rejectedChargesRef.child(data.stripe.id);
            rejectedChargeRef.set(err.raw);
            reject(err);
        } else {
            _log2.default.info('charge succeeded...');
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

// Generate a print

var generatePrintQueue = new _firebaseQueue2.default(_fb.orderQueueRef, { specId: specs.generatePrint }, function (data, progress, resolve, reject) {
    // where should this image be stored?
    var generationData = data.print;
    generationData.imageLocation = 'orders/' + data.stripe.id + '/generatedImage';
    (0, _ImageGenerationQueue2.default)(generationData).then(function (url) {
        data.generatedImage = url;
        resolve(data);
    }).catch(reject);
});

// Send an email to notify the user that their print has been generated
var sendPrintGeneratedEmailQueue = new _firebaseQueue2.default(_fb.orderQueueRef, { specId: specs.sendPrintGeneratedEmail }, function (data, progress, resolve, reject) {
    // where should this image be stored?
    var printFileUrl = data.generatedImage;
    var customerEmail = data.createdOrder.recipient.email;
    (0, _email.sendPrintGeneratedEmail)(customerEmail, printFileUrl, data.createdOrder.external_id).then(function (sendgridResponse) {
        data.printGeneratedEmailSendgridResponse = sendgridResponse;
        resolve(data);
    }).catch(reject);
});

// Store the completed order somewhere for future reference
var storeCompletedOrderQueue = new _firebaseQueue2.default(_fb.orderQueueRef, { specId: specs.storeCompletedOrder }, function (data, progress, resolve, reject) {
    _fb.completedOrdersRef.child(data.stripe.id).set(data);
    resolve();
});

// Create a printful order
var createOrderQueue = new _firebaseQueue2.default(_fb.orderQueueRef, { specId: specs.createOrder }, function (data, progress, resolve, reject) {
    var _data$order$address = data.order.address,
        addressLine1 = _data$order$address.addressLine1,
        addressLine2 = _data$order$address.addressLine2,
        city = _data$order$address.city,
        country = _data$order$address.country,
        fullName = _data$order$address.fullName,
        state = _data$order$address.state,
        zip = _data$order$address.zip;

    // Get the item

    var item = (0, _printful.getItem)(data.order.size, data.order.framed);
    // Add the image
    item.files = [{
        url: data.generatedImage,
        //filename: data.stripe.id,
        visible: true
    }];
    // Build the order
    var order = {
        external_id: data.stripe.id,
        shipping: data.order.shippingSpeed,
        recipient: {
            name: fullName,
            address1: addressLine1,
            address2: addressLine2,
            city: city,
            state_code: state,
            country_code: country,
            zip: zip,
            email: data.stripe.email
        },
        items: [item],
        retail_costs: {
            shipping: (data.order.costs.shipping / 100).toFixed(2).toString(),
            tax: (data.order.costs.tax / 100).toFixed(2).toString()
        }
    };
    // Submit the order to printful
    (0, _printful.createOrder)(order).then(function (createdOrder) {
        data.createdOrder = createdOrder;
        _log2.default.info('successfully created printful order');
        var orderRef = _fb.ordersRef.child(data.stripe.id);
        orderRef.update(data);
        // Post to slack
        var chargeUrl = 'https://dashboard.stripe.com/' + (data.charge.livemode ? '' : 'test/') + 'payments/' + data.charge.id;
        (0, _slack2.default)('\n            :printer::moneybag: new order for *' + createdOrder.recipient.name + '* in *' + createdOrder.recipient.city + ', ' + createdOrder.recipient.country_name + '* submitted to printful!\n\n                cost: ' + createdOrder.costs.total + '    retail: ' + createdOrder.retail_costs.total + '    *profit: ' + (parseFloat(createdOrder.retail_costs.total) - parseFloat(createdOrder.costs.total)) + '*\n\n                :mag: Go here to check the print image for issues: <' + data.generatedImage + '>\n\n                :flag-ng: Then, go here to make sure the card charge succeeded <' + chargeUrl + '>\n                :truck: Finally, go here to ship order `' + data.stripe.id + '`: <https://www.theprintful.com/dashboard/default>\n            ', true);
        resolve(data);
    }).catch(reject);
});