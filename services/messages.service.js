const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");

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
                    action: "v2.emails.mailboxes.get",
                }
            },

            // email message envelope id
            envelope: {
                type: "string",
                required: true,
                populate: {
                    action: "v2.emails.envelopes.get",
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
                    action: "v2.emails.addresses.get",
                }
            },

            // email message to
            to: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.addresses.get",
                }
            },

            // email message cc
            cc: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.addresses.get",
                }
            },

            // email message bcc
            bcc: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.addresses.get",
                }
            },

            // email message reply to
            replyTo: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.addresses.get",
                }
            },

            // email message attachments
            attachments: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.attachments.get",
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

    }

}


