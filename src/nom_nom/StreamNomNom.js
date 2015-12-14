import strava from 'strava-v3';
import _ from 'lodash';
import {activityStreamRef, userActivityRef, streamNomNomQueueRef} from '../utils/fb';
import Queue from 'firebase-queue';
import geojson from 'geojson';

const PER_PAGE = 200;

export default class StreamNomNom {

    constructor(uid, activityId, resolve, reject) {
        this.uid = uid;
        this.activityId = activityId;
        this.resolve = resolve;
        this.reject = reject;
        let that = this;
        // Only fetch this stream if it doesn't exist in firebase
        activityStreamRef(activityId).child('hasData').once('value', (snap) => {
            if (snap.val()) {
                console.info('not fetching stream, it is already loaded')
            } else {
                console.info('fetching stream: ', activityId);
                that.fetchStream()
            }
        });
    }

    fetchStream() {
        strava.streams.activity({
            id: this.activityId,
            types: 'latlng',
            resolution: 'medium'
        }, (err, stream) => {
            if (err) {
                console.error(err);
                this.reject(err);
            } else {
                let latlng = _.findWhere(stream, {type: 'latlng'});
                //console.info(stream);
                if (latlng) {
                    latlng.geojson = this.convertStreamToGeoJSON(latlng.data);
                    delete latlng.data;
                    console.info('done fetching stream ', this.activityId);
                    this.pushStreamToFirebase(latlng);
                    this.resolve();
                } else {
                    console.info('no data returned for this stream?');
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

console.info('streamNomNom queue up and running');

let queue = new Queue(streamNomNomQueueRef, (data, progress, resolve, reject) => {
    console.info('streamNomNomQueue running for user: ', data.uid, ' and activity ', data.activityId);
    if (!data.uid || !data.activityId) {
        reject(`something was undefined: activityId: ${data.activityId}   uid: ${data.uid}`);
    } else {
        let stream = new StreamNomNom(data.uid, data.activityId, resolve, reject);
    }
});