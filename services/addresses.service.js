const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");

const { MoleculerClientError, MoleculerServerError } = require("moleculer").Errors;


/**
 * This service keeps track of email addresses.  It is used to prevent spamming and
 * to keep track of who is sending emails.
 */

module.exports = {
    // name of service
    name: "emails.addresses",
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

            // email address name
            name: {
                type: "string",
                required: false,
            },

            // email address
            address: {
                type: "string",
                required: true,
            },

            // email address description
            description: {
                type: "string",
                required: false,
            },

            // email address status
            status: {
                type: "string",
                required: true,
                default: "active",
                enum: [
                    "active",
                    "inactive",
                    "banned",
                ]
            },

            // first seen date
            firstSeen: {
                type: "number",
                required: false,
                readonly: true,
                default: Date.now,
            },

            // last seen date
            lastSeen: {
                type: "number",
                required: false,
                readonly: true,
                default: Date.now,
            },

            // email address tags
            tags: {
                type: "array",
                required: false,
                default: [],
                items: "string",
            },

            // email address flags
            flags: {
                type: "array",
                required: false,
                default: [],
                items: "string",
            },

            // email address messages
            messages: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.messages.get",
                }
            },

            // email address mailboxes
            mailboxes: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.mailboxes.get",
                }
            },

            // email address accounts
            accounts: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.accounts.get",
                }
            },

            // email address attachments
            attachments: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.attachments.get",
                }
            },

            // email address contacts
            contacts: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.contacts.get",
                }
            },

            // email address envelopes
            envelopes: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.envelopes.get",
                }
            },

            // address valid
            valid: {
                type: "boolean",
                required: false,
                default: true,
            },

            // address active
            active: {
                type: "boolean",
                required: false,
                default: true,
            },

            // address blocked
            blocked: {
                type: "boolean",
                required: false,
                default: false,
            },

            // address reason
            reason: {
                type: "string",
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
         * lookup email address
         * 
         * @actions
         * @param {String} address - email address
         * 
         * @returns {Object} email address
         */
        lookup: {
            params: {
                address: {
                    type: "string",
                    required: true,
                },
            },
            async handler(ctx) {
                return this.lookup(ctx.params.address);
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
        /**
         * lookup email address
         * 
         * @param {Context} ctx - context
         * @param {String} address - email address
         * 
         * @returns {Object} email address
         */
        async lookup(ctx, address) {
            // find email address
            const result = await this.findEntity(null, {
                query: { address: address, }
            });

            // check result
            if (!result) {
                // lookup email address in blacklists service
                const blacklist = await ctx.call("v2.emails.blacklists.lookupEmail", {
                    address: address,
                });

                // check blacklist
                if (blacklist) {
                    // create email address entity in database from address and block it.
                    const result = await this.createEntity(ctx, {
                        name: blacklist.name,
                        address: address,
                        status: "banned",
                        blocked: true,
                        reason: blacklist.reason,
                    });

                    return result;
                }
            }

            // return result
            return result;
        }
    },

}


