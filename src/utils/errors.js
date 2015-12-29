import log from '../log';

export default function dumpError(err) {
    if (typeof err === 'object') {
        if (err.message) {
            log.error('\nMessage: ' + err.message)
        }
        if (err.stack) {
            log.error('\nStacktrace:')
            log.error('====================')
            log.error(err.stack);
        }
    } else {
        log.error('dumpError :: argument is not an object');
    }
}