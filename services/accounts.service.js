const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");

const { MoleculerClientError, MoleculerServerError } = require("moleculer").Errors;

const crypto = require("crypto");
const bcrypt = require("bcrypt");

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
                min: 6,
                max: 60,
                onCreate: function ({ params }) {
                    // hash password
                    return bcrypt.hash(params.password, this.config["emails.accounts.passwordIterations"]);
                }
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
        /**
         * authenticate account
         * 
         * @actions
         * @param {String} username - username
         * @param {String} password - password
         * 
         * @returns {Object} account - account object
         */
        authenticate: {
            params: {
                username: {
                    type: "string",
                    optional: false,
                },
                password: {
                    type: "string",
                    optional: false,
                },
            },
            async handler(ctx) {
                // get account
                const account = await this.findEntity(null, {
                    query: {
                        username: ctx.params.username,
                    },
                    fields: ['id', 'username', 'password'],
                });

                // check account
                if (!account) {
                    throw new MoleculerClientError("Account not found!", 404);
                }

                // check password
                const password = await bcrypt.compare(ctx.params.password, account.password);
                if (!password) {
                    throw new MoleculerClientError("Wrong password!", 422);
                }

                // return account
                return this.resolveEntities(null, { id: account.id });
            }
        },

        /**
         * clean sessions remove all
         * 
         * @actions
         * 
         * @returns {Number} sessions - deleted sessions count
         */
        clean: {
            async handler(ctx) {
                // clean sessions
                const sessions = await this.findEntities(null, {
                    fields: ['id']
                });

                const promises = sessions.map((session) => {
                    return this.removeEntity(ctx, {
                        id: session.id,
                    });
                });

                // return sessions
                return Promise.all(promises);
            }
        }
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


