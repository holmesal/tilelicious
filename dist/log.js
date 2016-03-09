'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _winston = require('winston');

var _winston2 = _interopRequireDefault(_winston);

var _winstonLogentries = require('winston-logentries');

var _winstonLogentries2 = _interopRequireDefault(_winstonLogentries);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var SlackLogger = function (_winston$Transport) {
    _inherits(SlackLogger, _winston$Transport);

    function SlackLogger() {
        var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

        _classCallCheck(this, SlackLogger);

        var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(SlackLogger).call(this, options));

        _this.name = 'SlackLogger';
        _this.level = options.level || 'error';
        return _this;
    }

    _createClass(SlackLogger, [{
        key: 'log',
        value: function log(level, message, meta, callback) {
            console.info('slackLogger called with: ', message);
            //console.info(JSON.stringify(message));
            callback(null, true);
        }
    }]);

    return SlackLogger;
}(_winston2.default.Transport);

var logger = new _winston2.default.Logger({
    transports: [new _winston2.default.transports.Console(), new _winston2.default.transports.Logentries({ token: '17ed1c11-f58e-4a6e-8bed-c71d3c6de45b' })]
});

//new SlackLogger()
logger.on('error', function (error) {
    console.info('winston logged error!');
});

exports.default = logger;