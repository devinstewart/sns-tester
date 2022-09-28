'use strict';

const Hapi = require('@hapi/hapi');
const AWS = require('aws-sdk');
const Validator = require('sns-payload-validator');
const Https = require('https');
const { pushGithubMessage ,getSnsTopicArn } = require('./lib');
const Fs = require('fs');

const SNS = new AWS.SNS({ 'region': 'us-east-1' });

const init = async (start = false) => {

    const server = Hapi.server({
        port: 3000,
        host: '0.0.0.0'
    });

    server.route([
        {
            method: 'POST',
            path: '/',
            handler: async (request, h) => {

                try {
                    const { payload } = request;
                    const validPayload = await Validator.validate(payload);
                    if (validPayload.Type === 'SubscriptionConfirmation' || validPayload.Type === 'UnsubscribeConfirmation') {
                        // deepcode ignore Ssrf: <validPayload.SubscribeURL has been sanitized by Validator>
                        Https.get(validPayload.SubscribeURL, (err) => {

                            if (err) {
                                console.error(err);
                                // The route has not been conmfirmed.
                                return h.response('Error confirming subscription').code(400);
                            }

                            // The route has been conmfirmed.
                            return h.response().code(200);
                        });
                    }
                    else {
                        const date = new Date().toISOString();
                        const status = `${date} - ${validPayload.Message}`;
                        pushGithubMessage('status', status);
                        return h.response().code(200);
                    }
                }
                catch (err) {
                    Fs.writeFileSync('error.txt', err.message);
                    const TopicArn = await getSnsTopicArn();
                    await SNS.publish({ TopicArn, Message: 'sns-payload-validator failed' }).promise();
                    return h.response().code(200);
                }
            }
        },
        {
            method: 'POST',
            path: '/sigV2',
            handler: async (request, h) => {

                try {
                    const { payload } = request;
                    const validPayload = await Validator.validate(payload);
                    if (validPayload.Type === 'SubscriptionConfirmation' || validPayload.Type === 'UnsubscribeConfirmation') {
                        // deepcode ignore Ssrf: <validPayload.SubscribeURL has been sanitized by Validator>
                        Https.get(validPayload.SubscribeURL, (err) => {

                            if (err) {
                                console.error(err);
                                // The route has not been conmfirmed.
                                return h.response('Error confirming subscription').code(400);
                            }

                            // The route has been conmfirmed.
                            return h.response().code(200);
                        });
                    }
                    else {
                        const date = new Date().toISOString();
                        const status = `${date} - ${validPayload.Message}`;
                        pushGithubMessage('status-sigV2', status);
                        return h.response().code(200);
                    }
                }
                catch (err) {
                    Fs.writeFileSync('error-sigV2.txt', err.message);
                    const TopicArn = await getSnsTopicArn();
                    await SNS.publish({ TopicArn, Message: 'sns-payload-validator failed' }).promise();
                    return h.response().code(200);
                }
            }
        }
    ]);

    if (start) {
        await server.start();
        console.log({ startup: `Server ${server.version} started at ${server.info.uri}` });
    }

    return server;
};

process.on('unhandledRejection', (err) => {

    console.log(err);
    process.exit(1);
});

if (require.main === module) {
    init(true);
}

init();

module.exports = {
    init
};
