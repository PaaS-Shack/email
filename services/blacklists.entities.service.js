const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");

const { MoleculerClientError, MoleculerServerError } = require("moleculer").Errors;


/**
 * This service keeps track of email blacklists entities.
 * 
 * Entity can be an email address, domain, or ip address
 */

module.exports = {
    // name of service
    name: "emails.blacklists.entities",
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

            // email blacklist name
            name: {
                type: "string",
                required: false,
            },

            // entity type (address, domain, ip)
            type: {
                type: "string",
                required: false,
                default: "address",
                enum: [
                    "address",
                    "domain",
                    "ip",
                ]
            },

            // blacklist email address
            email: {
                type: "string",
                required: false,
            },

            // blacklist domain
            domain: {
                type: "string",
                required: false,
            },

            // blacklist ip address
            ip: {
                type: "object",
                required: false,
                items: {

                    // blacklist ip address
                    address: {
                        type: "string",
                        required: false,
                    },

                    // blacklist ip family
                    family: {
                        type: "string",
                        required: false,
                        default: "ipv4",
                        enum: [
                            "ipv4",
                            "ipv6",
                        ]
                    },

                    // blacklist ip high range
                    high: {
                        type: "number",
                        required: false,
                    },

                    // blacklist ip low range
                    low: {
                        type: "number",
                        required: false,
                    },
                }
            },



            // blacklist reason
            reason: {
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


