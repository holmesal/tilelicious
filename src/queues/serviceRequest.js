import {serviceRequestQueueRef, serviceRequestsRef} from '../utils/fb';
import Queue from 'firebase-queue';
import log from '../log';
import slug from 'slug';
import _ from 'lodash';
import say from '../utils/slack';

log.info('service request queue up and running!');

const sayTotals = (service, totals) => {
    let text = `vote cast for *${service}*! Totals are now:`;
    let sorted = _.sortBy(_.map(totals, (votes, name) => ({votes, name})), 'votes').reverse();
    //log.info(sorted);
    sorted.forEach((item) => text += `\n    *${item.votes}*  ${item.name}`);
    //log.info(text);
    say(text);
};

let queue = new Queue(serviceRequestQueueRef, (data, progress, resolve, reject) => {
    // Get & slugify the service name
    let service = slug(data.service);
    // Make a ref
    let serviceCountRef = serviceRequestsRef.child(service);
    // Increment said ref in a transaction
    serviceCountRef.transaction((current) => (current || 0) + 1, (error, committed, snap) => {
        if (error) {
            log.error(error);
            reject(error);
        } else {
            // Get the current counts
            serviceRequestsRef.once('value', (snap) => {
                //log.info(snap.val());
                sayTotals(service, snap.val());
                resolve();
            });
        }
    })
});