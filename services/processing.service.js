const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");

const zlib = require('zlib');
const { v4: uuidv4 } = require('uuid');

const { MoleculerClientError, MoleculerServerError } = require("moleculer").Errors;

const HeaderSplitter = require("../lib/header-splitter");
const { Context } = require("moleculer");

const MailParser = require('mailparser').MailParser;

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

    },

    /**
     * service events
     */
    events: {

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

                // get from
                email.from = headers.get('from') || [];
                // get to
                email.to = headers.get('to') || [];
                // get cc
                email.cc = headers.get('cc') || [];
                // get bcc
                email.bcc = headers.get('bcc') || [];
                // get replyTo
                email.replyTo = headers.get('reply-to') || [];
                // get subject
                email.subject = headers.get('subject') || '';
                // get date
                email.date = headers.get('date') || '';
            });

            parser.on('data', data => {
                if (data.type === 'attachment') {
                    // store attachment in s3
                    this.storeAttachment(ctx, data.content, data).then(attachment => {
                        email.attachments = email.attachments || [];
                        email.attachments.push(attachment);
                    }).catch(err => {
                        throw new MoleculerServerError(err.message, err.code, "STORE_ATTACHMENT_ERROR", { err });
                    });
                }else if (data.type === 'text') {
                    email.body = data.text;
                }
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

            return email;
        },

        /**
         * store attachment in s3
         * 
         * @param {Context} ctx - moleculer context
         * @param {Stream} stream - attachment stream
         * @param {Object} attachment - attachment object
         * 
         * @returns {Promise<Object>} - returns attachment object
         */
        async storeAttachment(ctx, stream, attachment) {
            const bucket = this.config['emails.s3.attachments'] || 'attachments';
            const name = `${uuidv4()}.tar.gz`;

            const metadata = {
                'Content-Type': 'application/gzip',
            };

            // zip stream
            const gzip = zlib.createGzip();

            // pipe stream to gzip
            stream.pipe(gzip);            

            return new Promise((resolve, reject) => {

                this.s3.putObject(bucket, name, gzip, null, metadata, function (err, res) {
                    if (err) {
                        return reject(err);
                    }

                    return resolve({
                        bucket,
                        name,
                        etag: res.etag,
                    });
                });
            });
        },
    }

}


