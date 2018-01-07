
// import {RtmClient, CLIENT_EVENTS, MemoryDataStore} from '@slack/client';
import request from 'superagent';
import log from '../log';

const webhookUrl = process.env.SLACK_WEBHOOK_URL;

export default function say(message, sendToMainChannel=false) {
  try {
    let json = {
        text: message
    };

    if (sendToMainChannel) json.channel = '#victories';

    request.post(webhookUrl)
    .send(json)
    .end((err, res) => {
        if (err) {
            log.error('error posting message in slack', err);
            log.info('response text: ', res.text);
            log.info('message text: ', message);
            log.info('stringified body: ', JSON.stringify(json));
        } else {
            log.info('message text: ', message);
            log.info('stringified body: ', JSON.stringify(json));
            log.info('slack responded: ', res.text);
        }
    });
  } catch(err) {
    log.error('error posting message in slack', err);
  }
}

let message = `:sun_with_face: new *${process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}* Victories server started!`;
if (process.env.WORKER) message += '\n :robot_face: It\'s a worker!';
say(message);

// const token = process.env.SLACK_TOKEN;
// import log from '../log';

// console.info(`slack token: ${token}`)

// const rtm = new RtmClient(token, {
// 	// Sets the level of logging we require
//   logLevel: 'error',
//   dataStore: new MemoryDataStore(),
//   // Boolean indicating whether Slack should automatically reconnect after an error response
//   autoReconnect: true,
//   // Boolean indicating whether each message should be marked as read or not after it is processed
//   autoMark: true
// });

// let mainChannel = null;
// let hooksChannel = null;

// let hasSentWakeup = false;

// rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, function (rtmStartData) {
// 	console.log(`Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name}, but not yet connected to a channel`);
// 	hooksChannel = rtm.dataStore.getChannelOrGroupByName('victories-hooks');
// 	mainChannel = rtm.dataStore.getChannelOrGroupByName('victories');
// });

// // you need to wait for the client to fully connect before you can send messages
// rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function () {
//   console.info('slack connection opened!');
//   if (!hasSentWakeup) {
//     let message = `:sun_with_face: new *${process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}* Victories server started!`;
//     if (process.env.WORKER) message += '\n :robot_face: It\'s a worker!';
//     say(message);
//     rtm.sendMessage(message, hooksChannel.id, function messageSent() {
//       console.info('sent slack wakeup message!');
//       // optionally, you can supply a callback to execute once the message has been sent
//     });
//     hasSentWakeup = true;
//   }
// });

// rtm.start();

// export default function say(message, sendToMainChannel=false) {
//     try {
//       rtm.sendMessage(message, hooksChannel.id);
//       if (sendToMainChannel) rtm.sendMessage(message, mainChannel.id);
//     } catch(err) {
//       log.error('error posting message in slack', err);
//     }
// }