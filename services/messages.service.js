const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");
const { Context } = require("moleculer");
const { MoleculerClientError } = require("moleculer").Errors;


const MailComposer = require('nodemailer/lib/mail-composer');
const nodemailer = require('nodemailer');

const simpleParser = require('mailparser').simpleParser;
const MailParser = require('mailparser').MailParser;

const S3Mixin = require("../mixins/s3-store.mixin");


/**
 * this is the email account service
 */

module.exports = {
    // name of service
    name: "emails.messages",
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
            permissions: 'emails.messages'
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

            /** The e-mail address of the sender. All e-mail addresses can be plain 'sender@server.com' or formatted 'Sender Name <sender@server.com>' */
            from: {
                type: "string",
                required: false,
            },
            /** An e-mail address that will appear on the Sender: field */
            sender: {
                type: "string",
                required: false,
            },
            /** Comma separated list or an array of recipients e-mail addresses that will appear on the To: field */
            to: {
                type: "array",
                required: false,
                items: "string",
                default: [],
            },
            /** Comma separated list or an array of recipients e-mail addresses that will appear on the Cc: field */
            cc: {
                type: "array",
                required: false,
                items: "string",
                default: [],
            },
            /** Comma separated list or an array of recipients e-mail addresses that will appear on the Bcc: field */
            bcc: {
                type: "array",
                required: false,
                items: "string",
                default: [],
            },
            /** Comma separated list or an array of e-mail addresses that will appear on the Reply-To: field */
            replyTo: {
                type: "array",
                required: false,
                items: "string",
                default: [],
            },
            /** The message-id this message is replying */
            inReplyTo: {
                type: "string",
                required: false,
            },
            /** Message-id list (an array or space separated string) */
            references: {
                type: "array",
                required: false,
                items: "string",
                default: [],
            },
            /** The subject of the e-mail */
            subject: {
                type: "string",
                required: false,
            },
            /** The plaintext version of the message */
            text: {
                type: "string",
                required: false,
            },
            /** The HTML version of the message */
            html: {
                type: "string",
                required: false,
            },
            /** Apple Watch specific HTML version of the message, same usage as with text and html */
            watchHtml: {
                type: "string",
                required: false,
            },
            /** AMP4EMAIL specific HTML version of the message, same usage as with text and html. Make sure it is a full and valid AMP4EMAIL document, otherwise the displaying email client falls back to html and ignores the amp part */
            amp: {
                type: "string",
                required: false,
            },
            /** iCalendar event, same usage as with text and html. Event method attribute defaults to ‘PUBLISH’ or define it yourself: {method: 'REQUEST', content: iCalString}. This value is added as an additional alternative to html or text. Only utf-8 content is allowed */
            icalEvent: {
                type: "string",
                required: false,
            },
            /** An object or array of additional header fields */
            headers: {
                type: "array",
                required: false,
                default: [],
                items: {
                    type: "object",
                    required: false,
                    props: {
                        /** header key */
                        key: {
                            type: "string",
                            required: true,
                        },
                        /** header value */
                        value: {
                            type: "string",
                            required: true,
                        },
                    }
                }
            },
            /** An object where key names are converted into list headers. List key help becomes List-Help header etc. */
            //list?: ListHeaders | undefined;
            /** An array of attachment objects */
            //attachments?: Attachment[] | undefined;
            /** An array of alternative text contents (in addition to text and html parts) */
            //alternatives?: Attachment[] | undefined;
            /** optional SMTP envelope, if auto generated envelope is not suitable */
            //envelope?: Envelope | MimeNode.Envelope | undefined;
            /** optional Message-Id value, random value will be generated if not set */
            messageId: {
                type: "string",
                required: false,
            },
            /** optional Date value, current UTC string will be used if not set */
            date: {
                type: "number",
                required: false,
            },
            /** optional transfer encoding for the textual parts */
            encoding: {
                type: "string",
                required: false,
            },
            /** if set then overwrites entire message output with this value. The value is not parsed, so you should still set address headers or the envelope value for the message to work */
            raw: {
                type: "string",
                required: false,
            },
            /** set explicitly which encoding to use for text parts (quoted-printable or base64). If not set then encoding is detected from text content (mostly ascii means quoted-printable, otherwise base64) */
            textEncoding: {
                type: "string",
                required: false,
                enum: [
                    "quoted-printable",
                    "base64",
                ]
            },
            /** if set to true then fails with an error when a node tries to load content from URL */
            disableUrlAccess: {
                type: "boolean",
                required: false,
                default: false,
            },
            /** if set to true then fails with an error when a node tries to load content from a file */
            disableFileAccess: {
                type: "boolean",
                required: false,
                default: false,
            },

            priority: {
                type: "string",
                required: false,
                enum: [
                    "high",
                    "normal",
                    "low"
                ],
                default: "normal",
            },
            /** if set to true then converts data:images in the HTML content of message to embedded attachments */
            attachDataUrls: {
                type: "boolean",
                required: false,
                default: false,
            },

            // messages states
            state: {
                type: "string",
                required: false,
                default: "created",
                enum: [
                    "created",
                    "stored",
                    "parsed",
                    "signed",
                    "queued",
                    "delivered",
                    "bounced",
                    "rejected",
                    "failed",
                ]
            },


            // message is signed
            signed: {
                type: "boolean",
                required: false,
                default: false,
            },

            // array of accepted email address
            accepted: {
                type: "array",
                required: false,
                default: null,
                items: "string",
            },

            // array of rejected email address
            rejected: {
                type: "array",
                required: false,
                default: null,
                items: "string",
            },

            // recived ehlo
            ehlo: {
                type: "array",
                required: false,
                default: null,
                items: "string",
            },

            envelopeTime: {
                type: "number",
                required: false,
                default: null,
            },

            messageTime: {
                type: "number",
                required: false,
                default: null,
            },

            messageSize: {
                type: "number",
                required: false,
                default: null,
            },

            response: {
                type: "string",
                required: false,
                default: null,
            },


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
         * store message to s3
         * 
         * @actions
         * @param {String} id - message id
         * 
         * @returns {Object} - message
         */
        store: {
            params: {
                id: { type: "string" },
            },
            async handler(ctx) {
                const params = Object.assign({}, ctx.params);
                const id = params.id;

                const message = await this.resolveEntities(null, {
                    id,
                });

                // check if message exists
                if (!message) {
                    throw new MoleculerClientError("message not found", 404);
                }

                let transporter = nodemailer.createTransport({
                    streamTransport: true
                });
                return new Promise((resolve, reject) => {

                    transporter.sendMail(message, async (err, info) => {

                        if (err) {
                            return reject(err);
                        }

                        console.log(info.envelope);
                        console.log(info.messageId);
                        await this.storeMessageStream({ id }, info.message);

                        // update message state
                        await this.updateEntity(ctx, {
                            id,
                            state: "stored"
                        });

                        return resolve({
                            envelope: info.envelope,
                            messageId: info.messageId,
                        });
                    });

                });
            }
        },

        /**
         * parse message
         * 
         * @actions
         * @param {String} id - message id
         * 
         * @returns {Object} - message
         */
        parse: {
            params: {
                id: { type: "string" },
            },
            async handler(ctx) {
                const params = Object.assign({}, ctx.params);
                const id = params.id;

                const message = await this.resolveEntities(null, {
                    id,
                });

                // check if message exists
                if (!message) {
                    throw new MoleculerClientError("message not found", 404);
                }

                const stream = await this.getMessageStream({ id });

                const parsed = await simpleParser(stream);

                // update message state
                await this.updateEntity(ctx, {
                    id,
                    state: "parsed"
                });

                return parsed;
            }
        },

        /**
         * sign message
         * 
         * @actions
         * @param {String} id - message id
         * 
         * @returns {Object} - message
         */
        sign: {
            params: {
                id: { type: "string" },
            },
            async handler(ctx) {
                const params = Object.assign({}, ctx.params);
                const id = params.id;

                const message = await this.resolveEntities(null, {
                    id,
                });

                // check if message exists
                if (!message) {
                    throw new MoleculerClientError("message not found", 404);
                }

                const signedHeader = await ctx.call('v1.emails.parser.sign', {
                    id: message.id,
                    domain: message.to[0].split("@")[1],
                });

                // add signed header to message
                return this.updateEntity(ctx, {
                    id,
                    signed: true,
                    headers: [...message.headers, signedHeader],
                    state: "signed"
                });
            }
        },

        /**
         * queue message
         * 
         * @actions
         * @param {String} id - message id
         * 
         * @returns {Object} - message
         */
        queue: {
            params: {
                id: { type: "string" },
            },
            async handler(ctx) {
                const params = Object.assign({}, ctx.params);
                const id = params.id;

                let message = await this.resolveEntities(null, {
                    id,
                });

                // check if message exists
                if (!message) {
                    throw new MoleculerClientError("message not found", 404);
                }

                // update message state
                message = await this.updateEntity(ctx, {
                    id,
                    state: "queued"
                });

                ctx.emit('emails.messages.queued', message);

                return message;
            }
        },


        // clean db
        clean: {
            async handler(ctx) {

                const entities = await this.findEntities(null, {});
                this.logger.info(`cleaning ${entities.length} entities`);
                // loop entities
                for (let index = 0; index < entities.length; index++) {
                    const entity = entities[index];

                    await this.removeEntity(ctx, {
                        id: entity.id
                    });
                }

            },
        },
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
         * get message by uid
         * 
         * @param {Context} ctx - context of request
         * @param {String} uid - message uid
         * 
         * @returns {Object} message
         */
        async getMessage(ctx, uid) {
            const entity = await this.findEntity(null, {
                query: {
                    uid: uid,
                }
            });
            if (!entity) {
                throw new MoleculerClientError("message not found", 404);
            }
            return entity;
        }
    }

}


