import http from 'http';

http.createServer((req, res) => {
    res.end('ello ello!');
}).listen(process.env.PORT || 5000);