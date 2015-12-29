'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = streamToS3;

var _awsSdk = require('aws-sdk');

var _awsSdk2 = _interopRequireDefault(_awsSdk);

var _s3UploadStream = require('s3-upload-stream');

var _s3UploadStream2 = _interopRequireDefault(_s3UploadStream);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _log = require('../log');

var _log2 = _interopRequireDefault(_log);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var BUCKET_NAME = 'stravalicious';

// New S3
var s3Stream = (0, _s3UploadStream2.default)(new _awsSdk2.default.S3());

function streamToS3(stream, key, metadata) {

    return new Promise(function (resolve, reject) {
        var upload = s3Stream.upload({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType: 'image/png',
            Metadata: metadata
        });

        // Handle errors.
        upload.on('error', function (error) {
            _log2.default.error(error);
            reject(error);
        });

        /* Handle progress. Example details object:
         { ETag: '"f9ef956c83756a80ad62f54ae5e7d34b"',
         PartNumber: 5,
         receivedSize: 29671068,
         uploadedSize: 29671068 }
         */
        upload.on('part', function (details) {
            _log2.default.info('s3 upload progress', details);
        });

        /* Handle upload completion. Example details object:
         { Location: 'https://bucketName.s3.amazonaws.com/filename.ext',
         Bucket: 'bucketName',
         Key: 'filename.ext',
         ETag: '"bf2acbedf84207d696c8da7dbb205b9f-5"' }
         */
        upload.on('uploaded', function (details) {
            _log2.default.info('s3 upload complete', details);
            resolve(details);
        });

        stream.pipe(upload);
    });
}