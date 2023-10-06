const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");
const { Context } = require("moleculer");
const { MoleculerClientError } = require("moleculer").Errors;


/**
 * this is the email account service
 */

module.exports = {
    // name of service
    name: "emails.mailboxs.messages",
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
            permissions: 'emails.mailboxs.messages'
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

            // message uid
            uid: {
                type: "string",
                required: true,
            },

            // message flags
            flags: {
                type: "array",
                required: false,
                default: [],
                items: "string"

            },

            // modseq
            modseq: {
                type: "number",
                required: true,
            },

            //idate - internal date
            idate: {
                type: "number",
                required: true,
            },

            // mimeTree - mime tree
            mimeTree: {
                type: "object",
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
         * flag message
         * 
         * @actions
         * @param {String} uid - message uid to flag
         * @param {String} flag - flag to set
         * 
         * @returns {Object} flagged message
         */
        flag: {
            params: {
                uid: {
                    type: "string",
                    required: true,
                },
                flag: {
                    type: "string",
                    required: true,
                },
            },
            async handler(ctx) {
                const { uid, flag } = ctx.params;

                // get message
                const message = await this.getMessage(ctx, uid);

                // check if flag is already set
                if (message.flags.includes(flag)) {
                    return message;
                }

                // add flag
                await this.updateEntity(ctx, {
                    id: message.id,
                    flags: [...message.flags, flag]
                });

                // return message
                return this.getMessage(ctx, uid);
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
        /**
         * get message by uid
         * 
         * @param {Context} ctx - context of request
         * @param {String} uid - message uid
         * 
         * @returns {Object} message
         */
        async getMessage(ctx, uid) {
            const entity = await this.findEntity(null, {
                query: {
                    uid: uid,
                }
            });
            if (!entity) {
                throw new MoleculerClientError("message not found", 404);
            }
            return entity;
        }
    }

}


