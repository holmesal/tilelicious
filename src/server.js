import http from 'http';
import httpProxy from 'http-proxy';

let API_KEY = new Buffer('0gkrd0lh-sijv-7xjo:y2al-e81r2lfuzmh6').toString('base64');
let PRINTFUL_API = 'http://api.theprintful.com';
console.info(API_KEY);

let proxy = httpProxy.createProxyServer({
    //auth: `Basic ${API_KEY}`
});

proxy.on('proxyReq', (proxyReq, req, res, options) => {
    proxyReq.setHeader('Authorization', `Basic ${API_KEY}`);
    //proxyReq.setHeader('Content-Type', null)
    console.info(req.headers)
    console.info(req.body)
});

proxy.on('proxyRes', (proxyRes, req, res) => {
    console.info(res.headers)
    proxyRes.headers['Access-Control-Allow-Origin'] = `*`;
});

http.createServer((req, res) => {
    //res.end('ello ello!');
    proxy.web(req, res, {
        target: PRINTFUL_API
    })
}).listen(process.env.PORT || 5000);