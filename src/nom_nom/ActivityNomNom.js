import strava from 'strava-v3';
import _ from 'lodash';
import {userRef, userActivityRef, activityNomNomQueueRef} from '../utils/fb';
import StreamNomNom from './StreamNomNom';
import Queue from 'firebase-queue';

const PER_PAGE = 200;

class ActivityNomNom {

    constructor(uid, resolve, reject) {
        this.uid = uid;
        this.resolve = resolve;
        this.reject = reject;

        this.userActivityRef = userActivityRef(uid);

        // Fetch the token to use with this request
        console.info('fetching token for ', this.uid)
        userRef(this.uid).child('access_token').once('value', (snap) => {
            let token = snap.val();
            console.info('got token, ', token);
            if (!token) {
                reject('could not find this user token, got: ' + token);
            } else {
                this.access_token = token;
                // Immediately fetch activities
                this.fetchActivities();
            }
        });

    }

    fetchActivities(page = 1) {
        console.info(`fetching activities page ${page} for athlete ${this.uid}`);
        strava.athlete.listActivities({
            per_page: PER_PAGE,
            page: page,
            id: this.uid,
            access_token: this.access_token
        }, (err, res) => {
            if (err || res.errors) {
                this.reject(JSON.stringify(res));
                console.error(err, res);
            } else {
                let activities = res;
                if (activities.length > 0) {
                    console.info(`got ${activities.length} activities, starting with id: ${activities[0].id}`);
                    // Save these activities to firebase
                    this.pushActivitiesToFirebase(activities);
                    if (activities.length === PER_PAGE) {
                        let nextPage = page + 1;
                        console.info('page is ', page, ' next page is ', nextPage);
                        this.fetchActivities(page + 1);
                    } else {
                        console.info('done fetching activities');
                        this.resolve();
                    }
                } else {
                    console.info(`user ${this.uid} had no activities`);
                }
            }
        });
    }

    pushActivitiesToFirebase(activities) {
        _.forEach(activities, (activity) => {
            activity.created = Date.now();
            this.userActivityRef.child(activity.id).set(_.pick(activity,
                'id',
                'created',
                'start_latlng',
                'end_latlng',
                'location_city',
                'location_country',
                'location_state',
                'type',
                'athlete'
            ));

            // DANGER - uncomment this line to pull in stream data for all of these activities
            //new StreamNomNom(this.uid, activity.id)
        })
    }
}

console.info('activityNomNom queue up and running');

let queue = new Queue(activityNomNomQueueRef, (data, progress, resolve, reject) => {
    console.info('activityNomNomQueue running for user: ', data.uid);
    let activity = new ActivityNomNom(data.uid, resolve, reject);
});