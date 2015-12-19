import {orderQueueRef, ordersRef, rejectedChargesRef} from '../utils/fb';
import Queue from 'firebase-queue';
import Stripe from 'stripe';
import generatePrint from './ImageGenerationQueue';

let specs = {
    chargeCard: 'CHARGE_CARD',
    generatePrint: 'GENERATE_PRINT',
    createOrder: 'CREATE_ORDER'
};

let STRIPE_LIVE_KEY = process.env.STRIPE_LIVE_KEY;
let STRIPE_TEST_KEY = process.env.STRIPE_TEST_KEY;

console.info('stripe test key', JSON.stringify(process.env));

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
    })
});

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