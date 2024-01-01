

"use strict";

const { Context } = require("moleculer");
const DbService = require("db-mixin");
const ConfigLoader = require("config-mixin");
const { MoleculerClientError } = require("moleculer").Errors;

/**
 * molecularjs outbound email transfer agent 
 * it is a rewrite of zone-mta/lib/smtp-interface.js
 * 
 * 
 * 
 */

const Minio = require("minio");
const crypto = require('crypto');
const { createWriteStream, createReadStream } = require('fs');
const { v4: uuidv4 } = require('uuid');

/**
 * maildrop mixin
 * taken from zone-mta/blob/master/lib/mail-drop.js
 * 
 * will use s3 to store message streams
 *  
 */


module.exports = {
    name: "emails.s3-store",
    version: 1,

    mixins: [
        ConfigLoader([
            "s3.**",
        ]),
    ],

    /**
     * Service dependencies
     */
    dependencies: [],

    /**
     * Service settings
     */
    settings: {
        config: {
            's3.endPoint': 'play.min.io',
            's3.port': 9000,
            's3.useSSL': true,
            's3.accessKey': 'Q3AM3UQ867SPQQA43P2F',
            's3.secretKey': 'zuf+tfteSlswRu7BJ86wekitnifILbZam1KYY3TG',
            's3.tempDir': '/tmp',
        }
    },

    /**
     * Actions
     */
    actions: {

    },

    /**
     * Events
     */
    events: {

    },

    /**
     * Methods
     */
    methods: {
        /**
         * store message stream in s3
         * 
         * @param {ReadableStream} stream - message stream
         * 
         * @returns {Promise} - resolves to s3 object
         */
        storeMessageStream(stream) {
            const bucket = this.config['emails.s3.bucket'] || 'emails';
            const name = `${uuidv4()}.eml`;

            const metadata = {
                'Content-Type': 'message/rfc822',
            };

            return new Promise((resolve, reject) => {
                // put object
                this.s3.putObject(bucket, name, stream, null, metadata, (err, res) => {
                    if (err) {
                        return reject(err);
                    }
                    const etag = res.etag;
                    // get object size
                    this.s3.statObject(bucket, name, (err, res) => {
                        if (err) {
                            return reject(err);
                        }

                        return resolve({
                            bucket,
                            name,
                            etag,
                            size: res.size,
                        });
                    });
                });
            });
        },

        /**
         * get message stream from s3
         * 
         * @param {Object} envelope - message envelope
         * 
         * @returns {Promise} - resolves to s3 object
         */
        getMessageStream(envelope) {

            const key = envelope.key;
            const bucket = envelope.bucket;
            const name = `${key}.eml`;

            return new Promise((resolve, reject) => {

                this.s3.getObject(bucket, name, function (err, stream) {
                    if (err) {
                        return reject(err);
                    }

                    return resolve(stream);
                });
            });
        },

        /**
         * write stream to tmp file
         * 
         * @param {Stream} stream - stream to write
         * 
         * @returns {Promise} - resolves to tmp file path
         */
        async writeStreamToTmpFile(stream) {
            // create tmp file
            let tmpFile = null;
            if (this.config['s3.tempDir']) {
                tmpFile = `${this.config['s3.tempDir']}/${crypto.randomBytes(16).toString('hex')}.eml`;
            } else {
                tmpFile = `/tmp/${crypto.randomBytes(16).toString('hex')}.eml`;
            }

            const writeStream = createWriteStream(tmpFile);

            // write stream to tmp file
            stream.pipe(writeStream);

            // wait for stream to finish
            await new Promise((resolve, reject) => {
                stream.on('end', resolve);
                stream.on('error', reject);
            });

            // return tmp file path
            return tmpFile;
        },
    },

    /**
     * Service created lifecycle event handler
     */
    created() { },

    /**
     * Service started lifecycle event handler
     */
    started() {
        this.s3 = new Minio.Client({
            endPoint: this.config['s3.endpoint'],
            port: this.config['s3.port'],
            useSSL: this.config['s3.useSSL'],
            accessKey: this.config['s3.accessKey'],
            secretKey: this.config['s3.secretKey']
        });
    },

    /**
     * Service stopped lifecycle event handler
     */
    stopped() {

    }
};