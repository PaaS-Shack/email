

"use strict";

const { Context } = require("moleculer");
const DbService = require("db-mixin");
const ConfigLoader = require("config-mixin");
const { MoleculerClientError } = require("moleculer").Errors;

const crypto = require('crypto');
const { createWriteStream, createReadStream } = require('fs');


module.exports = {
    name: "emails.fs-store",
    version: 1,

    mixins: [
        ConfigLoader([
            "emails.**",
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
            "emails.fs-store.tempDir": "/tmp",
            "emails.fs-store.storeDir": "/store",
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
         * store message stream in fs store folder
         * 
         * @param {Object} envelope - message envelope
         * @param {ReadableStream} stream - message stream
         * 
         * @returns {Promise} - 
         */
        storeMessageStream(envelope, stream) {
            return new Promise(async (resolve, reject) => {
                try {
                    // create tmp file
                    const tmpFile = await this.writeStreamToTmpFile(stream);

                    // move tmp file to store dir
                    const storeFile = `${this.config['emails.fs-store.storeDir']}/${envelope.id}.eml`;
                    await this.moveFile(tmpFile, storeFile);

                    // resolve to store file
                    resolve(storeFile);
                } catch (error) {
                    reject(error);
                }
            });
        },

        /**
         * get message stream from fs store
         * 
         * @param {Object} envelope - message envelope
         * 
         * @returns {Promise}
         */
        getMessageStream(envelope) {
            return new Promise(async (resolve, reject) => {
                try {
                    const storeFile = `${this.config['emails.fs-store.storeDir']}/${envelope.id}.eml`;
                    const stream = createReadStream(storeFile);
                    resolve(stream);
                } catch (error) {
                    reject(error);
                }
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
            const tmpFile = `${this.config['emails.fs-store.tempDir']}/${crypto.randomBytes(16).toString('hex')}.eml`;

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

        /**
         * move file
         * 
         * @param {String} source - source file path
         * @param {String} target - target file path
         * 
         * @returns {Promise}
         */
        moveFile(source, target) {
            return new Promise((resolve, reject) => {
                fs.rename(source, target, function (err) {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                });
            });
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
        
    },

    /**
     * Service stopped lifecycle event handler
     */
    stopped() {

    }
};