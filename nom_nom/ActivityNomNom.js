import strava from 'strava-v3';
import _ from 'lodash';
import {userRef, userActivityRef} from './../fb';
import StreamNomNom from './StreamNomNom';

const PER_PAGE = 200;

let syncActivities = (uuid) => {
    // TODO - fetch auth token for this actual user

    fetchActivities(uuid);

    //strava.athlete.listActivities({
    //    //per_page: 1,
    //    //page: 2
    //}, (err, rides) => {
    //    if (err) console.error(err);
    //    console.info(rides);
    //    console.info(rides.length);
    //    //let ride = rides[0];
    //
    //    //userRef()
    //
    //
    //    //console.info(ride);
    //
    //    //strava.streams.activity({
    //    //    id: '330487627',
    //    //    types: 'latlng',
    //    //    resolution: 'high'
    //    //}, (err, stream) => {
    //    //    if (err) console.error(err);
    //    //    //console.info(stream);
    //    //    let latlng = _.findWhere(stream, {type: 'latlng'});
    //    //    console.info(latlng)
    //    //})
    //});
};

class ActivityNomNom {

    constructor(uuid) {
        this.uuid = uuid;

        this.userActivityRef = userActivityRef(uuid);

        // Immediately fetch activities
        this.fetchActivities();
    }

    fetchActivities(page = 1) {
        console.info('fetching activities page ' + page);
        strava.athlete.listActivities({
            per_page: PER_PAGE,
            page: page
        }, (err, activities) => {
            console.info(`got ${activities.length} activities, starting with id: ${activities[0].id}`);
            // Save these activities to firebase
            this.pushActivitiesToFirebase(activities);
            if (activities.length === PER_PAGE) {
                let nextPage = page + 1;
                console.info('page is ', page, ' next page is ', nextPage);
                this.fetchActivities(page + 1);
            } else {
                console.info('done fetching activities')
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
            new StreamNomNom(this.uuid, activity.id)
        })
    }
}

let me = new ActivityNomNom('8657205');