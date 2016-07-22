'use strict';

Object.defineProperty(exports, "__esModule", {
		value: true
});

var _dot = require('dot');

var _dot2 = _interopRequireDefault(_dot);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = _dot2.default.template('\n<html>\n  <head>\n\t<meta name="twitter:card" content="summary_large_image">\n\t<meta name="twitter:site" content="@victoriesco">\n\t<meta name="twitter:title" content="Victories">\n\t<meta name="twitter:description" content="Beautiful prints from your Strava data.">\n\t<meta name="twitter:image" content="http://goo.gl/{{=it.shortlinkId}}">\n\t<meta name="twitter:image:alt" content="A beautiful print.">\n\n\t<meta property="og:url" content="http://prints.victories.co/{{=it.shortlinkId}}">\n\t<meta property="og:image" content="http://goo.gl/{{=it.shortlinkId}}">\n\t<meta property="og:image:width" content="1080">\n\t<meta property="og:image:height" content="1080">\n\t<meta property="og:title" content="Victories">\n\t<meta property="og:site_name" content="Victories">\n\t<meta property="fb:app_id" content="1743873725835324">\n\t<meta property="og:description" content="Beautiful prints from your Strava data.">\n  </head>\n  <body>\n    <img src="http://goo.gl/{{=it.shortlinkId}}" />\n  </body>\n</html>\n');