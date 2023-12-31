const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");

const { MoleculerClientError, MoleculerServerError } = require("moleculer").Errors;


/**
 * This is the mailbox service for webmail, imap, pop3, smtp
 * Every email has a default mailbox called inbox
 * Mailboxes have flags and other metadata for imap and pop3
 * Mailboxes have messages that are stored in the emails.messages service
 * 
 * When a new evelope is received, it is stored in the mailbox of the email account
 */

module.exports = {
    // name of service
    name: "emails.mailboxes",
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
        DbService({}),
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

        fields: {

            // mailbox name
            name: {
                type: "string",
                required: true,
                min: 3,
                max: 25,
                trim: true,
            },

            // mailbox description
            description: {
                type: "string",
                required: false,
            },

            // mailbox email address
            email: {
                type: "string",
                required: true,
                readonly: true,
                populate: {
                    action: "v2.emails.addresses.get",
                }
            },

            // mailbox email aliases
            alias: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.addresses.get",
                }
            },


            // mailbox flags
            flags: {
                type: "array",
                required: false,
                default: [],
                items: "string"
            },

            // mailbox messages
            messages: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.messages.get",
                }
            },

            // mailbox email account
            account: {
                type: "string",
                required: true,
                populate: {
                    action: "v2.emails.accounts.get",
                }
            },

            // mailbox unread messages
            unread: {
                type: "number",
                required: false,
                readonly: true,
                get: ({ ctx, params }) => {
                    return ctx.call("v2.emails.messages.count", { query: { mailbox: params.id, seen: false } });
                },
            },

            // mailbox total messages
            total: {
                type: "number",
                required: false,
                readonly: true,
                get: ({ ctx, params }) => {
                    return ctx.call("v2.emails.messages.count", { query: { mailbox: params.id } });
                },
            },

            // mailbox seen messages
            seen: {
                type: "number",
                required: false,
                readonly: true,
                get: ({ ctx, params }) => {
                    return ctx.call("v2.emails.messages.count", { query: { mailbox: params.id, seen: true } });
                },
            },

            // mailbox unseen messages
            unseen: {
                type: "number",
                required: false,
                readonly: true,
                get: ({ ctx, params }) => {
                    return ctx.call("v2.emails.messages.count", { query: { mailbox: params.id, seen: false } });
                },
            },

            // mailbox recent messages
            recent: {
                type: "number",
                required: false,
                readonly: true,
                get: ({ ctx, params }) => {
                    return ctx.call("v2.emails.messages.count", { query: { mailbox: params.id, recent: true } });
                },
            },

            // mailbox deleted messages
            deleted: {
                type: "number",
                required: false,
                readonly: true,
                get: ({ ctx, params }) => {
                    return ctx.call("v2.emails.messages.count", { query: { mailbox: params.id, deleted: true } });
                },
            },

            // mailbox draft messages
            draft: {
                type: "number",
                required: false,
                readonly: true,
                get: ({ ctx, params }) => {
                    return ctx.call("v2.emails.messages.count", { query: { mailbox: params.id, draft: true } });
                },
            },

            // mailbox flagged messages
            flagged: {
                type: "number",
                required: false,
                readonly: true,
                get: ({ ctx, params }) => {
                    return ctx.call("v2.emails.messages.count", { query: { mailbox: params.id, flagged: true } });
                },
            },

            // mailbox answered messages
            answered: {
                type: "number",
                required: false,
                readonly: true,
                get: ({ ctx, params }) => {
                    return ctx.call("v2.emails.messages.count", { query: { mailbox: params.id, answered: true } });
                },
            },

            // mailbox junk messages
            junk: {
                type: "number",
                required: false,
                readonly: true,
                get: ({ ctx, params }) => {
                    return ctx.call("v2.emails.messages.count", { query: { mailbox: params.id, junk: true } });
                },
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

    },

    /**
     * service events
     */
    events: {
        /**
         * envelope created event
         */
        async "emails.envelopes.created"(ctx) {
            const envelope = ctx.params.data;
        }
    },

    /**
     * service methods
     */
    methods: {
        /**
         * lookup mailboxes by email address
         * 
         * @param {Context} ctx
         * @param {String} address - email address
         * 
         * @returns {Promise}
         */
        async lookupByEmailAddress(ctx, address) {
            return ctx.call("v2.emails.addresses.lookupByEmailAddress", { address });
        },

        /**
         * get headers from envelope
         * 
         * @param {Context} ctx
         * @param {Object} envelope - envelope object
         * 
         * @returns {Array} email headers
         */
        async getEnvelopeHeaders(ctx, envelope) {
            // get envelope stream from s3
            const stream = await this.getMessageStream(envelope);

            // header stream
            const headerStream = new HeaderStream();

            return new Promise((resolve, reject) => {
                headerStream.once('error', reject)
                headerStream.once('headers', (headers) => {
                    stream.end();
                    resolve(headers);
                });
                stream.pipe(headerStream);
            })
        }
    }

}


