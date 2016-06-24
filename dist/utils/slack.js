'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = say;

var _client = require('@slack/client');

var _log = require('../log');

var _log2 = _interopRequireDefault(_log);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var token = process.env.SLACK_TOKEN;

console.info('slack token: ' + token);

var rtm = new _client.RtmClient(token, {
  // Sets the level of logging we require
  logLevel: 'error',
  dataStore: new _client.MemoryDataStore(),
  // Boolean indicating whether Slack should automatically reconnect after an error response
  autoReconnect: true,
  // Boolean indicating whether each message should be marked as read or not after it is processed
  autoMark: true
});

var channelName = 'stravahooks';
var stravahooksChannel = null;

var hasSentWakeup = false;

rtm.on(_client.CLIENT_EVENTS.RTM.AUTHENTICATED, function (rtmStartData) {
  console.log('Logged in as ' + rtmStartData.self.name + ' of team ' + rtmStartData.team.name + ', but not yet connected to a channel');
  stravahooksChannel = rtm.dataStore.getChannelOrGroupByName('stravahooks');
});

// you need to wait for the client to fully connect before you can send messages
rtm.on(_client.CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function () {
  console.info('slack connection opened!');
  if (!hasSentWakeup) {
    var message = ':sun_with_face: new *' + (process.env.NODE_ENV === 'production' ? 'Production' : 'Development') + '* Victories server started!';
    if (process.env.WORKER) message += '\n :robot_face: It\'s a worker!';
    say(message);
    rtm.sendMessage(message, stravahooksChannel.id, function messageSent() {
      console.info('sent slack wakeup message!');
      // optionally, you can supply a callback to execute once the message has been sent
    });
    hasSentWakeup = true;
  }
});

rtm.start();

function say(message) {
  try {
    rtm.sendMessage(message, stravahooksChannel.id);
  } catch (err) {
    _log2.default.error('error posting message in slack', err);
  }
}