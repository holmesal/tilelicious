'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = say;

var _slackClient = require('slack-client');

var _slackClient2 = _interopRequireDefault(_slackClient);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var token = 'xoxb-16055557347-5cIM6NSz9WRZe75c7WVy3dqP';
var autoReconnect = true;
var autoMark = true;

var slack = new _slackClient2.default(token, autoReconnect, autoMark);

slack.on('open', function () {
    console.info('slack opened!');
    //console.info(slack.channels);
});

slack.on('error', console.error);

slack.login();

function say(message) {
    var channel = slack.getChannelGroupOrDMByName('stravahooks');
    channel.send(message);
}