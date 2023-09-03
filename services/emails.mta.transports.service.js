
const DbService = require("db-mixin");
const ConfigLoader = require("config-mixin");
const { MoleculerClientError } = require("moleculer").Errors;

/**
 * This is the service responsible for storing the email transports
 * over time we will have multiple transports, smtp, sendgrid, mailgun, etc...
 *  
 */
module.exports = {
    name: "emails.mta.transports",
    version: 1,

    mixins: [
        DbService({}),
    ],

    /**
     * Service dependencies
     */
    dependencies: [],

    /**
     * Service settings
     */
    settings: {
        rest: true,// enable rest api


        fields: {
            //DB fields that fit the mailparser schema

            // transport name
            name: {
                type: "string",
                required: true,
            },
            // transport type
            type: {
                type: "string",
                enum: [
                    "smtp", "sendgrid", "mailgun",
                ],
                default: "smtp",
                index: true,
                required: true,
            },
            // transport host
            host: {
                type: "string",
                required: true,
            },
            // transport port
            port: {
                type: "number",
                required: true,
                default: 587,
            },
            // transport secure
            secure: {
                type: "boolean",
                required: true,
                default: false,
            },
            // transport auth user
            authUser: {
                type: "string",
                required: false,
            },
            // transport auth pass
            authPass: {
                type: "string",
                required: false,
            },
            // transport auth api key
            authApiKey: {
                type: "string",
                required: false,
            },
            // transport auth domain
            authDomain: {
                type: "string",
                required: false,
            },
            // transport auth secret
            authSecret: {
                type: "string",
                required: false,
            },
            // transport auth token
            authToken: {
                type: "string",
                required: false,
            },
            // transport auth key pair stored in the certificate service
            authPublicPrivateKey: {
                type: "string",
                required: false,
                populate: {// populated by the certificate service
                    action: "v1.certificates.resolve",
                },
            },

            ...DbService.FIELDS,// inject dbservice fields
        },

        // default database populates
        defaultPopulates: [],

        // database scopes
        scopes: {
            ...DbService.SCOPE,// inject dbservice scope
        },

        // default database scope
        defaultScopes: [...DbService.DSCOPE],// inject dbservice dscope

        // default init config settings
        config: {

        }
    },

    /**
     * Actions
     */
    actions: {
        /**
         * lookup a transport by name
         * 
         * @actions
         * @param {String} name - transport name
         * 
         * @returns {Object} transport object
         */
        lookup: {
            params: {
                name: {
                    type: "string",
                    required: true,
                },
            },
            permissions: ["emails.mta.transports.lookup"],
            async handler(ctx) {
                const { name } = ctx.params;
                const transport = await this.findEntity({
                    query: {
                        name,
                    },
                });
                if (!transport) {
                    throw new MoleculerClientError("Transport not found", 404);
                }
                return transport;
            }
        },


    },

    /**
     * Events
     */
    events: {

    },

    /**
     * Methods
     */
    methods: {

    },

    /**
     * Service created lifecycle event handler
     */
    created() { },

    /**
     * Service started lifecycle event handler
     */
    started() {

    },

    /**
     * Service stopped lifecycle event handler
     */
    stopped() {

    }
};