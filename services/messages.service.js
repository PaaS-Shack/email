const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");
const { Context } = require("moleculer");

const { MoleculerClientError, MoleculerServerError } = require("moleculer").Errors;


/**
 * This is the service for storing email messages and are associated with a mailbox.
 * 
 */

module.exports = {
    // name of service
    name: "emails.messages",
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

            // email message mailbox id
            mailbox: {
                type: "string",
                required: true,
                populate: {
                    action: "v2.emails.mailboxes.resolve",
                }
            },

            // email message envelope id
            envelope: {
                type: "string",
                required: true,
                populate: {
                    action: "v2.emails.envelopes.resolve",
                }
            },

            // email message flags
            flags: {
                type: "array",
                required: false,
                default: [],
                items: "string",
            },

            // email message subject
            subject: {
                type: "string",
                required: false,
            },

            // email message from
            from: {
                type: "string",
                required: true,
                populate: {
                    action: "v2.emails.addresses.resolve",
                }
            },

            // email message to
            to: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.addresses.resolve",
                }
            },

            // email message cc
            cc: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.addresses.resolve",
                }
            },

            // email message bcc
            bcc: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.addresses.resolve",
                }
            },

            // email message reply to
            replyTo: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.addresses.resolve",
                }
            },

            // email message attachments
            attachments: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.attachments.resolve",
                }
            },


            // message is unread
            unread: {
                type: "boolean",
                required: false,
                default: true,
            },

            // message is flagged
            flagged: {
                type: "boolean",
                required: false,
                default: false,
            },

            // message is answered
            answered: {
                type: "boolean",
                required: false,
                default: false,
            },

            // message is draft
            draft: {
                type: "boolean",
                required: false,
                default: false,
            },

            // message is deleted
            deleted: {
                type: "boolean",
                required: false,
                default: false,
            },

            // message is seen
            seen: {
                type: "boolean",
                required: false,
                default: false,
            },

            // message is sent
            sent: {
                type: "boolean",
                required: false,
                default: false,
            },

            // message is received
            received: {
                type: "boolean",
                required: false,
                default: false,
            },

            // message is recent
            recent: {
                type: "boolean",
                required: false,
                default: false,
            },

            // message is junk
            junk: {
                type: "boolean",
                required: false,
                default: false,
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
         * get message body by id
         * 
         * @actions
         * @param {String} id - message id
         * 
         * @returns {Object} message body
         */
        body: {
            params: {
                id: { type: "string" },
            },
            async handler(ctx) {
                let { id } = ctx.params;

                // get message
                let message = await this.getById(id);

                // check if message exists
                if (!message) {
                    throw new MoleculerClientError("Message not found", 404, "MESSAGE_NOT_FOUND", { id });
                }

                // get message body
                return ctx.call("v2.emails.find", {
                    query: {
                        envelope: message.envelope,
                    },
                    limit: 1,
                    fields: ["text"],
                }).then((res) => {
                    return res[0].text;
                });
            }
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
         * get message by id
         * 
         * @param {Context} ctx - context of service
         * @param {String} id - message id
         * 
         * @returns {Object} message
         */
        async getById(id) {
            return this.resolveEntities(null, {
                id
            })
        },
    }

}


