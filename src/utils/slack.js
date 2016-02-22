
import Slack from 'slack-client';

let token = 'xoxb-16055557347-5cIM6NSz9WRZe75c7WVy3dqP';
let autoReconnect = true;
let autoMark = true;
import log from '../log';

let slack = new Slack(token, autoReconnect, autoMark);

slack.on('open', () => {
    log.info('slack opened!');
    //log.info(slack.channels);
});

slack.on('error', log.error);

slack.login();

export default function say(message) {
    let channel = slack.getChannelGroupOrDMByName('stravahooks');
    if (!channel) {
        console.error('slack integration is broken!!!');
        return false;
    }
    channel.send(message);
}