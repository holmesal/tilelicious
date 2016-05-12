import strava from 'strava-v3';
import _ from 'lodash';
import {activityStreamRef, userRef, userActivityRef, streamNomNomQueueRef} from '../utils/fb';
import Queue from 'firebase-queue';
import geojson from 'geojson';
import log from '../log';

const FORCE_REFETCH = true;


export default class StreamNomNom {

    constructor(uid, activityId, resolve, reject) {
        this.uid = uid;
        this.activityId = activityId;
        this.resolve = resolve;
        this.reject = reject;
        let that = this;
        // Only fetch this stream if it doesn't exist in firebase
        activityStreamRef(activityId).child('hasData').once('value', (snap) => {
            if (snap.val() && !FORCE_REFETCH) {
                log.info('not fetching stream, it is already loaded')
            } else {
                log.info('fetching stream: ', activityId);
                // Fetch the token to use with this request
                log.info('fetching token for ', this.uid)
                userRef(this.uid).child('access_token').once('value', (snap) => {
                    let token = snap.val();
                    log.info('got token, ', token);
                    if (!token) {
                        reject('could not find this user token, got: ' + token);
                    } else {
                        this.access_token = token;
                        this.fetchStream()
                    }
                });
            }
        });
    }

    fetchStream() {
        strava.streams.activity({
            id: this.activityId,
            types: 'latlng',
            resolution: 'medium',
            // access_token: this.access_token
        }, (err, stream) => {
            if (err) {
                log.error(err);
                this.reject(err);
            } else {
                let latlng = _.findWhere(stream, {type: 'latlng'});
                //log.info(stream);
                if (latlng) {
                    latlng.geojson = this.convertStreamToGeoJSON(latlng.data);
                    delete latlng.data;
                    log.info('done fetching stream ', this.activityId);
                    this.pushStreamToFirebase(latlng);
                    this.resolve();
                } else {
                    // TODO - remove the stream activity from firebase in this case, so the loading can at least finish and the image generation doesn't error out later...
                    log.info('no data returned for this stream?');
                    log.info(stream);
                    this.reject(err);
                }
            }
        })
    }

    convertStreamToGeoJSON(stream) {
        let inverted = _.map(stream, (point) => [point[1], point[0]]);
        let shape = [{
            line: inverted
        }];
        let features = geojson.parse(shape, {LineString: 'line'});
        return features;
    }

    pushStreamToFirebase(stream) {
        // Store this stream
        activityStreamRef(this.activityId).set(stream);
        // Mark this activity as loaded
        userActivityRef(this.uid).child(this.activityId).update({
            streamLoaded: true
        });
    }
}

//let test = new StreamNomNom('8657205', '330487627');

log.info('streamNomNom queue up and running');

let queue = new Queue(streamNomNomQueueRef, (data, progress, resolve, reject) => {
    log.info('streamNomNomQueue running for user: ', data.uid, ' and activity ', data.activityId);
    if (!data.uid || !data.activityId) {
        reject(`something was undefined: activityId: ${data.activityId}   uid: ${data.uid}`);
    } else {
        let stream = new StreamNomNom(data.uid, data.activityId, resolve, reject);
    }
});