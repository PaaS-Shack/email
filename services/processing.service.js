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
        async "emails.envelope.created"(ctx) {
            const envelope = ctx.params.data;
            this.logger.info("emails.envelope.created", envelope);

            // process raw email
            this.process(ctx, envelope).then(email => {
                this.logger.info("emails.processing", email);
            }).catch(err => {
                this.logger.error("emails.processing", err);
            });
        }
    },

    /**
     * service methods
     */
    methods: {
        /**
         * Process raw email
         * 
         * @param {Object} ctx - moleculer context
         * @param {Object} envelope - envelope object
         * 
         * @returns {Promise<Object>} - returns envelope object
         */
        async process(ctx, envelope) {

            const email = {
                attachments: [],
                from: [],
                to: [],
                cc: [],
                bcc: [],
                replyTo: [],
                headers: {},
                subject: '',
                body: '',
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
                            this.logger.error(`Error processing attachment ${data.filename}`, err);
                        })
                } else if (data.type === 'text') {
                    email.body = data.text;
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



            return email;
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
            email.messageId = email.headers.get('message-id')
            // message id hash
            email.hash = email.messageId.split('@')[0];

            // email priority
            email.priority = email.headers.get('priority');
            // email x priority
            email.xPriority = email.headers.get('x-priority');

            // email user agent
            email.userAgent = email.headers.get('user-agent');
            // email mime version
            email.mimeVersion = email.headers.get('mime-version');

            // email content type
            email.contentType = email.headers.get('content-type');
            if (email.contentType && email.contentType.value) {
                email.contentType = email.contentType.value;
            }

            // email content transfer encoding
            email.contentTransferEncoding = email.headers.get('content-transfer-encoding');


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
            // get to address
            const to = email.headers.get('to');
            if (!to) {
                throw new Error(`Email has no to address ${envelope.id}`);
            }
            // loop through to addresses
            for (const address of to.value) {
                // lookup addresses
                const addresses = await ctx.call("v2.emails.addresses.lookupByEmailAddress", {
                    address: address.address,
                });

                if (addresses.length === 0) {
                    const addressEntity = await ctx.call("v2.emails.addresses.lookup", {
                        name: address.name,
                        address: address.address,
                    });
                    email.to.push(addressEntity);
                }

                email.to.push(...addresses);
            }
            // filter out duplicates
            //email.to = email.to.filter((v, i, a) => a.indexOf(v) === i);

            // get from address
            const from = email.headers.get('from');
            if (!from) {
                throw new Error(`Email has no from address ${envelope.id}`);
            }
            // loop through to addresses
            for (const address of from.value) {
                // lookup addresses
                const addresses = await ctx.call("v2.emails.addresses.lookup", {
                    address: address.address,
                    name: address.name,
                });
                email.from.push(addresses);
            }

            // get cc address
            const cc = email.headers.get('cc');
            if (cc) {
                // loop through to addresses
                for (const address of cc.value) {
                    // lookup addresses
                    const addresses = await ctx.call("v2.emails.addresses.lookup", {
                        address: address.address,
                        name: address.name,
                    });
                    email.cc.push(addresses);
                }
            }

            // get bcc address
            const bcc = email.headers.get('bcc');
            if (bcc) {
                // loop through to addresses
                for (const address of bcc.value) {
                    // lookup addresses
                    const addresses = await ctx.call("v2.emails.addresses.lookup", {
                        address: address.address,
                        name: address.name,
                    });
                    email.bcc.push(addresses);
                }
            }

            // get replyTo address
            const replyTo = email.headers.get('reply-to');
            if (replyTo) {
                // loop through to addresses
                for (const address of replyTo.value) {
                    // lookup addresses
                    const addresses = await ctx.call("v2.emails.addresses.lookup", {
                        address: address.address,
                        name: address.name,
                    });
                    email.replyTo.push(addresses);
                }
            }

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


