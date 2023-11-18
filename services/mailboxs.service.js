const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");
const { MoleculerClientError } = require("moleculer").Errors;


/**
 * this is the email mailboxs service 
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
            name: {
                type: "string",
                required: true,
                empty: false,
                description: "email mailbox name",
            },

            // email parts
            parts:{
                local:{
                    type:"string",
                    required:true,
                    description:"local part of email address"
                },
                domain:{
                    type:"string",
                    required:true,
                    description:"domain part of email address"
                },
            },

            // email mailbox alias
            alias: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                description: "email mailbox alias",
            },

            // email mailbox send as alias
            sender: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                description: "email mailbox send as alias",
            },

            // email mailbox forward
            forward: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                description: "email mailbox forward",
            },

            // email mailbox quota
            quota: {
                type: "number",
                required: false,
                default: 0,
                description: "email mailbox quota",
            },

            // email mailbox quota used
            quotaUsed: {
                type: "number",
                required: false,
                default: 0,
                description: "email mailbox quota used",
            },

            // mailbox signature
            signature: {
                type: "string",
                required: false,
                default: "",
                description: "mailbox signature",
            },

            // mailbox auto reply
            autoReply: {
                type: "boolean",
                required: false,
                default: false,
                description: "mailbox auto reply",
            },

            // mailbox auto reply message
            autoReplyMessage: {
                type: "string",
                required: false,
                default: "",
                description: "mailbox auto reply message",
            },


            // mailbox read only
            readOnly: {
                type: "boolean",
                required: false,
                default: false,
                description: "mailbox read only",
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


