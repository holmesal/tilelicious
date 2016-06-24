import {API_KEY, ENDPOINT} from './utils/printful';
import log from './log';
import proxy from 'express-http-proxy';
import express from 'express';
import bodyParser from 'body-parser';
import url from 'url';
import {handleWebhook} from './utils/printful';

let app = express();

app.use('/printful-proxy', proxy(ENDPOINT, {

    filter: (req, res) => {
        let path = url.parse(req.url).path;
        //log.info(path);
        if (path === '/' ||
            path === '/tax/rates' ||
            path === '/countries' ||
            path === '/shipping/rates') {
            return true
        } else {
            return false
        }
    },

    forwardPath: (req, res) => url.parse(req.url).path,

    intercept: (rsp, data, req, res, callback) => {
        res.set('Access-Control-Allow-Origin', `*`);
        callback(null, data);
    },

    decorateRequest: (req, res) => {
        req.headers['Authorization'] = `Basic ${API_KEY}`;
        return req;
    }

}));

app.use(bodyParser.json());

app.get('/', (req, res) => res.send('hiiiii'));

app.post('/printful-hooks', (req, res) => {
    console.info(req)
    handleWebhook(req.body)
        .then(() => res.end('ok'))
        .catch((err) => {
            log.error('error handing webhook', err);
            res.status(500).send('oh shit.');
        })
});


let port = process.env.PORT || 5000;

let server = app.listen(port, () => log.info(`server running at http://${server.address().address}:${server.address().port}`));