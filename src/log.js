import winston from 'winston';
import Logentries from 'winston-logentries';

class SlackLogger extends winston.Transport {

    constructor(options = {}) {
        super(options);
        this.name = 'SlackLogger';
        this.level = options.level || 'error';
    }

    log(level, message, meta, callback) {
        console.info('slackLogger called with: ', message);
        //console.info(JSON.stringify(message));
        callback(null, true);
    }
}

let logger = new winston.Logger({
    transports: [
        new winston.transports.Console(),
        new winston.transports.Logentries({token: '17ed1c11-f58e-4a6e-8bed-c71d3c6de45b'}),
        //new SlackLogger()
    ]
});

logger.on('error', (error) => {
    console.info('winston logged error!');
});

export default logger;