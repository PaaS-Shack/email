const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");
const { MoleculerClientError } = require("moleculer").Errors;

const fs = require('fs').promises;
const { createWriteStream, createReadStream } = require('fs');
const crypto = require('crypto');

const simpleParser = require('mailparser').simpleParser;
const MailParser = require('mailparser').MailParser;

const S3Mixin = require("../mixins/s3-store.mixin");
const FSMixin = require("../mixins/fs-store.mixin");

const dkim = require('../lib/dkim')



/**
 * email parser service
 */

module.exports = {
    // name of service
    name: "emails.parser",
    // version of service
    version: 1,

    /**
     * Service Mixins
     * 
     * @type {Array}
     * @property {DbService} DbService - Database mixin
     * @property {ConfigLoader} ConfigLoader - Config loader mixin
     */
    mixins: [
        DbService({
            permissions: 'emails.parser'
        }),
        ConfigLoader([
            'emails.**'
        ]),
        S3Mixin,
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

        fields: {


            ...DbService.FIELDS,// inject dbservice fields
        },
        defaultPopulates: [],

        scopes: {
            ...DbService.SCOPE,
        },

        defaultScopes: [
            ...DbService.DSCOPE,
        ],

        // default init config settings
        config: {

        }
    },

    /**
     * service actions
     */
    actions: {
        /**
         * get basic info about email message
         * 
         * @actions
         * @param {String} id - envelope id
         * 
         * @returns {Object} - basic info about email message
         */
        info: {
            rest: {
                method: "GET",
                path: "/:id/info",
            },
            params: {
                id: { type: "string" },
            },
            async handler(ctx) {
                const id = ctx.params.id;

                // check if id is valid
                if (!id) {
                    throw new MoleculerClientError("Invalid envelope id", 400, "INVALID_ENVELOPE_ID");
                }

                // get message stream
                const stream = await this.getMessageStream({
                    id,
                });

                const parsed = await simpleParser(stream);

                const info = {
                    id,
                    subject: parsed.subject,
                    from: parsed.from,
                    to: parsed.to,
                    date: parsed.date,
                };

                return info;
            }
        },
        /**
         * get email message headers
         * 
         * @actions
         * @param {String} id - envelope id
         * 
         * @returns {Object} - email message headers
         */
        headers: {
            rest: {
                method: "GET",
                path: "/:id/headers",
            },
            params: {
                id: { type: "string" },
            },
            async handler(ctx) {
                const id = ctx.params.id;

                // check if id is valid
                if (!id) {
                    throw new MoleculerClientError("Invalid envelope id", 400, "INVALID_ENVELOPE_ID");
                }

                // get message stream
                const stream = await this.getMessageStream({
                    id,
                });

                const parsed = await simpleParser(stream);

                return parsed.headers;
            }
        },
        /**
         * parse email message
         * 
         * @actions
         * @param {String} id - envelope id
         * 
         * @returns {Object} - parsed message
         */
        parse: {
            rest: {
                method: "GET",
                path: "/:id/parse",
            },
            params: {
                id: { type: "string" },
            },
            async handler(ctx) {
                const id = ctx.params.id;

                // check if id is valid
                if (!id) {
                    throw new MoleculerClientError("Invalid envelope id", 400, "INVALID_ENVELOPE_ID");
                }

                // get message stream
                const stream = await this.getMessageStream({
                    id,
                });

                return simpleParser(stream)
            }
        },
        /**
         * verify DKIM signature
         * 
         * @actions
         * @param {String} id - envelope id
         * 
         * @returns {Promise} - resolves to s3 object
         */
        verify: {
            rest: {
                method: "GET",
                path: "/:id/verify",
            },
            params: {
                id: { type: "string" },
            },
            async handler(ctx) {
                const id = ctx.params.id;

                // check if id is valid
                if (!id) {
                    throw new MoleculerClientError("Invalid envelope id", 400, "INVALID_ENVELOPE_ID");
                }

                // get message stream
                const stream = await this.getMessageStream({
                    id,
                });

                // write stream to tmp file
                const tmpFile = await this.writeStreamToTmpFile(stream);

                const cfg = {
                    // 0 = no logging, 1 = errors only, 2 = errors and warnings, 3 = errors, warnings, and info
                    sigerror_log_level: 0,
                    // dns timeout in seconds
                    timeout: 30,
                    // skew time allowed
                    allowed_time_skew: true
                };
                return new Promise((resolve, reject) => {

                    const verifier = new dkim.DKIMVerifyStream(cfg, (err, result, results) => {
                        console.log(err, result, results);
                        if (err) {
                            reject(err);
                        } else {
                            resolve({
                                result, results
                            });
                        }

                        // remove tmp file
                        fs.unlink(tmpFile);
                    });

                    const readStream = createReadStream(tmpFile);

                    readStream.pipe(verifier);
                });

            }
        },

        /**
         * sign email message
         * 
         * @actions
         * @param {String} id - envelope id
         * @param {String} domain - domain to sign with
         * @param {String} selector - selector to sign with
         * 
         * @returns {Promise} - resolves to s3 object
         */
        sign: {
            rest: {
                method: "GET",
                path: "/:id/sign",
            },
            params: {
                id: { type: "string" },
            },
            async handler(ctx) {
                const params = Object.assign({}, ctx.params);
                const id = params.id;

                // check if id is valid
                if (!id) {
                    throw new MoleculerClientError("Invalid envelope id", 400, "INVALID_ENVELOPE_ID");
                }

                // get message stream
                const stream = await this.getMessageStream({
                    id,
                });

                // write stream to tmp file
                const tmpFile = await this.writeStreamToTmpFile(stream);

                const parsed = await this.actions.parse({
                    id,
                });

                const keys = await ctx.call('v1.certificates.resolveDKIM', {
                    domain: params.domain,
                })

                const cfg = {
                    selector: keys.keySelector,
                    domain: keys.domain,
                    private_key: keys.privkey,
                    headers: [
                        'to',
                        'from',
                        'cc',
                        'subject',
                        'date',
                        'reply-to',
                        'sender',
                        'resent-to',
                        'resent-from',
                        'resent-cc',
                        'resent-bcc',
                        'resent-sender',
                        'resent-message-id',
                        'in-reply-to',
                        'references',
                        'list-id',
                        'list-help',
                        'list-unsubscribe',
                        'list-subscribe',
                        'list-post',
                        'list-owner',
                        'list-archive',
                        'message-id',
                        'mime-version',
                    ],
                };

                const header = new Map();
                //headerLines
                for (let index = 0; index < parsed.headerLines.length; index++) {
                    const element = parsed.headerLines[index];
                    header.set(element.key, element.line);
                }

                return new Promise((resolve, reject) => {

                    const signer = new dkim.DKIMSignStream(cfg, header, (err, result) => {

                        if (err) {
                            reject(err);
                        } else {
                            resolve({
                                key: 'DKIM-Signature',
                                value: result
                            });
                        }

                        // remove tmp file
                        fs.unlink(tmpFile);
                    });

                    const readStream = createReadStream(tmpFile);

                    readStream.pipe(signer);
                });

            }
        },
    },

    /**
     * service events
     */
    events: {
        async "emails.inbound.received"(ctx) {
            const envelope = ctx.params.envelope;

            // check if envelope is valid
            if (!envelope) {
                throw new MoleculerClientError("Invalid envelope", 400, "INVALID_ENVELOPE");
            }

        },
    },

    /**
     * service methods
     */
    methods: {

    }
};


