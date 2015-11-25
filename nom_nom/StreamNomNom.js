import strava from 'strava-v3';
import _ from 'lodash';
import {activityStreamRef, userActivityRef} from './../fb';

const PER_PAGE = 200;

export default class StreamNomNom {

    constructor(uuid, activityId) {
        this.uuid = uuid;
        this.activityId = activityId;
        let that = this;
        // Only fetch this stream if it doesn't exist in firebase
        activityStreamRef(activityId).once('value', (snap) => {
            if (snap.val()) {
                console.info('not fetching stream, it is already loaded')
            } else {
                console.info('fetching stream: ', activityId);
                that.fetchStream()
            }
        });
    }

    fetchStream() {
        console.info('fetching stream for ', this.activityId);
        strava.streams.activity({
            id: this.activityId,
            types: 'latlng',
            resolution: 'high'
        }, (err, stream) => {
            if (err) {
                console.error(err)
            } else {
                let latlng = _.findWhere(stream, {type: 'latlng'});
                console.info(stream)
                if (latlng) {
                    this.pushStreamToFirebase(latlng);
                }
            }
        })
    }

    pushStreamToFirebase(stream) {
        // Store this stream
        activityStreamRef(this.activityId).set(stream);
        // Mark this activity as loaded
        userActivityRef(this.uuid).child(this.activityId).update({
            streamLoaded: true
        });
    }
}

//let test = new StreamNomNom('8657205', '330487627');