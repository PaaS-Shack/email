const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");

const { MoleculerClientError, MoleculerServerError } = require("moleculer").Errors;


/**
 * This is the service for storing email attachments.
 * When a new email is received, the attachments are stored in s3 and the metadata is stored in this service
 */

module.exports = {
    // name of service
    name: "emails.attachments",
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

            // email attachment envelope id
            envelope: {
                type: "string",
                required: true,
                populate: {
                    action: "v2.emails.envelopes.get",
                }
            },

            // email attachment name
            name: {
                type: "string",
                required: true
            },

            // email attachment size
            size: {
                type: "number",
                required: true
            },

            // email attachment mime type
            mime: {
                type: "string",
                required: true
            },

            // email attachment hash
            hash: {
                type: "string",
                required: true
            },

            // email attachment s3 key
            key: {
                type: "string",
                required: true
            },

            // email attachment s3 bucket
            bucket: {
                type: "string",
                required: true
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


