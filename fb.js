import Firebase from 'firebase';

const FIREBASE_URL = 'https://stravalicious.firebaseio.com';

export const rootRef = new Firebase(FIREBASE_URL);

/**
 * Queues
 */

export const queueRootRef = rootRef.child('queues');

export const tokenExchangeQueueRef = queueRootRef.child('tokenExchange');

export const activityNomNomQueueRef = queueRootRef.child('activityNomNom');


/**
 * Firebase locations
 */
export const uidByCodeRef = (code) => rootRef.child(`uidByCode/${code}`);

export const userRef = (uid) => rootRef.child(`users/${uid}`);

export const userActivityRef = (uuid) => rootRef.child(`activityByUser/${uuid}`);

export const activityStreamRef = (activityId) => rootRef.child(`streamByActivity/${activityId}`);

// uncomment to DESTROY
//rootRef.child('streamByActivity').set(null);