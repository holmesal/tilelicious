
import Slack from 'slack-client';

let token = 'xoxb-16055557347-5cIM6NSz9WRZe75c7WVy3dqP';
let autoReconnect = true;
let autoMark = true;

let slack = new Slack(token, autoReconnect, autoMark);

slack.on('open', () => {
    console.info('slack opened!');
    //console.info(slack.channels);
});

slack.on('error', console.error);

slack.login();

export default function say(message) {
    let channel = slack.getChannelGroupOrDMByName('stravahooks');
    channel.send(message);
}