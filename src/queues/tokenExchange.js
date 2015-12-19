import {tokenExchangeQueueRef, uidByCodeRef, userRef, activityNomNomQueueRef} from '../utils/fb';
import Queue from 'firebase-queue';
import strava from 'strava-v3';

console.info('token exchange queue up and running!');

let queue = new Queue(tokenExchangeQueueRef, (data, progress, resolve, reject) => {
    let code = data.code;
    console.log('exchanging token for', code);
    strava.oauth.getToken(code, (err, res) => {
        if (err || res.errors) {
            reject(JSON.stringify(res));
            console.error(err, res);
        } else {
            console.info('got athlete', res);
            let {access_token, athlete} = res;
            let uid = athlete.id;
            // store access token on the user
            athlete.access_token = access_token;
            // store the athlete
            userRef(uid).set(athlete);
            // Store the code -> uid mapping
            uidByCodeRef(code).set(uid);
            // Immediately fetch athelete data from strava
            activityNomNomQueueRef.child('tasks').push({uid})
            // Done
            resolve();
        }
    });
});