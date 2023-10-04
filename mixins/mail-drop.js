

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

const MailParser = require('mailparser').MailParser;

const SMTPServer = require('smtp-server').SMTPServer;
const fs = require('fs');
const os = require('os');
const isemail = require('isemail');


const addressTools = require('../lib/address-tools');

/**
 * maildrop mixin
 * taken from zone-mta/blob/master/lib/mail-drop.js
 * 
 * will use s3 to store message streams
 *  
 */


module.exports = {
    name: "emails.maildrop",
    version: 1,

    mixins: [

    ],

    /**
     * Service dependencies
     */
    dependencies: [],

    /**
     * Service settings
     */
    settings: {

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
         * maid drop add
         * 
         * @param {*} envelope 
         * @param {*} source 
         * @param {*} callback 
         */
        async mailDropAdd(envelope, source, callback) {

            let id = envelope.id;

            let messageHashStream = new StreamHash({
                algo: 'md5'
            });

            source.pipe(messageHashStream);
            source.once('error', err => {
                messageHashStream.emit('error', err);
            });

            messageHashStream.on('hash', async (data) => {
                await this.broker.call('v1.emails.envlope.update', {
                    id: id,
                    sourceMd5: data.hash
                });
            });


            // store stream to s3
            await this.storeMessage(envelope, messageHashStream);

            
        },

        /**
         * add default headers
         * 
         * @param {*} envelope
         * @param {*} messageInfo
         * @param {*} headers
         */
        addDefaultHeaders(envelope, messageInfo) {
            // Fetch sender and receiver addresses
            envelope.parsedEnvelope = {
                from: addressTools.parseAddressList(envelope.headers, 'from').shift() || false,
                to: addressTools.parseAddressList(envelope.headers, 'to'),
                cc: addressTools.parseAddressList(envelope.headers, 'cc'),
                bcc: addressTools.parseAddressList(envelope.headers, 'bcc'),
                replyTo: addressTools.parseAddressList(envelope.headers, 'reply-to').shift() || false,
                sender: addressTools.parseAddressList(envelope.headers, 'sender').shift() || false
            };

            if (envelope.envelopeFromHeader) {
                envelope.from = envelope.parsedEnvelope.from || envelope.parsedEnvelope.sender || '';
                envelope.to = []
                    .concat(envelope.parsedEnvelope.to || [])
                    .concat(envelope.parsedEnvelope.cc || [])
                    .concat(envelope.parsedEnvelope.bcc || []);
            }

            // Check Message-ID: value. Add if missing
            let mId = envelope.headers.getFirst('message-id');
            if (!mId) {
                mId = '<' + uuid.v4() + '@' + (envelope.from.substr(envelope.from.lastIndexOf('@') + 1) || hostname) + '>';
                if (addMissing.includes('message-id')) {
                    envelope.headers.remove('message-id'); // in case there's an empty value
                    envelope.headers.add('Message-ID', mId);
                }
            }
            envelope.messageId = mId;
            messageInfo['message-id'] = envelope.messageId;

            // Check Sending Zone for this message
            //   X-Sending-Zone: loopback
            // If Sending Zone is not set or missing then the default is used
            if (!envelope.sendingZone && this.config['emails.maildrop.allowRoutingHeaders'].includes(envelope.interface)) {
                let sZone = envelope.headers.getFirst('x-sending-zone').toLowerCase();
                if (sZone) {
                    this.logger.info('Queue', 'Detected Zone %s for %s by headers', sZone, mId);
                    envelope.sendingZone = sZone;
                }
            }

            // Check Date: value. Add if missing or invalid or future date
            let date = envelope.headers.getFirst('date');
            let dateVal = new Date(date);
            if (!date || dateVal.toString() === 'Invalid Date' || dateVal < new Date(1000)) {
                date = new Date().toUTCString().replace(/GMT/, '+0000');
                if (addMissing.includes('date')) {
                    envelope.headers.remove('date'); // remove old empty or invalid values
                    envelope.headers.add('Date', date);
                }
            }

            // Check if Date header indicates a time in the future (+/- 300s clock skew is allowed)
            if (this.config['emails.maildrop.futureDate'] && date && dateVal.toString() !== 'Invalid Date' && dateVal.getTime() > Date.now() + 5 * 60 * 1000) {
                // The date is in the future, defer the message. Max defer time is 1 year
                envelope.deferDelivery = Math.min(dateVal.getTime(), Date.now() + 365 * 24 * 3600 * 1000);
            }

            envelope.date = date;

            // Fetch X-FBL header for bounce tracking
            let xFbl = envelope.headers.getFirst('x-fbl').trim();
            if (xFbl) {
                envelope.fbl = xFbl;
            }

            if (this.config['emails.maildrop.xOriginatingIP'] && envelope.origin && !['127.0.0.1', '::1'].includes(envelope.origin)) {
                envelope.headers.update('X-Originating-IP', '[' + envelope.origin + ']');
            }

            // Remove sending-zone routing key if present
            envelope.headers.remove('x-sending-zone');

            // Remove BCC if present
            envelope.headers.remove('bcc');

            if (!envelope.sendingZone) {
                let sZone = sendingZone.findByHeaders(envelope.headers);
                if (sZone) {
                    this.logger.info('Queue', 'Detected Zone %s for %s by headers', sZone, mId);
                    envelope.sendingZone = sZone;
                }
            }
        }
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