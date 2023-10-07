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
            },

            // mailbox address
            address: {
                type: "string",
                required: true,
            },

            // email mailbox messages
            messages: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v1.emails.messages.resolve",
                }
            },

            // mailbox is alias
            isAlias: {
                type: "boolean",
                required: false,
                default: false,
            },

            // mailbox alias 
            alias: {
                type: "string",
                required: false,
                default: null,
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


