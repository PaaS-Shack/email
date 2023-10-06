const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");
const { MoleculerClientError } = require("moleculer").Errors;


/**
 * This is the email mailboxs service 
 * Used by imap service
 */

module.exports = {
    // name of service
    name: "emails.mailboxs",
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
            permissions: 'emails.mailboxs',
            createActions: false
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

            // email mailbox mailbox
            mailbox: {
                type: "string",
                required: true,
            },

            // email mailbox path
            path: {
                type: "string",
                required: true,
            },

            // user id
            user: {
                type: "string",
                required: true,
            },

            // email mailbox uidValidity
            uidValidity: {
                type: "number",
                required: false,
                default: 5000
            },

            // email mailbox uidnext
            uidNext: {
                type: "number",
                required: false,
                default: 1,
            },

            // email mailbox modifyIndex
            modifyIndex: {
                type: "number",
                required: false,
                default: 0,
            },

            // email mailbox specialUse
            specialUse: {
                type: "string",
                required: false,
                default: '',
            },

            // email mailbox messages
            messages: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v1.emails.mailboxs.messages.resolve",
                }
            },

            // email mailbox journal
            journal: {
                type: "array",
                required: false,
                default: [],
                items: "string"
            },

            // email mailbox flags
            flags: {
                type: "array",
                required: false,
                default: [],
                items: "string"
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
         * lookup mailbox by mailbox and user id
         * 
         * @actions
         * @param {String} mailbox - mailbox mailbox
         * @param {String} user - user id
         * @param {Boolean} populate - populate messages
         * 
         * @returns {Object} mailbox - mailbox object
         */
        lookup: {
            params: {
                mailbox: {
                    type: "string",
                    empty: false,
                },
                user: {
                    type: "string",
                    empty: false,
                },
                populate: {
                    type: "boolean",
                    optional: true,
                    default: false,
                },
            },
            async handler(ctx) {
                const { mailbox, user, populate } = ctx.params;

                const query = {
                    query: {
                        mailbox,
                        user: user
                    }
                }
                if (populate) {
                    query.populate = ['messages']
                }

                const folder = await this.findEntity(null, query);

                return folder;
            }
        },
        /**
         * create mailbox
         * 
         * @actions
         * @param {String} mailbox - mailbox mailbox
         * @param {String} path - mailbox path
         * @param {String} user - user id
         * 
         * @returns {Object} mailbox - mailbox object
         */
        create: {
            params: {
                mailbox: {
                    type: "string",
                    empty: false,
                },
                path: {
                    type: "string",
                    empty: false,
                },
                user: {
                    type: "string",
                    empty: false,
                },
            },
            async handler(ctx) {
                const { mailbox, path, user } = ctx.params;

                const found = await this.actions.lookup({
                    mailbox,
                    user
                });

                if (found) {
                    throw new MoleculerClientError("mailbox already exists", 422, "", [{
                        field: "name",
                        message: "mailbox already exists"
                    }]);
                }

                const folder = await this.createEntity(ctx, {
                    mailbox,
                    path,
                    user,
                });

                return folder;
            }
        },

        /**
         * rename mailbox
         * 
         * @actions
         * @param {String} id - mailbox id
         * @param {String} mailbox - mailbox mailbox
         * @param {String} path - mailbox path
         * @param {String} user - user id
         * 
         * @returns {Object} mailbox - mailbox object
         */
        rename: {
            params: {
                id: {
                    type: "string",
                    empty: false,
                },
                mailbox: {
                    type: "string",
                    empty: false,
                },
                newname: {
                    type: "string",
                    optional: true,
                },
                user: {
                    type: "string",
                    empty: false,
                },
            },
            async handler(ctx) {
                const { id, mailbox, newname, user } = ctx.params;

                // lookup mailbox
                const folder = await this.actions.lookup({
                    mailbox,
                    user
                });

                // if mailbox exists
                if (folder) {
                    throw new MoleculerClientError("mailbox already exists", 422, "", [{
                        field: "name",
                        message: "mailbox already exists"
                    }]);
                }

                const update = {
                    id: folder.id,
                    mailbox: newname,
                };

                // update mailbox
                const updated = await this.updateEntity(ctx, update);

                return updated;
            }
        },

        /**
         * remove mailbox
         * 
         * @actions
         * @param {String} id - mailbox id
         * @param {String} user - user id
         * 
         * @returns {Object} mailbox - mailbox object
         */
        remove: {
            params: {
                id: {
                    type: "string",
                    empty: false,
                },
            },
            async handler(ctx) {
                const { id } = ctx.params;

                await this.removeEntity(ctx, {
                    id,
                });

                return true;
            }
        },

        /**
         * append message to mailbox
         * 
         * @actions
         * @param {String} mailbox - mailbox mailbox 
         * @param {String} user - user id
         * @param {Object} message - message object
         * @param {Array} flags - message flags
         * @param {String} data - message data
         * 
         * @returns {Object} mailbox - mailbox object
         */
        append: {
            params: {
                mailbox: {
                    type: "string",
                    empty: false,
                },
                user: {
                    type: "string",
                    empty: false,
                },
                message: {
                    type: "object",
                    empty: false,
                },
                flags: {
                    type: "array",
                    empty: false,
                    items: "string"
                },
                data: {
                    type: "string",
                    empty: false,
                },
            },
            async handler(ctx) {
                const { mailbox, user, message, flags, data } = ctx.params;

                // lookup mailbox
                const folder = await this.actions.lookup({
                    mailbox,
                    user
                });

                // if mailbox not exists
                if (!folder) {
                    throw new MoleculerClientError("mailbox not exists", 422, "", [{
                        field: "name",
                        message: "mailbox not exists"
                    }]);
                }

                //create new message
                const messageEntity = await ctx.call('v1.emails.imap.messages.create', {

                });

                // update mailbox
                const updated = await this.updateEntity(ctx, {
                    id: folder.id,
                    messages: [...mailbox.messages, messageEntity.id],
                });

                return true;
            }
        },

        /**
         * list mailboxs
         * 
         * @actions
         * @param {String} user - user id
         * 
         * @returns {Array} mailboxs - mailboxs array
         */
        list: {
            params: {
                user: {
                    type: "string",
                    empty: false,
                },
            },
            async handler(ctx) {
                const { user } = ctx.params;

                return this.findEntities(ctx, {
                    query: {
                        user,
                    }
                });
            }
        },
        /**
         * update mailbox path
         * 
         * @actions
         * @param {String} mailbox - mailbox mailbox
         * @param {String} user - user id
         * @param {String} path - mailbox path
         * 
         * @returns {Object} mailbox - mailbox object
         */
        updatePath: {
            params: {
                mailbox: {
                    type: "string",
                    empty: false,
                },
                user: {
                    type: "string",
                    empty: false,
                },
                path: {
                    type: "string",
                    empty: false,
                },
            },
            async handler(ctx) {
                const { mailbox, user, path } = ctx.params;

                const folder = await this.actions.lookup({
                    mailbox,
                    user
                });

                // if mailbox not exists
                if (!folder) {
                    throw new MoleculerClientError("mailbox not exists", 422, "", [{
                        field: "name",
                        message: "mailbox not exists"
                    }]);
                }

                // update mailbox
                const updated = await this.updateEntity(ctx, {
                    id: folder.id,
                    path,
                });

                return true;
            }
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


