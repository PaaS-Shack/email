const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");

const { MoleculerClientError, MoleculerServerError } = require("moleculer").Errors;


/**
 * This is the envelope service for long term storage of emails
 * Raw emails are stored in s3 and the envelope is stored in this service
 */

module.exports = {
    // name of service
    name: "emails.envelopes",
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

            // email envelope smtp session id
            session: {
                type: "string",
                required: true,
                populate:{
                    action: "v2.emails.sessions.get",
                }
            },

            // email envelope from address
            from: {
                type: "string",
                required: true,
                populate:{
                    action: "v2.emails.addresses.get",
                }
            },

            // email envelope to addresses
            to: {
                type: "array",
                required: true,
                populate:{
                    action: "v2.emails.addresses.get",
                }
            },

            // email envelope s3 bucket
            bucket: {
                type: "string",
                required: true,
            },

            // email envelope s3 key
            key: {
                type: "string",
                required: true,
            },

            // email envelope size
            size: {
                type: "number",
                required: true,
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


