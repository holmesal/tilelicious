export const API_KEY = new Buffer(process.env.PRINTFUL_API_KEY).toString('base64');
export const ENDPOINT = 'http://api.theprintful.com';
import request from 'superagent';
import say from './slack';
import log from '../log';

export const items = {
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

export const getItem = (size, framed) => {
    let framedString = framed ? 'framed' : 'unframed';
    return items[size][framedString];
};

export const createOrder = (order) => {
    return new Promise((resolve, reject) => {
        request.post(`${ENDPOINT}/orders`)
            .send(order)
            .set('Authorization', `Basic ${API_KEY}`)
            .end((err, res) => {
                if (err) {
                    log.info(err);
                    reject(err);
                } else {
                    log.info(res.body);
                    resolve(res.body.result);
                }
            })
    });
};

export const handleWebhook = (body) => {
    return new Promise((resolve, reject) => {
        log.info('got webhook!', body);
        if (body.type === 'package_shipped') {
            say(`:package::truck::airplane_departure: package shipped via *${body.shipment.carrier}+${body.shipment.service}* from printful!\n
                en route to *${body.order.recipient.name}* in *${body.order.recipient.city}, ${body.order.recipient.state_name}, ${body.order.recipient.country_name}*\n
                track this package: ${body.shipment.tracking_url}`);
        } else if (body.type === 'order_failed') {
            say(`:cry::poop: order failed for reason *${body.data.reason}*\n
                you should probably go here and fix shit: https://www.theprintful.com/dashboard/default`);
        } else if (body.type === 'order_canceled') {
            say(`:japanese_ogre: an order to *${body.order.recipient.name}* was cancelled. I sure hope this was intentional`);
        } else {
            reject();
        }
        resolve();
    });
};