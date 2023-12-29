const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");
const e = require("express");
const { MoleculerClientError } = require("moleculer").Errors;


/**
 * this is the email mailboxs service
 */

module.exports = {
    // name of service
    name: "emails.mailboxes",
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
            // the mailbox name
            name: {
                type: "string",
                required: true,
                min: 3,
                max: 50,
                trim: true,
                lowercase: true,
            },

            // the mailbox description
            description: {
                type: "string",
                required: false,
            },

            // the mailbox type
            type: {
                type: "string",
                required: true,
                enum: [
                    "inbox",
                    "drafts",
                    "sent",
                    "trash",
                    "junk",
                    "archive",
                    "custom",
                ],
                default: "custom",
            },

            // the mailbox flags
            flags: {
                type: "array",
                required: false,
                default: [],
            },

            // uid validity value
            uidValidity: {
                type: "number",
                required: false,
                default: () => Math.floor(Date.now() / 1000),
            },

            // uid next value
            uidNext: {
                type: "number",
                required: false,
                default: 1,
            },

            // the mailbox messages count
            messagesCount: {
                type: "number",
                required: false,
                default: 0,
            },

            // the mailbox unseen messages count
            unseenMessagesCount: {
                type: "number",
                required: false,
                default: 0,
            },

            // the mailbox messages
            messages: {
                type: "array",
                required: false,
                default: [],
                populate: {
                    action: "v1.emails.mailboxes.messages.resolve",
                }
            },

            // the mailbox account
            account: {
                type: "string",
                required: true,
                population: {
                    action: "v1.emails.accounts.get",
                }
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
         * create default mailbox
         * 
         * @actions
         * @param {String} account - the account id
         * 
         * @returns {Object} - the created mailbox
         */
        createDefault: {
            params: {
                account: {
                    type: "string",
                    required: true,
                },
            },
            async handler(ctx) {
                const { account } = ctx.params;

                const found = await this.resolveMailbox(ctx, "INBOX", account);

                if (found) {
                    return found;
                }

                const mailbox = await this.createEntity(ctx, {
                    name: "INBOX",
                    description: "Default mailbox",
                    type: "inbox",
                    flags: ["\\Inbox"],
                    account,
                });

                return mailbox;
            }
        },

    },

    /**
     * service events
     */
    events: {
        /**
         * Account created handler
         */
        async "emails.accounts.created"(ctx) {
            const account = ctx.params.data;

            const mailbox = await this.actions.createDefault({
                account: account.id,
            });

            this.logger.info("Default mailbox created", mailbox);
        },
        /**
         * on email received
         */
        async "emails.inbound.received"(ctx) {
            const { envelope } = ctx.params;

            const account = await ctx.call('v1.emails.accounts.resolveAddress', {
                address: envelope.to[0].address
            });

            if (!account) {
                throw new MoleculerClientError("Account not found", 404);
            }

            const mailbox = await this.resolveMailbox(ctx, "INBOX", account.id);

            if (!mailbox) {
                throw new MoleculerClientError("Mailbox not found", 404);
            }

            const info = await ctx.call('v1.emails.parser.info', {
                id: envelope.id,
            });

            // create message
            const message = await ctx.call('v1.emails.mailboxes.messages.create', {
                // the mailbox id
                mailbox: mailbox.id,
                // the message id
                message: envelope.id,
                // the message flags
                flags: [],
                // the message seen flag
                seen: false,
                // the message recent flag
                recent: true,
                // the message subject
                subject: info.subject,
                // the message from
                from: envelope.from,
                // the message to
                to: envelope.to[0],
            });

            // message update
            const update = {
                id: mailbox.id,
                $inc: {
                    messagesCount: 1,
                    unseenMessagesCount: 1,
                },
                $AddToSet: {
                    messages: message.id,
                }
            };

            const updated = await this.updateEntity(ctx, update, { raw: true });

            this.logger.info("Mailbox updated", updated);

        }
    },

    /**
     * service methods
     */
    methods: {
        /**
         * resolve mailbox by name and account
         * 
         * @param {String} name
         * @param {String} account
         * @returns {Object}
         */
        async resolveMailbox(ctx, name, account) {
            const mailbox = await this.findEntity(null, {
                query: {
                    name,
                    account,
                }
            });

            return mailbox;
        },

    }

}


