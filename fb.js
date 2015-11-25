import Firebase from 'firebase';

const FIREBASE_URL = 'https://stravalicious.firebaseio.com';

export const rootRef = new Firebase(FIREBASE_URL);

export const userRef = (uuid) => {
    return rootRef.child(`users/${uuid}`);
};

export const userActivityRef = (uuid) => rootRef.child(`activityByUser/${uuid}`);

export const activityStreamRef = (activityId) => rootRef.child(`streamByActivity/${activityId}`);

