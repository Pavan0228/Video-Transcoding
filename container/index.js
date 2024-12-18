import {
    GetObjectCommand,
    S3Client,
    PutObjectCommand,
} from "@aws-sdk/client-s3";
import fs from "node:fs/promises";
import fsold from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import ffmpeg from "fluent-ffmpeg";

import { fileURLToPath } from 'url';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const RESOLUTIONS = [
    { name: "360p", width: 640, height: 360 },
    { name: "480p", width: 854, height: 480 },
    { name: "720p", width: 1280, height: 720 },
    { name: "1080p", width: 1920, height: 1080 },
];

dotenv.config({
    path: "./.env",
});

// Create an S3 client service object
const s3Client = new S3Client({
    region: "ap-south-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

async function downloadS3Object(bucket, key) {
    try {
        const command = new GetObjectCommand({
            Bucket: bucket,
            Key: key,
        });

        const response = await s3Client.send(command);
        const filePath = path.resolve(__dirname, 'original-video.mp4');

        // Stream the object to a file
        const writeStream = fsold.createWriteStream(filePath);
        response.Body.pipe(writeStream);

        return new Promise((resolve, reject) => {
            writeStream.on('finish', () => resolve(filePath));
            writeStream.on('error', reject);
        });
    } catch (error) {
        console.error('Error downloading S3 object:', error);
        throw error;
    }
}


async function transcodeVideo(inputPath, resolution) {
    return new Promise((resolve, reject) => {
        const outputFilePath = path.resolve(__dirname, `${resolution.name}-video.mp4`);
        
        ffmpeg(inputPath)
            .output(outputFilePath)
            .size(`${resolution.width}x${resolution.height}`)
            .videoCodec("libx264")
            .audioCodec("aac")
            .on("end", () => resolve(outputFilePath))
            .on("error", (err) => reject(err))
            .format("mp4")
            .run();
    });
}

async function uploadToS3(filePath, bucket, key) {
    try {
        const putCommand = new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: fsold.createReadStream(filePath),
        });

        await s3Client.send(putCommand);
        console.log(`Uploaded ${key} to ${bucket}`);
    } catch (error) {
        console.error('Error uploading to S3:', error);
        throw error;
    }
}

async function cleanupTempFiles(filePaths) {
    for (const filePath of filePaths) {
        try {
            await fs.unlink(filePath);
        } catch (error) {
            console.warn(`Could not delete temp file ${filePath}:`, error);
        }
    }
}

async function main() {
    const tempFiles = [];

    try {
        // Download original video
        const originalVideoPath = await downloadS3Object(
            process.env.BUCKET, 
            process.env.KEY
        );
        tempFiles.push(originalVideoPath);

        // Transcode and upload
        const uploadPromises = RESOLUTIONS.map(async (resolution) => {
            try {
                // Transcode video
                const transcodedVideoPath = await transcodeVideo(originalVideoPath, resolution);
                tempFiles.push(transcodedVideoPath);

                const fileName = process.env.KEY.replace(/\//g, "-")
                // Upload to S3
                await uploadToS3(
                    transcodedVideoPath, 
                    process.env.BUCKET_NAME, 
                    `transcoder/${resolution.name}-${fileName}`
                );
            } catch (error) {
                console.error(`Error processing ${resolution.name}:`, error);
                throw error;
            }
        });

        await Promise.all(uploadPromises);
    } catch (error) {
        console.error('Transcoding process failed:', error);
    } finally {
        // Always attempt to clean up temp files
        await cleanupTempFiles(tempFiles);
        process.exit(0);
    }
}

main();