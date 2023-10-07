const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");
const { MoleculerClientError } = require("moleculer").Errors;


/**
 * this is the email account service
 */

module.exports = {
    // name of service
    name: "emails.accounts",
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
        DbService({
            permissions: 'emails.accounts'
        }),
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

            // email account username
            username: {
                type: "string",
                required: true,
                unique: true,
            },

            // email account password
            password: {
                type: "string",
                required: true,
            },

            // email account email address
            email: {
                type: "string",
                required: true,
            },

            // sender address for this account
            sender: {
                type: "string",
                required: false,
            },

            // email account smtp details
            smtp: {
                type: "object",
                required: false,
                props: {
                    host: {
                        type: "string",
                        required: false,
                    },
                    port: {
                        type: "number",
                        required: false,
                    },
                    secure: {
                        type: "boolean",
                        required: false,
                    },
                    auth: {
                        type: "object",
                        required: false,
                        props: {
                            user: {
                                type: "string",
                                required: false,
                            },
                            pass: {
                                type: "string",
                                required: false,
                            },
                        }
                    }
                }
            },

            // email account imap details
            imap: {
                type: "object",
                required: false,
                props: {
                    host: {
                        type: "string",
                        required: false,
                    },
                    port: {
                        type: "number",
                        required: false,
                    },
                    secure: {
                        type: "boolean",
                        required: false,
                    },
                    auth: {
                        type: "object",
                        required: false,
                        props: {
                            user: {
                                type: "string",
                                required: false,
                            },
                            pass: {
                                type: "string",
                                required: false,
                            },
                        }
                    }
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
        /**
         * auth account
         * 
         * @actions
         * @param {String} username - account username
         * @param {String} password - account password
         * @param {String} method - smtp auth methods
         * 
         * @returns {Object} - account
         */
        auth: {
            params: {
                username: {
                    type: "string",
                    required: true,
                },
                password: {
                    type: "string",
                    required: true,
                },
                method: {
                    type: "string",
                    enum: ['PLAIN', 'LOGIN', 'XOAUTH2'],
                    default: 'basic',
                }
            },
            permissions: ['emails.accounts.auth'],
            async handler(ctx) {
                const { username, password } = ctx.params;

                // find account
                const account = await this.findEntity(null, {
                    query: {
                        username,
                    }
                });

                // check account
                if (!account) {
                    throw new MoleculerClientError("account not found", 404);
                }

                // check password
                if (account.password !== password) {
                    throw new MoleculerClientError("invalid password", 401);
                }

                return account;
            },
        },

        /**
         * validate from address
         * 
         * @actions
         * @param {String} from - from address
         * @param {String} user - account id
         * 
         * @returns {Object} - account
         */
        validateFrom: {
            params: {
                from: {
                    type: "string",
                    required: true,
                },
                user: {
                    type: "string",
                    required: true,
                },
            },
            permissions: ['emails.accounts.validateFrom'],
            async handler(ctx) {
                const { from, user } = ctx.params;

                // find account
                const account = await this.findEntity(null, {
                    query: {
                        email: from
                    }
                });

                // check account
                if (!account) {
                    throw new MoleculerClientError("account not found", 404);
                }

                // check from
                if (account.id !== user) {
                    throw new MoleculerClientError("invalid from address", 401);
                }

                return account;
            },
        },

        // clean db
        clean: {
            async handler(ctx) {

                const entities = await this.findEntities(null, {});
                this.logger.info(`cleaning ${entities.length} entities`);
                // loop entities
                for (let index = 0; index < entities.length; index++) {
                    const entity = entities[index];

                    await this.removeEntity(ctx, {
                        id: entity.id
                    });
                }

            },
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


