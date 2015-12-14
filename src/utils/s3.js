
import AWS from 'aws-sdk';
import streamer from 's3-upload-stream';


let BUCKET_NAME = 'stravalicious';

// New S3
let s3Stream = streamer(new AWS.S3());



export default function streamToS3(stream, key) {

    return new Promise((resolve, reject) => {
        let upload = s3Stream.upload({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType : 'image/png'
        });

        // Handle errors.
        upload.on('error', function (error) {
            console.log(error);
            reject(error);
        });

        /* Handle progress. Example details object:
         { ETag: '"f9ef956c83756a80ad62f54ae5e7d34b"',
         PartNumber: 5,
         receivedSize: 29671068,
         uploadedSize: 29671068 }
         */
        upload.on('part', function (details) {
            console.log(details);
        });

        /* Handle upload completion. Example details object:
         { Location: 'https://bucketName.s3.amazonaws.com/filename.ext',
         Bucket: 'bucketName',
         Key: 'filename.ext',
         ETag: '"bf2acbedf84207d696c8da7dbb205b9f-5"' }
         */
        upload.on('uploaded', function (details) {
            console.log(details);
            resolve(details);
        });

        stream.pipe(upload);
    });
}