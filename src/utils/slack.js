
import {RtmClient, CLIENT_EVENTS, MemoryDataStore} from '@slack/client';

const token = process.env.SLACK_TOKEN;
import log from '../log';

console.info(`slack token: ${token}`)

const rtm = new RtmClient(token, {
	// Sets the level of logging we require
  logLevel: 'error',
  dataStore: new MemoryDataStore(),
  // Boolean indicating whether Slack should automatically reconnect after an error response
  autoReconnect: true,
  // Boolean indicating whether each message should be marked as read or not after it is processed
  autoMark: true
});

const channelName = 'stravahooks';
let stravahooksChannel = null;

rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, function (rtmStartData) {
	console.log(`Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name}, but not yet connected to a channel`);
	stravahooksChannel = rtm.dataStore.getChannelOrGroupByName('stravahooks');
});

// you need to wait for the client to fully connect before you can send messages
rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function () {
  // This will send the message 'this is a test message' to the channel identified by id 'C0CHZA86Q'
  rtm.sendMessage('> blinks, confused, as sunlight streams onto his face for the first time in ages. what world is this?', stravahooksChannel.id, function messageSent() {
  	console.info('send wakup message!')
    // optionally, you can supply a callback to execute once the message has been sent
  });
});

rtm.start();

export default function say(message) {
    rtm.sendMessage(message, stravahooksChannel.id);
}