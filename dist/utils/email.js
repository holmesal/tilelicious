'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.sendPrintShippedEmail = exports.sendPrintGeneratedEmail = undefined;

var _log = require('../log');

var _log2 = _interopRequireDefault(_log);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var helper = require('sendgrid').mail;

var sg = require('sendgrid').SendGrid(process.env.SENDGRID_API_KEY);

var from = new helper.Email('victories@mtnlab.io', 'Victories');

var sendMessage = function sendMessage(message) {
	return new Promise(function (resolve, reject) {
		var request = sg.emptyRequest();
		request.method = 'POST';
		request.path = '/v3/mail/send';
		request.body = message.toJSON();
		sg.API(request, function (res) {
			_log2.default.info('got sendgrid response', res.statusCode, res.body);
			if (res.statusCode == 202) {
				resolve({ code: res.statusCode, body: res.body });
			} else {
				reject(res.body);
			}
		});
	});
};

var sendPrintGeneratedEmail = exports.sendPrintGeneratedEmail = function sendPrintGeneratedEmail(toEmail, printFileUrl, orderNumber) {
	_log2.default.info('Sending print generated email to <' + toEmail + '> with print file URL: ' + printFileUrl);

	var to = new helper.Email(toEmail);
	var subject = 'Check out your new Victories print!';

	var message = new helper.Mail(from, subject, to, { type: 'text/html', value: 'test' }, process.env.SENDGRID_API_KEY);
	message.setReplyTo(from);
	message.setTemplateId('84a8a740-fd22-4b36-b84a-b350add22103');

	var printSub = new helper.Substitution('%print-url%', printFileUrl);
	message.getPersonalizations()[0].addSubstitution(printSub);

	var orderNumberSub = new helper.Substitution('%order-number%', orderNumber);
	message.getPersonalizations()[0].addSubstitution(orderNumberSub);

	return sendMessage(message);
};

var sendPrintShippedEmail = exports.sendPrintShippedEmail = function sendPrintShippedEmail(toEmail, trackingUrl, orderNumber) {
	return new Promise(function (resolve, reject) {
		_log2.default.info('Sending print shipped generated email to <' + toEmail + '> with tracking URL: ' + trackingUrl);

		var to = new helper.Email(toEmail);
		var subject = 'Your Victories print is in the mail!';

		var message = new helper.Mail(from, subject, to, { type: 'text/html', value: 'test' }, process.env.SENDGRID_API_KEY);
		message.setReplyTo(from);
		message.setTemplateId('87dc1d21-e718-41f7-8a40-287eb6859607');

		var trackingSub = new helper.Substitution('%tracking-url%', trackingUrl);
		message.getPersonalizations()[0].addSubstitution(trackingSub);

		var orderNumberSub = new helper.Substitution('%order-number%', orderNumber);
		message.getPersonalizations()[0].addSubstitution(orderNumberSub);

		return sendMessage(message);
	});
};