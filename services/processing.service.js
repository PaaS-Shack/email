const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");

const zlib = require('zlib');
const path = require('path');


const { MoleculerClientError, MoleculerServerError } = require("moleculer").Errors;

const HeaderSplitter = require("../lib/header-splitter");
const { Context } = require("moleculer");

const MailParser = require('mailparser').MailParser;
const { v4: uuidv4 } = require('uuid');

const S3Mixin = require("../mixins/s3-store.mixin");

/**
 * This service has no database.  It is used to process raw emails that are stored in s3.
 * 
 * On envelope created, the raw email is stored in s3 and this service listens for the event.
 */

module.exports = {
    // name of service
    name: "emails.processing",
    // version of service
    version: 2,

    /**
     * Service Mixins
     * 
     * @type {Array}
     * @property {DbService} DbService - Database mixin
     * @property {ConfigLoader} ConfigLoader - Config loader mixin
     */
    mixins: [
        ConfigLoader([
            'emails.**'
        ]),
        S3Mixin
    ],

    /**
     * Service dependencies
     */
    dependencies: [],

    /**
     * Service settings
     * 
     * @type {Object}
     */
    settings: {
        rest: true,

        // default init config settings
        config: {

        }
    },

    /**
     * service actions
     */
    actions: {
        /**
         * check session remoteAddress and clientHostname match though dns lookups
         * 
         * @actions
         * @param {String} id - session id
         * 
         * @returns {Object} - returns session object
         */
        checkSession: {
            params: {
                id: {
                    type: "string",
                    required: true,
                }
            },
            async handler(ctx) {
                const id = ctx.params.id;

                // get session
                const session = await ctx.call("v2.emails.sessions.resolve", { id });

                // check session
                const result = await this.checkSession(ctx, session);

                return result;
            }
        },
        /**
         * process envelope
         * 
         * @actions
         * @param {String} id - envelope id
         * 
         * @returns {Object} - returns email object
         */
        process: {
            params: {
                id: {
                    type: "string",
                    required: true,
                }
            },
            async handler(ctx) {
                const id = ctx.params.id;

                // get envelope
                const envelope = await ctx.call("v2.emails.envelopes.get", { id });

                // process raw email
                const email = await this.process(ctx, envelope);

                return email;
            }
        }
    },

    /**
     * service events
     */
    events: {
        async "emails.envelopes.created"(ctx) {
            const envelope = ctx.params.data;
            this.logger.info(`Envelope created ${envelope.id}`);

            // process raw email
            this.process(ctx, envelope).then(email => {
                this.logger.info(`Email processed ${envelope.id} ${email.id}`);
            }).catch(err => {
                this.logger.error(`Error processing email ${envelope.id}`, err);

            });
        }
    },

    /**
     * service methods
     */
    methods: {
        /**
         * check session remoteAddress and clientHostname match though dns lookups
         * 
         * @param {Object} ctx - moleculer context
         * @param {Object} session - session object
         * 
         * @returns {Promise<Object>} - returns session object
         */
        async checkSession(ctx, session) {
            const remoteAddress = session.remoteAddress;
            const clientHostname = session.clientHostname;

            const valid = {
                session:{
                    id: session.id,
                    remoteAddress: session.remoteAddress,
                    clientHostname: session.clientHostname,
                },
                remoteAddress: true,// remote address is valid
                clientHostname: true,// client hostname is valid
                resolve: null,// client hostname resolve
                reverse: null,// remote address reverse
            };

            // check client hostname starts with "[" and ends with "]"
            if (clientHostname.startsWith("[") && clientHostname.endsWith("]")) {
                valid.clientHostname = false;
                // strip brackets
                valid.resolve = clientHostname.slice(1, -1);
            }


            // check remote address for their hostname
            valid.reverse = await ctx.call("v1.utils.dns.reverse", { ip: remoteAddress })
                .then(result => {
                    return result[0];
                });

            if (valid.reverse !== clientHostname) {
                valid.remoteAddress = false;
            }


            if (valid.clientHostname) {
                // check client hostname for their ip
                valid.resolve = await ctx.call("v1.utils.dns.resolve", { host: clientHostname })
                    .then(result => {
                        return result[0];
                    });

                if (valid.resolve !== remoteAddress) {
                    valid.clientHostname = false;
                }
            }

            return valid;
        },
        /**
         * Process raw email
         * 
         * @param {Object} ctx - moleculer context
         * @param {Object} envelope - envelope object
         * 
         * @returns {Promise<Object>} - returns envelope object
         */
        async process(ctx, envelope) {

            if (envelope.processed) {
                throw new Error(`Envelope already processed ${envelope.id}`);
            }

            const email = {
                envelope: envelope.id,
                attachments: [],
                from: null,
                to: [],
                cc: [],
                bcc: [],
                replyTo: [],
                headers: {},
                subject: '',
                body: '',
                text: '',
                date: '',
            };

            // create parser
            const parser = new MailParser();

            // listen for headers
            parser.on('headers', headers => {
                email.headers = headers;
            });

            parser.on('data', async (data) => {
                if (data.type === 'attachment') {
                    // store attachment in s3
                    await this.processAttachment(ctx, data, envelope)
                        .then(attachment => {
                            email.attachments.push(attachment.id);
                        })
                        .catch(err => {
                            this.logger.error(`Error processing attachment ${data.filename} ${err.message}`);
                        })
                } else if (data.type === 'text') {
                    email.body = data.body;
                    email.text = data.text;
                }

                // release data 
                //data.release();
            });

            // get raw email from s3
            const stream = await this.getMessageStream(envelope);

            // pipe stream to parser
            stream.pipe(parser);

            // wait for parser to finish
            await new Promise((resolve, reject) => {
                parser.on('end', resolve);
                parser.on('error', reject);
            });

            // process addresses
            await this.processAddreses(ctx, email, envelope);
            // process metadata
            await this.processMetadata(ctx, email, envelope);

            // create email entity
            const emailEntity = await ctx.call("v2.emails.create", email);

            // mark envelope as processed
            await ctx.call("v2.emails.envelopes.processed", {
                id: envelope.id
            });

            return emailEntity;
        },

        /**
         * process email metadata
         * 
         * @param {Object} ctx - moleculer context
         * @param {Object} email - email object
         * @param {Object} envelope - envelope object
         * 
         * @returns {Promise<Object>} - returns email object
         */
        async processMetadata(ctx, email, envelope) {
            // process subject
            email.subject = email.headers.get('subject');

            // process date
            email.date = email.headers.get('date');
            // convert date to iso string
            email.date = new Date(email.date);

            // message id
            email.messageId = email.headers.get('message-id');

            this.logger.info(`Processing email metadata ${envelope.id} ${email.messageId}`)
        },

        /**
         * process attachment
         * 
         * @param {Object} ctx - moleculer context
         * @param {Object} attachment - attachment object
         * @param {Object} envelope - envelope object
         * 
         * @returns {Promise<Object>} - returns attachment object
         */
        async processAttachment(ctx, attachment, envelope) {
            // store attachment in s3
            const metadata = await this.storeAttachment(ctx, attachment, envelope);

            // create new attachment entity
            const attachmentEntity = await ctx.call("v2.emails.attachments.create", {
                envelope: envelope.id,
                // email attachment name
                name: attachment.filename,
                // email attachment size
                size: attachment.size,
                // email attachment mime type
                mime: attachment.contentType,
                // email attachment hash
                hash: metadata.etag,
                // email attachment s3 key
                key: metadata.name,
                // email attachment s3 bucket
                bucket: metadata.bucket,
            });

            // add attachment to envelope
            await ctx.call("v2.emails.envelopes.addAttachment", {
                id: envelope.id,
                attachment: attachmentEntity.id,
            });

            this.logger.info(`Processing attachment ${envelope.id} ${attachment.filename}`);

            return attachmentEntity;
        },

        /**
         * store attachment in s3
         * 
         * @param {Context} ctx - moleculer context
         * @param {Object} attachment - attachment object
         * @param {Object} envelope - envelope object
         * 
         * @returns {Promise<Object>} - returns attachment s3 metadata
         */
        async storeAttachment(ctx, attachment, envelope) {
            const bucket = this.config['emails.s3.attachments'] || 'attachments';

            // file extension
            const ext = path.extname(attachment.filename);
            // file name
            const name = `${uuidv4()}${ext}`;
            // mime type
            const contentType = attachment.contentType;

            const metadata = {
                'Content-Type': contentType,
                'x-amz-meta-envelope': envelope.id,
            };

            return new Promise((resolve, reject) => {
                this.s3.putObject(bucket, name, attachment.content, null, metadata, (err, res) => {
                    if (err) {
                        return reject(err);
                    }
                    const etag = res.etag;
                    // get object size
                    this.s3.statObject(bucket, name, (err, res) => {
                        if (err) {
                            return reject(err);
                        }

                        // attachment release
                        if (attachment.release) {
                            attachment.release();
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
         * process to address
         * 
         * @param {Object} ctx - moleculer context
         * @param {Object} email - email object
         * @param {Object} envelope - envelope object
         * 
         * @returns {Promise<Object>} - returns email object
         */
        async processAddreses(ctx, email, envelope) {

            // get from address
            const from = email.headers.get('from');
            if (from) {
                const addresses = await this.processAddressArray(ctx, from.value);
                email.from = addresses[0];
            }

            // get to address
            const to = email.headers.get('to');
            if (to) {
                const addresses = await this.processAddressArray(ctx, to.value);
                email.to = addresses;
            }

            // get cc address
            const cc = email.headers.get('cc');
            if (cc) {
                const addresses = await this.processAddressArray(ctx, cc.value);
                email.cc = addresses;
            }

            // get bcc address
            const bcc = email.headers.get('bcc');
            if (bcc) {
                const addresses = await this.processAddressArray(ctx, bcc.value);
                email.bcc = addresses;
            }

            // get replyTo address
            const replyTo = email.headers.get('reply-to');
            if (replyTo) {
                const addresses = await this.processAddressArray(ctx, replyTo.value);
                email.replyTo = addresses;
            }

            this.logger.info(`Processing email addresses ${envelope.id} ${email.messageId}`)

        },

        /**
         * process address array
         * 
         * @param {Object} ctx - moleculer context
         * @param {Array} addresses - address array
         * 
         * @returns {Promise<Object>} - returns address object
         */
        async processAddressArray(ctx, addresses) {
            const addressEntities = [];

            // loop through addresses
            for (const address of addresses) {
                // lookup address
                const addressEntity = await ctx.call("v2.emails.addresses.lookup", {
                    name: address.name,
                    address: address.address,
                });

                addressEntities.push(addressEntity.id);
            }

            return addressEntities;
        }
    }

}


