import {orderQueueRef, ordersRef, rejectedChargesRef} from '../utils/fb';
import Queue from 'firebase-queue';
import Stripe from 'stripe';
import generatePrint from './ImageGenerationQueue';
import {getItem, createOrder} from '../utils/printful';
import say from '../utils/slack';

let specs = {
    chargeCard: 'CHARGE_CARD',
    generatePrint: 'GENERATE_PRINT',
    createOrder: 'CREATE_ORDER'
};

let STRIPE_LIVE_KEY = process.env.STRIPE_LIVE_KEY;
let STRIPE_TEST_KEY = process.env.STRIPE_TEST_KEY;

let stripe = Stripe(STRIPE_TEST_KEY);

console.info('order queue up and running!');

let chargeCardQueue = new Queue(orderQueueRef, {specId: specs.chargeCard}, (data, progress, resolve, reject) => {
    console.info('got new order item, id='+data.stripe.id);
    console.info(JSON.stringify(data));
    // First off, store this order somewhere permanent
    let orderRef = ordersRef.child(data.stripe.id);
    orderRef.set(data);

    // Attempt to charge this user's card via stripe
    stripe.charges.create({
        amount: data.order.costs.total,
        currency: 'usd',
        source: data.stripe.id,
        description: 'Charge for Victories print'
    }, (err, charge) => {
        if (err) {
            console.error(err);
            let rejectedChargeRef = rejectedChargesRef.child(data.stripe.id);
            rejectedChargeRef.set(err.raw);
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
    })
});

// Generate a print

let generatePrintQueue = new Queue(orderQueueRef, {specId: specs.generatePrint}, (data, progress, resolve, reject) => {
    // where should this image be stored?
    let generationData = data.print;
    generationData.imageLocation = `orders/${data.stripe.id}/generatedImage`;
    generatePrint(generationData)
        .then((url) => {
            data.generatedImage = url;
            resolve(data);
        })
        .catch(reject)
});

// Create a printful order
let createOrderQueue = new Queue(orderQueueRef, {specId: specs.createOrder}, (data, progress, resolve, reject) => {
    let {addressLine1, addressLine2, city, country, fullName, state, zip} = data.order.address;

    // Get the item
    let item = getItem(data.order.size, data.order.framed);
    // Add the image
    item.files = [{
        url: data.generatedImage,
        //filename: data.stripe.id,
        visible: true
    }];
    // Build the order
    let order = {
        external_id: data.stripe.id,
        shipping: data.order.shippingSpeed,
        recipient: {
            name: fullName,
            address1: addressLine1,
            address2: addressLine2,
            city,
            state_code: state,
            country_code: country,
            zip,
            email: data.stripe.email
        },
        items: [item],
        retail_costs: {
            shipping: (data.order.costs.shipping/100).toFixed(2).toString(),
            tax: (data.order.costs.tax/100).toFixed(2).toString()
        }
    };
    // Submit the order to printful
    createOrder(order)
        .then((createdOrder) => {
            data.createdOrder = createdOrder;
            console.info('successfully created printful order');
            let orderRef = ordersRef.child(data.stripe.id);
            orderRef.update(data);
            // Post to slack
            say(`:printer::moneybag: new order for *${createdOrder.recipient.name}* in *${createdOrder.recipient.city}, ${createdOrder.recipient.country_name}* submitted to printful!\n
                cost: ${createdOrder.costs.total}    retail: ${createdOrder.retail_costs.total}    *profit: ${parseFloat(createdOrder.retail_costs.total) - parseFloat(createdOrder.costs.total)}*\n
                go here to confirm: https://www.theprintful.com/dashboard/default`);
            resolve(data);
        })
        .catch(reject);
});