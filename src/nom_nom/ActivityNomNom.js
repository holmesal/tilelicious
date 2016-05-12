import strava from 'strava-v3';
import _ from 'lodash';
import {userRef, userActivityRef, activityNomNomQueueRef} from '../utils/fb';
import StreamNomNom from './StreamNomNom';
import Queue from 'firebase-queue';
import log from '../log';
import slack from '../utils/slack';

const PER_PAGE = 200;

class ActivityNomNom {

    constructor(uid, resolve, reject, taskId) {
        this.uid = uid;
        this.resolve = resolve;
        this.reject = reject;
        this.taskId = taskId;

        this.userActivityRef = userActivityRef(uid);

        // Fetch the token to use with this request
        log.info('fetching token for ', this.uid)
        userRef(this.uid).child('access_token').once('value', (snap) => {
            let token = snap.val();
            log.info('got token, ', token);
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
        log.info(`fetching activities page ${page} for athlete ${this.uid}`);
        strava.athlete.listActivities({
            per_page: PER_PAGE,
            page: page,
            id: this.uid,
            access_token: this.access_token
        }, (err, res) => {
            if (err || res.errors) {
                const rej = JSON.stringify({
                    error: err,
                    response: res,
                    activityId: this.activityId,
                    uid: this.uid
                });
                this.reject(rej);
                log.error(err, res, rej);
                slack(`*Error fetching activities*\n\`${rej}\`\n${activityNomNomQueueRef.child('tasks').child(this.taskId).toString()}`)
            } else {
                let activities = res;
                if (activities.length > 0) {
                    log.info(`got ${activities.length} activities, starting with id: ${activities[0].id}`);
                    // Save these activities to firebase
                    this.pushActivitiesToFirebase(activities);
                    if (activities.length === PER_PAGE) {
                        let nextPage = page + 1;
                        log.info('page is ', page, ' next page is ', nextPage);
                        this.fetchActivities(page + 1);
                    } else {
                        log.info('done fetching activities');
                        this.resolve();
                    }
                } else {
                    log.info(`user ${this.uid} had no activities`);
                    this.resolve();
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

log.info('activityNomNom queue up and running');

let queue = new Queue(activityNomNomQueueRef, {sanitize: false}, (data, progress, resolve, reject) => {
    log.info('activityNomNomQueue running for user: ', data.uid);
    let activity = new ActivityNomNom(data.uid, resolve, reject, data._id);
});