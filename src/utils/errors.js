import log from '../log';
import say from './slack';

export default function dumpError(err) {
    // Log via winston
    log.error(err)
    let {stage, error, meta, data} = err;
    if (error && typeof error != 'string') error = JSON.stringify(error);
    if (meta && typeof meta != 'string') meta = JSON.stringify(meta);
    if (data && typeof data != 'string') data = JSON.stringify(data);

    // Log via slack
    say(`:fire::fire::computer::fire::fire: error in stage: *${stage}* \nwith content: \n\`*${error}\` \nand meta \n\`${meta}\`\nand data \n\`${data}\``);
    //if (typeof err === 'object') {
    //    if (err.message) {
    //        log.error('\nMessage: ' + err.message)
    //    }
    //    if (err.stack) {
    //        log.error('\nStacktrace:')
    //        log.error('====================')
    //        log.error(err.stack);
    //    }
    //} else {
    //    log.warn('dumpError :: argument is not an object, it is a: ', typeof err);
    //    log.error(err);
    //}
}