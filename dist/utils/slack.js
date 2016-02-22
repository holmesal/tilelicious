'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = say;

var _slackClient = require('slack-client');

var _slackClient2 = _interopRequireDefault(_slackClient);

var _log = require('../log');

var _log2 = _interopRequireDefault(_log);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var token = 'xoxb-16055557347-ekxqLUz7ye081QxFRp9wCLSC';
var autoReconnect = true;
var autoMark = true;

var slack = new _slackClient2.default(token, autoReconnect, autoMark);

slack.on('open', function () {
    _log2.default.info('slack opened!');
    //log.info(slack.channels);
});

slack.on('error', _log2.default.error);

slack.login();

function say(message) {
    var channel = slack.getChannelGroupOrDMByName('stravahooks');
    if (!channel) {
        console.error('slack integration is broken!!!');
        return false;
    }
    channel.send(message);
}