'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.sendPrintGeneratedEmail = undefined;

var _log = require('../log');

var _log2 = _interopRequireDefault(_log);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var helper = require('sendgrid').mail; // import Sendgrid from 'sendgrid';
// import log from '../log';

// const sendgrid = Sendgrid(process.env.SENDGRID_USERNAME, process.env.SENDGRID_PASSWORD);

// const from = 'victories@mtnlab.io';

// export const sendPrintGeneratedEmail = (to, printFileUrl) => new Promise((resolve, reject) => {

// 	log.info(`Sending print generated email to <${to}> with print file URL: ${printFileUrl}`);

// 	sendgrid.send({
// 		to,
// 		from,
// 		subject: 'Check out your new Victories print!',
// 		message: `
// 			Thanks for ordering a Victories print!

// 			We're currently printing your rides, and your print will be in the mail in 1-2 days.

// 			In the meantime, we thought you might like a copy of your super-high-resolution print file. You can view/download your print file here:

// 			${printFileUrl}

// 			Enjoy your Victories!

// 			- Alonso and Matt
// 			@victoriesco
// 		`
// 	}, (err, json) => {
// 		if (err) {
// 			log.error(err);
// 			reject(err);
// 			return;
// 		}
// 		log.info(json);
// 		resolve(json);
// 	})

// });

// import { mail, SendGrid } from 'sendgrid';

var sg = require('sendgrid').SendGrid(process.env.SENDGRID_API_KEY);

var from = new helper.Email('victories@mtnlab.io', 'Victories');

var sendPrintGeneratedEmail = exports.sendPrintGeneratedEmail = function sendPrintGeneratedEmail(toEmail, printFileUrl) {
	return new Promise(function (resolve, reject) {

		_log2.default.info('Sending print generated email to <' + toEmail + '> with print file URL: ' + printFileUrl);

		var to = new helper.Email(toEmail);
		var subject = 'Check out your new Victories print!';

		var message = new helper.Mail(from, subject, to, { type: 'text/html', value: 'test' }, process.env.SENDGRID_API_KEY);
		// console.info('got this far!', message);
		message.setReplyTo(from);
		message.setTemplateId('84a8a740-fd22-4b36-b84a-b350add22103');

		var printUrl = new helper.Substitution('%print-url%', printFileUrl);
		message.getPersonalizations()[0].addSubstitution(printUrl);

		var request = sg.emptyRequest();
		request.method = 'POST';
		request.path = '/v3/mail/send';
		request.body = message.toJSON();
		sg.API(request, function (res) {
			_log2.default.info('got sendgrid response', res.statusCode, res.body);
			if (res.statusCode == 202) {
				resolve();
			} else {
				reject(res.body);
			}
		});
	});
};

// sendPrintGeneratedEmail('siralonsoholmes@gmail.com', 'https://stravalicious.s3.amazonaws.com/8657205-preview-1464752676002.png').catch(console.error)