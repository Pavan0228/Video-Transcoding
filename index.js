import { ReceiveMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { S3Event } from "aws-lambda";
import dotenv from "dotenv";

dotenv.config({
    path: "./.env"
});

const client = new SQSClient({ region: "ap-south-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});



async function init() {
    const commend = new ReceiveMessageCommand({
        QueueUrl: process.env.SQS_QUEUE_URL,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20
    })

    while(true) {
        const { Messages } = await client.send(commend);
        if(!Messages) {
            console.log("No messages to process");
            continue;
        }

        try {
            for(const message of Messages) {
                const { MessageId , Body } = message;
                console.log("MessageId: ", MessageId , "\nBody: ", Body);
    
    
                if(!Body) {
                    continue;
                }
    
                //vaildate the message
                const s3Event = JSON.parse(Body);

                // check if the event is a test event
                if("Service" in s3Event && "Event" in s3Event) {
                    if(s3Event.Event === "s3:TestEvent") {
                        continue;
                    }
                }

                for(const record of s3Event.Records) {
                    const { s3 } = record;
                    const { bucket, object: {key} } = s3;
                    
                    //spin up a container to process the message
                    
                }
                //delete the message 
    
            }
        } catch (error) {
            console.error("Error processing message: ", error);
            
        }
    } 
}


init().catch(console.error);