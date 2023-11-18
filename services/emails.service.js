const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");
const { Context } = require("moleculer");
const { MoleculerClientError } = require("moleculer").Errors;

const uuid = require("uuid");


/**
 * this is the email store service
 * every email inbound and outbound is stored here
 * 
 * raw emails are stored in s3 or local disk
 * entity.id is the s3 or local disk file name
 * other services can access the raw email by calling this service
 * this service also stores the email metadata in the database
 * and controls email state and status
 * 
 */

module.exports = {
    // name of service
    name: "emails.store",
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
        ])
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

            // email account id
            account: {
                type: "string",
                required: true,
                populate: {
                    action: "v1.emails.accounts.get",
                },
                description: "email account id",
            },

            // email mailbox name
            mailbox: {
                type: "string",
                required: true,
                empty: false,
                description: "email mailbox name",
            },

            // email uid
            uid: {
                type: "string",
                required: false,
                description: "email uid",
                onCreate: uuid.v4
            },

            // email subject
            subject: {
                type: "string",
                required: true,
                description: "email subject",
            },

            // email from
            from: {
                type: "array",
                required: true,
                default: [],
                items: "string",
                description: "email from",
            },

            // email to
            to: {
                type: "array",
                required: true,
                default: [],
                items: "string",
                description: "email to",
            },

            // email state processing
            state: {
                type: "string",
                required: true,
                enum: [
                    "queued",
                    "processing",
                    "processed",
                    "failed",
                    "sending",
                    "sent",
                    "received",
                    "error",
                ],
                description: "email state",
            },

            // email has raw
            hasRaw: {
                type: "boolean",
                required: true,
                default: false,
                description: "email has raw copy",
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
         * get email by uid
         * 
         * @actions
         * @param {String} uid - email uid
         * 
         * @returns {Object} - email
         */
        getByUid: {
            rest: {
                method: "GET",
                path: "/:uid"
            },
            params: {
                uid: {
                    type: "string",
                    required: true
                }
            },
            async handler(ctx) {
                const params = Object.assign({}, ctx.params);
                return this.getByUid(ctx, params.uid);
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
         * get email
         * 
         * @param {Context} ctx - context of service
         * @param {String} id - email id
         * 
         * @returns {Object} - email
         */
        async getById(ctx, id) {
            // get email
            return this.resolveEntities(ctx, {
                id: id
            });
        },

        /**
         * get email by uid
         * 
         * @param {Context} ctx - context of service
         * @param {String} uid - email uid
         * 
         * @returns {Object} - email
         */
        async getByUid(ctx, uid) {
            // get email
            return this.findEntity(ctx, {
                query: {
                    uid: uid
                }
            });
        },

        /**
         * set email state
         * 
         * @param {Context} ctx - context of service
         * @param {String} id - email id
         * @param {String} state - email state
         * 
         * @returns {Object} - email
         */
        async setState(ctx, id, state) {
            // get email
            return this.updateEntity(ctx, {
                id: id,
                state: state
            })
        },

        /**
         * get email raw
         * 
         * @param {Context} ctx - context of service
         * @param {String} id - email id
         * 
         * @returns {Object} - email
         */
        async getRaw(ctx, id) {
            // get email
            const email = await this.getById(ctx, id);

            // if email has raw
            if (email.hasRaw) {
                // get raw
                return this.broker.call("v1.emails.raws.get", {
                    id: id
                })
            }

            // throw error
            throw new MoleculerClientError("email has no raw", 404, "ERR_EMAIL_NO_RAW", {
                id: id
            });
        }
    },

}


