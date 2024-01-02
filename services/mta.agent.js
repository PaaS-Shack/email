const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");

const { MoleculerClientError, MoleculerServerError } = require("moleculer").Errors;

const nodemailer = require("nodemailer");
const SMTPServer = require('smtp-server').SMTPServer;
const { v4: uuidv4 } = require('uuid');

/**
 * This agent is used to send emails to the internet.
 * Emails are signed with dkim and sent to the internet via smtp.
 * We keep connection pools open to smtp servers for faster sending.
 */
module.exports = {
    // name of service
    name: "emails.mta",// mail transfer agent
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
         * get a smtp connection pool for a given domain
         * 
         * @param {Context} ctx - moleculer context
         * @param {String} domain - domain to get smtp connection for
         * 
         * @returns {Promise} resolves to smtp connection pool
         */
        async getSmtpPool(ctx, domain) {
            // get smtp pool
            let smtpPool = this.smtpPools.get(domain);
            // check if we have a pool
            if (!smtpPool) {
                // get mx host
                const mxHost = await this.getMxHost(ctx, domain);
                // create pool
                smtpPool = await this.createPool(ctx, mxHost);
                // add to pools
                this.smtpPools.set(domain, smtpPool);
            }
            // return pool
            return smtpPool;
        },

        /**
         * create pool
         * try 465, 587, 25
         * 
         * @param {Object} ctx - context
         * @param {String} mxHost - mx host
         * 
         * @returns {Object} pool - pool object
         */
        async createPool(ctx, mxHost) {
            // pool object
            let pool = null;
            // try 465, 587, 25
            const ports = [25, 587, 465];

            // loop ports
            for (let index = 0; index < ports.length; index++) {
                const port = ports[index];

                await this.createSMTPPool(ctx, mxHost, port).then(transport => {
                    pool = transport;
                    this.logger.info(`createPool ${mxHost} ${port} success`);
                }).catch(err => {
                    this.logger.error(`createPool ${mxHost} ${port} ${err.message}`);
                });
                if (pool) {
                    break;
                }
            }
            return pool;
        },

        /**
         * create smtp pool
         * 
         * @param {Object} ctx - context
         * @param {String} mxHost - mx host
         * @param {Number} port - port
         * 
         * @returns {Object} pool - pool object
         */
        async createSMTPPool(ctx, mxHost, port) {
            const secure = port === 465;
            const starttls = port === 587;

            this.logger.info(`createTransport ${mxHost} ${port} ${secure} ${starttls}`);

            // create transport
            const transport = nodemailer.createTransport({
                pool: true,
                host: mxHost,
                port,
                secure, // use TLS
                name: this.config["emails.outbound.hostname"],
            });

            transport.mx = mxHost;

            //watch error
            transport.on('error', err => {
                this.logger.error(`createTransport ${mxHost} ${port} ${err.message}`);
            });
            transport.on('close', () => {
                this.logger.info(`createTransport ${mxHost} ${port} close`);
            });
            transport.on('idle', () => {
                this.logger.info(`createTransport ${mxHost} ${port} idle`);
            });
            transport.on('end', () => {
                this.logger.info(`createTransport ${mxHost} ${port} end`);
            });
            transport.on('connect', () => {
                this.logger.info(`createTransport ${mxHost} ${port} connect`);
            });

            // wait for idle
            return new Promise(async (resolve, reject) => {
                transport.on('error', reject)

                transport.once('idle', () => {
                    resolve(transport)
                    // remove error handler
                    transport.removeListener('error', reject);

                });
            });
        },

        /**
         * get mx host for domain
         * 
         * @param {Object} ctx - context
         * @param {String} domain - domain
         * 
         * @returns {String} mxHost - mx host
         */
        async getMxHost(ctx, domain) {

            // get mx records
            const recoreds = await ctx.call('v1.utils.dns.lookup', {
                host: domain,
                type: 'MX'
            });

            // get mx host by priority
            const mxHost = recoreds.sort((a, b) => a.priority - b.priority)[0].exchange;

            return mxHost;
        },

        /**
         * get email dkim signatures for domain
         * 
         * @param {Object} ctx - context
         * @param {String} domain - domain
         * 
         * @returns {Promise} resolves to dkim signatures
         */
        async getDkimSignatures(ctx, domain) {
            // get dkim keys
            const dkim = await ctx.call('v1.certificates.resolveDKIM', {
                domain: this.config['emails.outbound.dkim.domainName'],
                keySelector: this.config['emails.outbound.dkim.keySelector'],
            });

            return dkim;
        },

        /**
         * clea headers of unwanted headers
         * 
         * @param {Context} ctx - moleculer context
         * @param {Object} headers - headers object
         * 
         * @returns {Object} cleaned headers
         */
        cleanHeaders(ctx, headers) {
            // headers to remove
            const removeHeaders = [
                'x-mailer',
                'x-mimeole',
                'x-msmail-priority',
                'x-priority',
                'x-ms-has-attach',
                'x-spam-flag',
                'x-spam-status',
                'x-spam-level',
                'x-spam-score',
                'x-spam-bar',
                'x-spam-report',
                'x-spam-checker-version',
                'x-spam-checker',
                'x-spam-check-by',
                'x-spam-check-date',
                'x-spam-check-result',
                'x-spam-checker',
                'x-spam-check-version',
                'x-spam-check',
                'x-spam',
            ];

            // loop headers
            for (const header in headers) {
                // check if header is in remove list
                if (removeHeaders.includes(header.toLowerCase())) {
                    // remove header
                    delete headers[header];
                }
            }

            return headers;
        },

        /**
         * add needed headers to email
         * 
         * @param {Context} ctx - moleculer context
         * @param {Object} headers - headers object
         * @param {Object} email - email object
         * 
         * @returns {Object} headers
         */
        addHeaders(ctx, headers, email) {


            return headers;
        },

        /**
         * create message object
         * 
         * @param {Context} ctx - moleculer context
         * @param {Object} email - email object
         * 
         * @returns {Object} message - message object
         */
        async createMessage(ctx, email) {

            // get dkim signatures
            const dkim = await this.getDkimSignatures(ctx, email.from.split('@')[1]);

            // get headers
            const headers = this.cleanHeaders(ctx, email.headers);

            // add headers
            this.addHeaders(ctx, headers, email);

            // get from
            const from = await this.getFrom(ctx, email.from);
            // get to
            const to = await this.getTo(ctx, email.to);
            // get cc
            const cc = await this.getCc(ctx, email.cc);
            // get bcc
            const bcc = await this.getBcc(ctx, email.bcc);
            // get sender
            const sender = await this.getSender(ctx, email.sender);
            // get replyTo
            const replyTo = await this.getReplyTo(ctx, email.replyTo);


            // get attachments
            const attachments = await this.getAttachments(ctx, email.attachments);

            // create message
            const message = {
                messageId: email.messageId,
                subject: email.subject,
                text: email.text,
                html: email.html,

                // routing
                sender,
                replyTo,

                // address fields
                from,
                to,
                cc,
                bcc,

                // other fields
                headers,
                attachments,
                dkim,
            };

            return message;
        },

        /**
         * get from address
         * 
         * @param {Context} ctx - moleculer context
         * @param {String} from - from address id
         * 
         * @returns {String} from - from address
         */
        async getFrom(ctx, from) {
            // get from address
            const address = await ctx.call('v2.emails.addresses.get', {
                id: from
            });

            return address.address;
        },

        /**
         * get to addresses
         * 
         * @param {Context} ctx - moleculer context
         * @param {Array} to - to address ids
         * 
         * @returns {Array} to - to addresses
         */
        async getTo(ctx, to) {
            // get to addresses
            const addresses = await ctx.call('v2.emails.addresses.resolve', {
                id: to
            });

            return addresses.map(address => address.address);
        },

        /**
         * get cc addresses
         * 
         * @param {Context} ctx - moleculer context
         * @param {Array} cc - cc address ids
         * 
         * @returns {Array} cc - cc addresses
         */
        async getCc(ctx, cc) {
            // get cc addresses
            const addresses = await ctx.call('v2.emails.addresses.resolve', {
                id: cc
            });

            return addresses.map(address => address.address);
        },

        /**
         * get bcc addresses
         * 
         * @param {Context} ctx - moleculer context
         * @param {Array} bcc - bcc address ids
         * 
         * @returns {Array} bcc - bcc addresses
         */
        async getBcc(ctx, bcc) {
            // get bcc addresses
            const addresses = await ctx.call('v2.emails.addresses.resolve', {
                id: bcc
            });

            return addresses.map(address => address.address);
        },

        /**
         * get sender address
         * 
         * @param {Context} ctx - moleculer context
         * @param {String} sender - sender address id
         * 
         * @returns {String} sender - sender address
         */
        async getSender(ctx, sender) {
            // get sender address
            const address = await ctx.call('v2.emails.addresses.get', {
                id: sender
            });

            return address.address;
        },

        /**
         * get replyTo address
         * 
         * @param {Context} ctx - moleculer context
         * @param {String} replyTo - replyTo address id
         * 
         * @returns {String} replyTo - replyTo address
         */
        async getReplyTo(ctx, replyTo) {
            // get replyTo address
            const address = await ctx.call('v2.emails.addresses.get', {
                id: replyTo
            });

            return address.address;
        },

        /**
         * get attachments
         * 
         * @param {Context} ctx - moleculer context
         * @param {Array} attachments - attachment ids
         * 
         * @returns {Array} attachments - attachments
         */
        async getAttachments(ctx, attachments) {
            // get attachments
            const attachments = await ctx.call('v2.emails.attachments.resolve', {
                id: attachments
            });

            return attachments;
        },



        /**
         * send email
         * 
         * @param {Context} ctx - context
         * @param {String} id - email id
         * 
         * @returns {Object} email - email object
         */
        async sendEmail(ctx, id) {
                // get email
                const email = await ctx.call('v2.emails.get', {
                    id
                });

                // mark message as sending
                await ctx.call('v2.emails.update', {
                    id,
                    status: 'sending',
                });

                // get message
                const message = await this.createMessage(ctx, email);

                const domain = email.from.split('@')[1];
                // get smtp pool
                const pool = await this.getSmtpPool(ctx, domain);

                // send email
                return new Promise((resolve, reject) => {
                    pool.sendMail(message, async (err, info) => {
                        if (err) {
                            // mark message as failed
                            await ctx.call('v2.emails.update', {
                                id,
                                status: 'failed',
                                error: err.message,
                            });
                            // reject
                            reject(err);
                        } else {
                            // mark message as sent
                            await ctx.call('v2.emails.update', {
                                id,
                                status: 'sent',
                            });
                            // resolve
                            resolve(info);
                        }
                    });
                });
            }

        },

        /**
         * service created lifecycle event handler
         */
        created() {
            // connection pools for smtp servers
            this.smtpPools = new Map();
        },

        /**
         * service started lifecycle event handler
         */
        async started() {
            // create smtp server
           // await this.createSmtpServer();
        },

        /**
         * service stopped lifecycle event handler
         */
        async stopped() {
            // close smtp server
           // await this.closeSmtpServer();
        }

    }


