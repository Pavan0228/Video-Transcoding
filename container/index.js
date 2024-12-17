import { GetObjectAclCommand, S3Client, PutObjectCommand } from '@aws-sdk/client-s3' 
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import ffmpeg from 'fluent-ffmpeg';


const RESULATION = [
    {"name": "360p", "width": 640, "height": 360},
    {"name": "480p", "width": 854, "height": 480},
    {"name": "720p", "width": 1280, "height": 720},
    {"name": "1080p", "width": 1920, "height": 1080}
]

dotenv.config({
    path: './.env'
});

// Create an S3 client service object
const s3Client = new S3Client({ region: "ap-south-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});



async function main() {

    //Download the original video
    const command = new GetObjectAclCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: process.env.KEY,
    })

    const results = await s3Client.send(command);

    const originalFilePath = `videos/original-video.mp4`

    await fs.writeFile(originalFilePath, results.Body);

    const originalVideoPath = path.resolve(__dirname, originalFilePath);


    //start the transcoding process

    const promises = RESULATION.map(async (resulation) => {
        return new Promise((resolve) => {
            ffmpeg(originalVideoPath)
            .output(`transcoder/${resulation.name}-video.mp4`)
            .size(`${resulation.width}x${resulation.height}`)
            .videoCodec('libx264')
            .audioCodec('aac')
            .on('end', async function() {
                const putCommend = new PutObjectCommand({
                    Bucket: process.env.BUCKET_NAME,
                    Key: `transcoder/${resulation.name}-video.mp4`,
                })
                await s3Client.send(putCommend);
                console.log(`The transcoded video has been uploaded to the bucket: ${process.env.BUCKET_NAME}`);
                resolve();
            })
            .on('error', function(err) {
                console.log(`An error occurred: ${err.message}`);
            }) 
            .format('mp4')
            .run();
        })
    } )

    await Promise.all(promises);
}

main().finally(() =>process.exit(0));