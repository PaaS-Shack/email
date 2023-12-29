const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");

const { MoleculerClientError, MoleculerServerError } = require("moleculer").Errors;


/**
 * this is the email account service
 */

module.exports = {
    // name of service
    name: "emails.accounts",
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

            // email account name
            name: {
                type: "string",
                required: true,
                min: 3,
                max: 25,
                trim: true,
            },

            // email account description
            description: {
                type: "string",
                required: false,
            },

            // username for email account
            username: {
                type: "string",
                required: true,
                min: 3,
                max: 25,
                trim: true,
            },

            // password for email account
            password: {
                type: "string",
                required: true,
                readonly: true,
                hidden: true,
            },

            // email account email address
            email: {
                type: "string",
                required: true,
                readonly: true,
            },

            // account alias
            alias: {
                type: "array",
                required: false,
                default: [],
                items: "string",
            },

            // account tags
            tags: {
                type: "array",
                required: false,
                default: [],
                items: "string",
            },

            // account status
            status: {
                type: "string",
                required: false,
                default: "active",
                enum: ["active", "inactive", "disabled"],
            },

            // account mailboxs
            mailboxes: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v1.emails.mailboxes.get",
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
            "emails.accounts.passwordHash": "sha256",
            "emails.accounts.passwordSalt": "salt",
            "emails.accounts.passwordIterations": 10000,
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


