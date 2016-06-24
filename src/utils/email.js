import log from '../log';

const helper = require('sendgrid').mail;

const sg = require('sendgrid').SendGrid(process.env.SENDGRID_API_KEY);

let from = new helper.Email('victories@mtnlab.io', 'Victories');

const sendMessage = message => new Promise((resolve, reject) => {
	let request = sg.emptyRequest();
	request.method = 'POST';
	request.path = '/v3/mail/send';
	request.body = message.toJSON();
	sg.API(request, (res) => {
		log.info('got sendgrid response', res.statusCode, res.body);
		if (res.statusCode == 202) {
			resolve({code: res.statusCode, body: res.body});
		} else {
			reject(res.body);
		}
	})
});

export const sendPrintGeneratedEmail = (toEmail, printFileUrl, orderNumber) => {
	log.info(`Sending print generated email to <${toEmail}> with print file URL: ${printFileUrl}`);

	const to = new helper.Email(toEmail);
	const subject = 'Check out your new Victories print!';

	let message = new helper.Mail(from, subject, to, {type: 'text/html', value: 'test'}, process.env.SENDGRID_API_KEY);
	message.setReplyTo(from);
	message.setTemplateId('84a8a740-fd22-4b36-b84a-b350add22103');

	const printSub = new helper.Substitution('%print-url%', printFileUrl);
	message.getPersonalizations()[0].addSubstitution(printSub);

	const orderNumberSub = new helper.Substitution('%order-number%', orderNumber);
	message.getPersonalizations()[0].addSubstitution(orderNumberSub);

	return sendMessage(message)
};

export const sendPrintShippedEmail = (toEmail, trackingUrl, orderNumber) => new Promise((resolve, reject) => {
	log.info(`Sending print shipped generated email to <${toEmail}> with tracking URL: ${trackingUrl}`);

	const to = new helper.Email(toEmail);
	const subject = 'Your Victories print is in the mail!';

	let message = new helper.Mail(from, subject, to, {type: 'text/html', value: 'test'}, process.env.SENDGRID_API_KEY);
	message.setReplyTo(from);
	message.setTemplateId('87dc1d21-e718-41f7-8a40-287eb6859607');

	const trackingSub = new helper.Substitution('%tracking-url%', trackingUrl);
	message.getPersonalizations()[0].addSubstitution(trackingSub);

	const orderNumberSub = new helper.Substitution('%order-number%', orderNumber);
	message.getPersonalizations()[0].addSubstitution(orderNumberSub);

	return sendMessage(message);
});