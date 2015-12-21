import {API_KEY, ENDPOINT} from './utils/printful';

import proxy from 'express-http-proxy';
import express from 'express';
import url from 'url';
import {handleWebhook} from './utils/printful';

let app = express();

app.use('/printful-proxy', proxy(ENDPOINT, {

    forwardPath: (req, res) => url.parse(req.url).path,

    intercept: (rsp, data, req, res, callback) => {
        res.headers['Access-Control-Allow-Origin'] = `*`;
        callback(data);
    },

    decorateRequest: (req, res) => {
        req.headers['Authorization'] = `Basic ${API_KEY}`;
        return req;
    }

}));

app.get('/', (req, res) => res.send('hiiiii'));

app.post('/printful-hooks', (req, res) => {
    handleWebhook(req.body)
        .then(() => res.end('ok'))
        .catch((err) => res.status(500).send('oh shit.'))
});


let port = process.env.PORT || 5000;

let server = app.listen(port, () => console.info(`server running at http://${server.address().address}:${server.address().port}`));