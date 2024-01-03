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

            // email address type
            type: {
                type: "string",
                required: false,
                default: "mailbox",
                enum: [
                    "mailbox",
                    "alias",
                    "forward",
                    "from",
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

            // email address blocked
            blocked: {
                type: "boolean",
                required: false,
                default: false,
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
         * lookup email address, if address not found then create new one.
         * 
         * @actions
         * @param {String} address - email address
         * @param {String} name - email address name
         * 
         * @returns {Object} email address
         */
        lookup: {
            rest: {
                method: "GET",
                path: "/lookup/:address",
            },
            params: {
                address: {
                    type: "string",
                    optional: false,
                },
                name: {
                    type: "string",
                    optional: true,
                },
            },
            async handler(ctx) {
                return this.lookup(ctx, ctx.params.address, ctx.params.name);
            }
        },
        /**
         * lookup addresess by email address
         * 
         * @actions
         * @param {String} address - email address
         * 
         * @returns {Array} email addresess
         */
        lookupByEmailAddress: {
            rest: {
                method: "GET",
                path: "/address/:address",
            },
            params: {
                address: {
                    type: "string",
                    optional: false,
                },
            },
            async handler(ctx) {
                return this.lookupByEmailAddress(ctx, ctx.params.address);
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
        /**
         * get addresess by email address
         * 
         * @param {Context} ctx - molecularjs context
         * @param {String} address - email address
         * 
         * @returns {Promise}
         */
        async lookupByEmailAddress(ctx, address) {
            // split address for wildcard
            const hostname = address.split('@')[1];
            const wildcard = `*@${hostname}`;

            // query
            const query = {
                $or: [
                    { address: address },
                    { address: wildcard }
                ],
                type: "mailbox",
            };

            return this.findEntities(null, {
                query,
            }, { raw: true });
        },

        /**
         * lookup email address
         * 
         * @param {Context} ctx - context
         * @param {String} address - email address
         * 
         * @returns {Object} email address
         */
        async lookup(ctx, address, name) {

            // normalize address
            address = address.toLowerCase().trim();

            // find email address
            const result = await this.findEntity(null, {
                query: { address: address, }
            });

            // check result
            if (!result) {
                // create new email address
                const newAddress = await this.createEntity(ctx, {
                    address: address,
                    name: name,
                    type: "from",
                });

                // check new address
                if (!newAddress) {
                    // throw error
                    throw new MoleculerServerError("Unable to create email address.");
                }

                // return new address
                return newAddress;
            }

            // return result
            return result;
        }
    },

}


