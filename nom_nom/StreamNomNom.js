import strava from 'strava-v3';
import _ from 'lodash';
import {activityStreamRef} from './../fb';

const PER_PAGE = 200;

class StreamNomNom {

    constructor(uuid, activityId) {

        this.activityId = activityId;

        this.fetchStream(activityId);

    }

    fetchStream(activityId) {

        strava.streams.activity({
            id: activityId,
            types: 'latlng',
            resolution: 'high'
        }, (err, stream) => {
            if (err) {
                console.error(err)
            } else {
                let latlng = _.findWhere(stream, {type: 'latlng'});
                console.info(latlng);
                this.pushStreamToFirebase(latlng);
            }
        })
    }

    pushStreamToFirebase(stream) {
        activityStreamRef(this.activityId).set(stream)
    }
}

let test = new StreamNomNom('8657205', '330487627');