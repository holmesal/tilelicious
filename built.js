'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _canvas = require('canvas');

var _canvas2 = _interopRequireDefault(_canvas);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _superagent = require('superagent');

var _superagent2 = _interopRequireDefault(_superagent);

var _geoViewport = require('geo-viewport');

var _geoViewport2 = _interopRequireDefault(_geoViewport);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var dims = {
    w: 3508,
    h: 2480
};

var BORDER = 50;

// Maximum static map size, from mapbox
var MAX_SIZE = {
    w: 640,
    h: 640
};

//// Example
//let focus = {
//    center: [-122.2708, 37.8044],
//    zoom: 14
//};
//let bbox = geoViewport.bounds(focus.center, focus.zoom, [dims.w, dims.h]);

// W-S-E-N
var bbox = [-122.347269, 37.77621, -122.217321, 37.837513];

var canvas = new _canvas2.default(dims.w, dims.h);

var ctx = canvas.getContext('2d');

//ctx.font = '10px Arial';
//ctx.rotate(.1);
//ctx.fillText("Awesome!", 0, 100);

//var te = ctx.measureText('Awesome!');
//ctx.strokeStyle = 'rgba(0,0,0,0.5)';
//ctx.beginPath();
//ctx.lineTo(50, 102);
//ctx.lineTo(50 + te.width, 102);
//ctx.stroke();

// Draw the white background
ctx.rect(0, 0, dims.w, dims.h);
ctx.fillStyle = 'white';
ctx.fill();

// Render the mapbox tiles
var render = function render() {
    // Render out to a png
    var out = _fs2.default.createWriteStream(__dirname + '/test.png');
    var stream = canvas.pngStream();

    stream.on('data', function (chunk) {
        out.write(chunk);
    });

    stream.on('end', function () {
        console.log('saved png');
    });
};

var fetchMapboxImages = function fetchMapboxImages() {
    console.log('bbox', bbox);
    // How many images should we fetch from mapbox?
    var numCols = Math.ceil(dims.w / MAX_SIZE.w);
    var numRows = Math.ceil(dims.h / MAX_SIZE.h);
    // How much lat/lng should each image be responsible for?
    var intervals = {
        lon: (bbox[2] - bbox[0]) / numCols,
        lat: (bbox[3] - bbox[1]) / numRows,
        pixelsX: dims.w / numCols,
        pixelsY: dims.h / numRows
    };
    // Request one image for each range
    console.log('fetching ' + numCols + ' x ' + numRows + ' images');
    for (var x = 0; x < numCols; x++) {
        for (var y = 0; y < numRows; y++) {
            // W-S-E-N
            var bounds = [bbox[0] + intervals.lon * x, //minlon
            bbox[1] + intervals.lat * y, bbox[0] + intervals.lon * (x + 1), bbox[1] + intervals.lat * (y + 1)];
            // Pixel bounds
            var pixels = [Math.round(intervals.pixelsX * x), Math.round(intervals.pixelsY * y), Math.round(intervals.pixelsX * (x + 1)), Math.round(intervals.pixelsY * (y + 1))];
            var size = [pixels[2] - pixels[0], pixels[3] - pixels[1]];
            // Calculate center and zoom
            var viewport = _geoViewport2.default.viewport(bounds, size);
            console.log(x, y);
            console.log(bounds);
            console.log(pixels);
            console.log(size);
            console.info(viewport);
            console.log('\n\n --- \n\n');

            var mapboxTile = new ImageFetcher(viewport, pixels, size);
        }
    }
};

var ImageFetcher = (function () {
    function ImageFetcher(viewport, pos, size) {
        _classCallCheck(this, ImageFetcher);

        console.info('rendering tile at ' + pos);
        console.info(viewport);
        //this.dims = dims;
        var url = 'https://api.mapbox.com/v4/mapbox.streets/' + viewport.center[0] + ',' + viewport.center[1] + ',' + viewport.zoom + '/' + size[0] + 'x' + size[1] + '.png?access_token=pk.eyJ1Ijoic2lyYWxvbnNvIiwiYSI6IkEwdTNZcG8ifQ.Nunkow8Nopb-zUFDlvqciQ';
        console.log(url);
        this.fetchImage(url, pos);
    }

    _createClass(ImageFetcher, [{
        key: 'fetchImage',
        value: function fetchImage(url, pos) {
            _superagent2.default.get(url).end(function (err, res) {
                if (err) {
                    console.error(err);
                }
                console.log(res.body);
                var img = new _canvas.Image();
                img.src = res.body;
                ctx.drawImage(img, pos[0], pos[1]);
                //ctx.drawImage(img, 0, 0, 100, 100);
                //    //img = new Image;
                //    img.src = canvas.toBuffer();
                //    ctx.drawImage(img, 100, 100, 50, 50);
                //    ctx.drawImage(img, 200, 100, 50, 50);
                render();
            });
        }
    }]);

    return ImageFetcher;
})();

fetchMapboxImages();
