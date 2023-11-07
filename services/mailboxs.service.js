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
            //createActions: false
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

            // email mailbox name
            name: {
                type: "string",
                required: true,
                trim: true,
            },

            // mailbox username
            username: {
                type: "string",
                required: true,
                trim: true,
            },

            // mailbox domain
            domain: {
                type: "string",
                required: true,
                trim: true,
            },

            // mailbox type
            type: {
                type: "string",
                required: false,
                default: 'inbox',
                enum: [
                    'inbox',
                    'sent',
                    'drafts',
                    'trash',
                    'spam',
                    'archive',
                    'junk',
                    'custom',
                ]
            },

            // mailbox flags
            flags: {
                type: "array",
                items: "string",
                required: false,
                default: [],
            },

            // mailbox messages
            messages: {
                type: "array",
                items: "string",
                required: false,
                default: []
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
         * add message id to mailbox
         * 
         * @actions
         * @param {String} id - mailbox id
         * @param {String} message - message id
         * 
         * @returns {Object} mailbox
         */
        addMessage: {
            rest: {
                method: "PUT",
                path: "/:id/messages/:message",
            },
            params: {
                id: {
                    type: "string",
                    required: true,
                },
                message: {
                    type: "string",
                    required: true,
                },
            },
            async handler(ctx) {
                const { id, message } = ctx.params;
                // get mailbox
                const mailbox = await this.resolveEntities(ctx, {
                    id
                });
                // add message
                mailbox.messages.push(message);
                // save mailbox
                return this.updateEntity(ctx, {
                    id,
                    messages: mailbox.messages
                });
            },
        },

        /**
         * remove message id from mailbox
         * 
         * @actions
         * @param {String} id - mailbox id
         * @param {String} message - message id
         * 
         * @returns {Object} mailbox
         */
        removeMessage: {
            rest: {
                method: "DELETE",
                path: "/:id/messages/:message",
            },
            params: {
                id: {
                    type: "string",
                    required: true,
                },
                message: {
                    type: "string",
                    required: true,
                },
            },
            async handler(ctx) {
                const { id, message } = ctx.params;
                // get mailbox
                const mailbox = await this.resolveEntities(ctx, {
                    id
                });
                // remove message
                mailbox.messages = mailbox.messages.filter(msg => msg != message);
                // save mailbox
                return this.updateEntity(ctx, {
                    id,
                    messages: mailbox.messages
                });
            },
        },

        /**
         * get mailbox message by id
         * 
         * @actions
         * @param {String} id - mailbox id
         * @param {String} message - message id
         * 
         * @returns {Object} mailbox
         */
        getMessage: {
            rest: {
                method: "GET",
                path: "/:id/messages/:message",
            },
            params: {
                id: {
                    type: "string",
                    required: true,
                },
                message: {
                    type: "string",
                    required: true,
                },
            },
            async handler(ctx) {
                const { id, message } = ctx.params;
                // get mailbox
                const mailbox = await this.resolveEntities(ctx, {
                    id
                });

                // check message
                if (!mailbox.messages.includes(message)) {
                    throw new MoleculerClientError("message not found", 404);
                }

                // get message
                return ctx.call('v1.emails.messages.get', {
                    id: message
                });
            },
        },

        /**
         */

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


