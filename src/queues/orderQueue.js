import {orderQueueRef, ordersRef, rejectedChargesRef, completedOrdersRef} from '../utils/fb';
import Queue from 'firebase-queue';
import Stripe from 'stripe';
import generatePrint from './ImageGenerationQueue';
import {sendPrintGeneratedEmail} from '../utils/email';
import {getItem, createOrder} from '../utils/printful';
import say from '../utils/slack';
import log from '../log';

let specs = {
    chargeCard: 'CHARGE_CARD',
    generatePrint: 'GENERATE_PRINT',
    createOrder: 'CREATE_ORDER',
    sendPrintGeneratedEmail: 'SEND_PRINT_GENERATED_EMAIL',
    storeCompletedOrder: 'STORE_COMPLETED_ORDER'
};

let STRIPE_LIVE_KEY = process.env.STRIPE_LIVE_KEY;
let STRIPE_TEST_KEY = process.env.STRIPE_TEST_KEY;

log.info('order queue up and running!');

let chargeCardQueue = new Queue(orderQueueRef, {specId: specs.chargeCard}, (data, progress, resolve, reject) => {
    log.info('got new order item, id='+data.stripe.id);
    log.info(JSON.stringify(data));
    // First off, store this order somewhere permanent
    let orderRef = ordersRef.child(data.stripe.id);
    orderRef.set(data);

    // Live or test?
    let stripe;
    if (data.stripe.livemode)
    {
        console.info('using LIVE stripe key!');
        stripe = Stripe(STRIPE_LIVE_KEY);
    } else
    {
        console.info('using TEST stripe key!');
        stripe = Stripe(STRIPE_TEST_KEY);
    }

    // Attempt to charge this user's card via stripe
    stripe.charges.create({
        amount: data.order.costs.total,
        currency: 'usd',
        source: data.stripe.id,
        description: 'Charge for Victories print',
        receipt_email: data.stripe.email
    }, (err, charge) => {
        if (err) {
            log.error(err);
            let rejectedChargeRef = rejectedChargesRef.child(data.stripe.id);
            rejectedChargeRef.set(err.raw);
            reject(err);
        } else {
            log.info('charge succeeded...');
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

// Send an email to notify the user that their print has been generated
let sendPrintGeneratedEmailQueue = new Queue(orderQueueRef, {specId: specs.sendPrintGeneratedEmail}, (data, progress, resolve, reject) => {
    // where should this image be stored?
    let printFileUrl = data.generatedImage;
    let customerEmail = data.createdOrder.recipient.email;
    sendPrintGeneratedEmail(customerEmail, printFileUrl, data.createdOrder.external_id)
        .then((sendgridResponse) => {
            data.printGeneratedEmailSendgridResponse = sendgridResponse;
            resolve(data);
        })
        .catch(reject)
});

// Store the completed order somewhere for future reference
let storeCompletedOrderQueue = new Queue(orderQueueRef, {specId: specs.storeCompletedOrder}, (data, progress, resolve, reject) => {
    completedOrdersRef.child(data.stripe.id).set(data);
    resolve();
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
            log.info('successfully created printful order');
            let orderRef = ordersRef.child(data.stripe.id);
            orderRef.update(data);
            // Post to slack
            const chargeUrl = `https://dashboard.stripe.com/${data.charge.livemode ? '' : 'test/'}payments/${data.charge.id}`;
            say(`
            :printer::moneybag: new order for *${createdOrder.recipient.name}* in *${createdOrder.recipient.city}, ${createdOrder.recipient.country_name}* submitted to printful!\n
                cost: ${createdOrder.costs.total}    retail: ${createdOrder.retail_costs.total}    *profit: ${parseFloat(createdOrder.retail_costs.total) - parseFloat(createdOrder.costs.total)}*\n
                :mag: Go here to check the print image for issues: <${data.generatedImage}>\n
                :flag-ng: Then, go here to make sure the card charge succeeded <${chargeUrl}>
                :truck: Finally, go here to ship order \`${data.stripe.id}\`: <https://www.theprintful.com/dashboard/default>
            `, true);
            resolve(data);
        })
        .catch(reject);
});