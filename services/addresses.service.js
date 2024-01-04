const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");

const { MoleculerClientError, MoleculerServerError } = require("moleculer").Errors;

const pls = require("../lib/pls.min.js")

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

            // email address domain
            domain: {
                type: "string",
                required: false,
                onCreate: function ({ ctx }) {
                    const parsed = pls.parse(ctx.params.address.split('@')[1]);
                    return parsed.domain;
                }
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
         * add mailbox to email address
         * 
         * @actions
         * @param {String} id - email address id
         * @param {String} mailbox - mailbox id
         * 
         * @returns {Object} email address
         */
        addMailbox: {
            rest: {
                method: "POST",
                path: "/:id/mailbox",
            },
            params: {
                id: {
                    type: "string",
                    optional: false,
                },
                mailbox: {
                    type: "string",
                    optional: false,
                },
            },
            async handler(ctx) {
                // get email address
                const address = await this.resolveAddress(ctx, ctx.params.id);

                // check address
                if (!address) {
                    // throw error
                    throw new MoleculerClientError("Email address not found.", 404, "ADDRESS_NOT_FOUND");
                }

                // get mailbox
                const mailbox = await ctx.call("v2.emails.mailboxes.resolve", {
                    id: ctx.params.mailbox,
                });

                // check mailbox
                if (!mailbox) {
                    // throw error
                    throw new MoleculerClientError("Mailbox not found.", 404, "MAILBOX_NOT_FOUND");
                }

                // add mailbox
                const query = {
                    id: address.id,
                    $addToSet: {
                        mailboxes: ctx.params.mailbox,
                    }
                };

                // update address
                return this.updateEntity(ctx, query, { raw: true });
            }
        },

        /**
         * remove mailbox from email address
         * 
         * @actions
         * @param {String} id - email address id
         * @param {String} mailbox - mailbox id
         * 
         * @returns {Object} email address
         */
        removeMailbox: {
            rest: {
                method: "DELETE",
                path: "/:id/mailbox",
            },
            params: {
                id: {
                    type: "string",
                    optional: false,
                },
                mailbox: {
                    type: "string",
                    optional: false,
                },
            },
            async handler(ctx) {
                // get email address
                const address = await this.resolveAddress(ctx, ctx.params.id);

                // check address
                if (!address) {
                    // throw error
                    throw new MoleculerClientError("Email address not found.", 404, "ADDRESS_NOT_FOUND");
                }

                // remove mailbox
                const query = {
                    id: address.id,
                    $pull: {
                        mailboxes: ctx.params.mailbox,
                    }
                };

                // update address
                return this.updateEntity(ctx, query, { raw: true });
            }
        },

        /**
         * block email address
         * 
         * @actions
         * @param {String} id - email address id
         * 
         * @returns {Object} email address
         */
        block: {
            rest: {
                method: "POST",
                path: "/:id/block",
            },
            params: {
                id: {
                    type: "string",
                    optional: false,
                },
            },
            async handler(ctx) {
                // get email address
                const address = await this.resolveAddress(ctx, ctx.params.id);

                // check address
                if (!address) {
                    // throw error
                    throw new MoleculerClientError("Email address not found.", 404, "ADDRESS_NOT_FOUND");
                }

                // block address
                const query = {
                    id: address.id,
                    $set: {
                        blocked: true,
                    }
                };

                // update address
                return this.updateEntity(ctx, query, { raw: true });
            }
        },

        /**
         * unblock email address
         * 
         * @actions
         * @param {String} id - email address id
         * 
         * @returns {Object} email address
         */
        unblock: {
            rest: {
                method: "POST",
                path: "/:id/unblock",
            },
            params: {
                id: {
                    type: "string",
                    optional: false,
                },
            },
            async handler(ctx) {
                // get email address
                const address = await this.resolveAddress(ctx, ctx.params.id);

                // check address
                if (!address) {
                    // throw error
                    throw new MoleculerClientError("Email address not found.", 404, "ADDRESS_NOT_FOUND");
                }

                // block address
                const query = {
                    id: address.id,
                    $set: {
                        blocked: false,
                    }
                };

                // update address
                return this.updateEntity(ctx, query, { raw: true });
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
        /**
         * on envelope created, lookup email addressess
         */
        async "emails.envelopes.created"(ctx) {
            // get envelope
            const envelope = ctx.params.data;

            // get to addresses
            const addresses = await this.resolveEntities(null, {
                id: envelope.to,
            });

            // check addresses for mailboxes
            const mailboxes = addresses.filter((address) => {
                return address.mailboxes.length > 0;
            });

            // check mailboxes
            this.logger.info("Mailboxes", mailboxes);

        },

    },

    /**
     * service methods
     */
    methods: {
        /**
         * resolve email address by id
         * 
         * @param {Context} ctx - molecularjs context
         * @param {String} id - email address id
         * 
         * @returns email address
         */
        async resolveAddress(ctx, id) {
            return this.resolveEntities(null, {
                id,
            });
        },
        /**
         * get addresess by email address
         * 
         * @param {Context} ctx - molecularjs context
         * @param {String} address - email address
         * 
         * @returns {Promise}
         */
        async lookupByEmailAddress(ctx, address) {

            // normalize address
            address = this.normalize(ctx, address);

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
            address = this.normalize(ctx, address);

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
        },

        /**
         * normalize email address
         * m.784659962.3f5ada29ba85a3ae55-newsletter=email3.gog.com@emsgrid.com => email3.gog.com@emsgrid.com
         * msprvs1=19732vvyzcykd=bounces-294276@bounces.indeed.com => bounces-294276@bounces.indeed.com
         * mangoraft+caf_=no-reply=mangoraft.ca@gmail.com => mangoraft@gmail.com
         * 
         * @param {Context} ctx - context
         * @param {String} address - email address
         * 
         * @returns {String} normalized email address
         */
        normalize(ctx, address) {
            // normalize address
            address = address.toLowerCase().trim();

            // split address
            const parts = address.split('@');
            let local = parts[0];

            // check local
            if (local.indexOf('=') > -1) {
                // split local
                const splits = local.split('=');
                local = splits[0];
            }

            // check local
            if (local.indexOf('+') > -1) {
                // split local
                const splits = local.split('+');
                local = splits[0];
            }


            // return address
            return `${local}@${parts[1]}`;
        }
    },

}


