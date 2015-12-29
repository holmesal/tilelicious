import winston from 'winston';
import Logentries from 'winston-logentries';

let logger = new winston.Logger({
    transports: [
        new winston.transports.Console(),
        new winston.transports.Logentries({token: '17ed1c11-f58e-4a6e-8bed-c71d3c6de45b'})
    ]
});

export default logger;