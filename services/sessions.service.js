const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");

const { MoleculerClientError, MoleculerServerError } = require("moleculer").Errors;


/**
 * This service keeps track of email inbound smtp sessions.  It is used to prevent spamming.
 */

module.exports = {
    // name of service
    name: "emails.sessions",
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

            // session localAddress
            localAddress: {
                type: "string",
                required: true,
            },

            // session localPort
            localPort: {
                type: "number",
                required: true,
            },

            // session remoteAddress
            remoteAddress: {
                type: "string",
                required: true,
            },

            // session remotePort
            remotePort: {
                type: "number",
                required: true,
            },

            // session clientHostname
            clientHostname: {
                type: "string",
                required: false,
            },

            // session hostNameAppearsAs
            hostNameAppearsAs: {
                type: "string",
                required: false,
            },

            // session openingCommand
            openingCommand: {
                type: "string",
                required: false,
            },

            // session transmissionType
            transmissionType: {
                type: "string",
                required: false,
            },

            // session valid
            valid: {
                type: "boolean",
                required: false,
                default: true,
            },

            // session active
            active: {
                type: "boolean",
                required: false,
                default: true,
            },

            // session blocked
            blocked: {
                type: "boolean",
                required: false,
                default: false,
            },

            // session from addresses
            from: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.addresses.get",
                }
            },

            // session to addresses
            to: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.addresses.get",
                }
            },

            // session envelopes
            envelopes: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.envelopes.get",
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


