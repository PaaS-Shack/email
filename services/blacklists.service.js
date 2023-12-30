const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");

const { MoleculerClientError, MoleculerServerError } = require("moleculer").Errors;


/**
 * This service keeps track of email blacklists.  It is used to help provide spam protection.
 * Blacklists track email addresses, domains, and ip addresses
 */

module.exports = {
    // name of service
    name: "emails.blacklists",
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

            // email blacklist entities
            entities: {
                type: "array",
                required: false,
                default: [],
                populate: {
                    action: "v2.emails.blacklists.entities.get"
                }
            },

            // email blacklist reason
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
        /**
         * lookup email address in blacklists
         * 
         * @actions
         * @param {String} address - email address id to lookup
         * 
         * @returns {Object} - blacklist entity
         */
        address: {
            params: {
                address: {
                    type: "string",
                    required: true,
                }
            },
            async handler(ctx) {
                // get address
                const address = await ctx.call("v2.emails.addresses.get", {
                    id: ctx.params.address,
                });
                return ctx.call("v2.emails.blacklists.entities.lookupEmail", {
                    address: address.address,
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

    }

}


