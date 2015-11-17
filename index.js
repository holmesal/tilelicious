import Canvas, {Image} from 'canvas';
import fs from 'fs';
import request from 'superagent';
import geoViewport from 'geo-viewport';

let dims = {
    w: 3508,
    h: 2480
};

let BORDER = 50;

// Maximum static map size, from mapbox
let MAX_SIZE = {
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
let bbox = [
    -122.347269,
    37.77621,
    -122.217321,
    37.837513
];

let canvas = new Canvas(dims.w, dims.h);

let ctx = canvas.getContext('2d');

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
let render = () => {
    // Render out to a png
    let out = fs.createWriteStream(__dirname + '/test.png');
    let stream = canvas.pngStream();

    stream.on('data', function(chunk){
        out.write(chunk);
    });

    stream.on('end', function(){
        console.log('saved png');
    });
};

let fetchMapboxImages = () => {
    console.log('bbox', bbox);
    // How many images should we fetch from mapbox?
    let numCols = Math.ceil(dims.w / MAX_SIZE.w);
    let numRows = Math.ceil(dims.h / MAX_SIZE.h);
    // How much lat/lng should each image be responsible for?
    let intervals = {
        lon: (bbox[2] - bbox[0]) / numCols,
        lat: (bbox[3] - bbox[1]) / numRows,
        pixelsX: dims.w / numCols,
        pixelsY: dims.h / numRows
    };
    // Request one image for each range
    console.log(`fetching ${numCols} x ${numRows} images`)
    for (let x = 0; x < numCols; x++) {
        for (let y = 0; y < numRows; y++) {
            // W-S-E-N
            let bounds = [
                bbox[0] + intervals.lon * x, //minlon
                bbox[1] + intervals.lat * y,
                bbox[0] + intervals.lon * (x + 1),
                bbox[1] + intervals.lat * (y + 1)
            ];
            // Pixel bounds
            let pixels = [
                Math.round(intervals.pixelsX * x),
                Math.round(intervals.pixelsY * y),
                Math.round(intervals.pixelsX * (x + 1)),
                Math.round(intervals.pixelsY * (y + 1))
            ];
            let size = [
                pixels[2] - pixels[0],
                pixels[3] - pixels[1]
            ];
            // Calculate center and zoom
            let viewport = geoViewport.viewport(bounds, size);
            console.log(x, y);
            console.log(bounds);
            console.log(pixels);
            console.log(size);
            console.info(viewport);
            console.log('\n\n --- \n\n');

            let mapboxTile = new ImageFetcher(viewport, pixels, size);
        }
    }
};


class ImageFetcher {

    constructor(viewport, pos, size) {
        console.info('rendering tile at ' + pos)
        console.info(viewport)
        //this.dims = dims;
        let url = `https://api.mapbox.com/v4/mapbox.streets/${viewport.center[0]},${viewport.center[1]},${viewport.zoom}/${size[0]}x${size[1]}.png?access_token=pk.eyJ1Ijoic2lyYWxvbnNvIiwiYSI6IkEwdTNZcG8ifQ.Nunkow8Nopb-zUFDlvqciQ`;
        console.log(url)
        this.fetchImage(url, pos);
    }

    fetchImage(url, pos) {
        request.get(url)
            .end((err, res) => {
                if (err) {
                    console.error(err);
                }
                console.log(res.body);
                let img = new Image;
                img.src = res.body;
                ctx.drawImage(img, pos[0], pos[1]);
                //ctx.drawImage(img, 0, 0, 100, 100);
            //    //img = new Image;
            //    img.src = canvas.toBuffer();
            //    ctx.drawImage(img, 100, 100, 50, 50);
            //    ctx.drawImage(img, 200, 100, 50, 50);
                render()
            })
    }

}

fetchMapboxImages();