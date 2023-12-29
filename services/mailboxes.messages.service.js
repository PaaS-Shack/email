const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");
const { MoleculerClientError } = require("moleculer").Errors;


/**
 * this is the email mailbox messages service
 */

module.exports = {
    // name of service
    name: "emails.mailboxes.messages",
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

            // the mailbox id
            mailbox: {
                type: "string",
                required: true,
                population: {
                    action: "v1.emails.mailboxes.get",
                }
            },

            // the message id
            message: {
                type: "string",
                required: true,
                population: {
                    action: "v1.emails.messages.get",
                }
            },

            // the message flags
            flags: {
                type: "array",
                required: false,
                default: [],
            },

            // the message seen flag
            seen: {
                type: "boolean",
                required: false,
                default: false,
            },

            // the message answered flag
            answered: {
                type: "boolean",
                required: false,
                default: false,
            },

            // the message deleted flag
            deleted: {
                type: "boolean",
                required: false,
                default: false,
            },

            // the message draft flag
            draft: {
                type: "boolean",
                required: false,
                default: false,
            },

            // the message flagged flag
            flagged: {
                type: "boolean",
                required: false,
                default: false,
            },

            // the message recent flag
            recent: {
                type: "boolean",
                required: false,
                default: false,
            },

            // the message forwarded flag
            forwarded: {
                type: "boolean",
                required: false,
                default: false,
            },

            // the message subject
            subject: {
                type: "string",
                required: false,
            },

            // the message from
            from: {
                type: "string",
                required: false,
            },

            // the message to
            to: {
                type: "string",
                required: false,
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


