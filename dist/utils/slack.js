'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = say;

var _superagent = require('superagent');

var _superagent2 = _interopRequireDefault(_superagent);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var webhookUrl = process.env.SLACK_WEBHOOK_URL;
// import {RtmClient, CLIENT_EVENTS, MemoryDataStore} from '@slack/client';
function say(message) {
  var sendToMainChannel = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

  var json = {
    text: message
  };

  if (sendToMainChannel) json.channel = '#victories';

  _superagent2.default.post(webhookUrl).send(json).then(function (res) {
    log.verbose(pre + 'slack responded: ', res);
  }).catch(function (err) {
    log.error('error posting message in slack', err);
  });
}

var message = ':sun_with_face: new *' + (process.env.NODE_ENV === 'production' ? 'Production' : 'Development') + '* Victories server started!';
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