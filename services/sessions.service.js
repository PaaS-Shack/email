const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");

const { MoleculerClientError, MoleculerServerError } = require("moleculer").Errors;


/**
 * This service keeps track of email inbound smtp sessions.  It is used to prevent spamming.
 */

module.exports = {
    // name of service
    name: "emails.sessions",
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

            // session remoteAddress
            remoteAddress: {
                type: "string",
                required: true,
            },

            // session clientHostname
            clientHostname: {
                type: "string",
                required: false,
            },

            // session from addresses
            from: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.addresses.get",
                }
            },

            // session to addresses
            to: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.addresses.get",
                }
            },

            // session envelopes
            envelopes: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.envelopes.get",
                }
            },

            // session blacklist entities
            blacklists: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.blacklists.get",
                }
            },

            // session is closed
            closed: {
                type: "boolean",
                required: false,
                default: false,
            },

            // session open count
            openCount: {
                type: "number",
                required: false,
                default: 0,
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
         * add from address
         * 
         * @actions
         * @param {String} id - session id
         * @param {String} address - address id
         * 
         * @returns {Object} session - session object
         */
        addFrom: {
            params: {
                id: {
                    type: "string",
                    optional: false,
                },
                address: {
                    type: "string",
                    optional: false,
                },
            },
            async handler(ctx) {
                // get session
                const session = await this.getSessions(ctx, ctx.params.id);

                // check session
                if (!session) {
                    // throw error
                    throw new MoleculerClientError("Session not found", 404, "SESSION_NOT_FOUND", { id: ctx.params.id });
                }

                // get address
                const address = await ctx.call("v2.emails.addresses.resolve", {
                    id: ctx.params.address,
                });

                // check address
                if (!address) {
                    // throw error
                    throw new MoleculerClientError("Address not found", 404, "ADDRESS_NOT_FOUND", { address: ctx.params.address });
                }

                const query = {
                    id: session.id,
                    $push: {
                        from: address.id,
                    }
                };

                // update session
                const update = await this.updateEntity(ctx, query);

                // return session
                return update;
            },
        },

        /**
         * add to address
         * 
         * @actions
         * @param {String} id - session id
         * @param {String} address - address id
         * 
         * @returns {Object} session - session object
         */
        addTo: {
            params: {
                id: {
                    type: "string",
                    optional: false,
                },
                address: {
                    type: "string",
                    optional: false,
                },
            },
            async handler(ctx) {
                // get session
                const session = await this.getSessions(ctx, ctx.params.id);

                // check session
                if (!session) {
                    // throw error
                    throw new MoleculerClientError("Session not found", 404, "SESSION_NOT_FOUND", { id: ctx.params.id });
                }

                // get address
                const address = await ctx.call("v2.emails.addresses.resolve", {
                    id: ctx.params.address,
                });

                // check address
                if (!address) {
                    // throw error
                    throw new MoleculerClientError("Address not found", 404, "ADDRESS_NOT_FOUND", { address: ctx.params.address });
                }

                const query = {
                    id: session.id,
                    $push: {
                        to: address.id,
                    }
                };

                // update session
                const update = await this.updateEntity(ctx, query);

                // return session
                return update;
            },
        },

        /**
         * add envelope
         * 
         * @actions
         * @param {String} id - session id
         * @param {String} envelope - envelope id
         * 
         * @returns {Object} session - session object
         */
        addEnvelope: {
            params: {
                id: {
                    type: "string",
                    optional: false,
                },
                envelope: {
                    type: "string",
                    optional: false,
                },
            },
            async handler(ctx) {
                // get session
                const session = await this.getSessions(ctx, ctx.params.id);

                // check session
                if (!session) {
                    // throw error
                    throw new MoleculerClientError("Session not found", 404, "SESSION_NOT_FOUND", { id: ctx.params.id });
                }

                // get envelope
                const envelope = await ctx.call("v2.emails.envelopes.resolve", {
                    id: ctx.params.envelope,
                });

                // check envelope
                if (!envelope) {
                    // throw error
                    throw new MoleculerClientError("Envelope not found", 404, "ENVELOPE_NOT_FOUND", { envelope: ctx.params.envelope });
                }

                const query = {
                    id: session.id,
                    $push: {
                        envelopes: envelope.id,
                    }
                };

                // update session
                const update = await this.updateEntity(ctx, query);

                // return session
                return update;
            }
        },

        /**
         * session close event
         * 
         * @actions
         * @param {String} id - session id
         * 
         * @returns {Object} session - session object
         */
        close: {
            params: {
                id: {
                    type: "string",
                    optional: false,
                },
            },
            async handler(ctx) {
                // get session
                const session = await this.getSessions(ctx, ctx.params.id);

                // check session
                if (!session) {
                    // throw error
                    throw new MoleculerClientError("Session not found", 404, "SESSION_NOT_FOUND", { id: ctx.params.id });
                }

                // update session
                const update = await this.updateEntity(ctx, {
                    id: session.id,
                    closed: true,
                });



                // return session
                return update;
            }
        },

        /**
         * open session
         * 
         * @actions
         * @param {String} remoteAddress - remote address
         * @param {String} clientHostname - client hostname
         * 
         * @returns {Object} session - session object
         */
        open: {
            params: {
                remoteAddress: {
                    type: "string",
                    optional: false,
                },
                clientHostname: {
                    type: "string",
                    optional: false,
                },
            },
            async handler(ctx) {
                // get session
                const session = await this.resolveSession(ctx, ctx.params.remoteAddress, ctx.params.clientHostname);

                if (session.closed) {
                    // update session
                    await this.updateEntity(ctx, {
                        id: session.id,
                        closed: false,
                    });
                }

                // inc open count
                const query = {
                    id: session.id,
                    $inc: {
                        openCount: 1,
                    }
                };

                return await this.updateEntity(ctx, query, { raw: true });
            }
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
         * resolve session
         * 
         * @param {Object} ctx - context
         * @param {String} remoteAddress - remote address
         * @param {String} clientHostname - client hostname
         * 
         * @returns {Object} session - session object
         */
        async resolveSession(ctx, remoteAddress, clientHostname) {
            // resolve session
            let session = await this.findEntity(null, {
                query: {
                    remoteAddress,
                    clientHostname,
                }
            });

            // check session
            if (!session) {
                // create session
                session = await this.createSession(ctx, {
                    remoteAddress,
                    clientHostname,
                });
            }

            // return session
            return session;
        },
        /**
         * get sessions
         * 
         * @param {Object} ctx - context
         * @param {String} id - session id
         * 
         * @returns {Object} session - session object
         */
        async getSessions(ctx, id) {
            // get session
            const session = await this.resolveEntities(ctx, {
                id,
            });

            // return session
            return session;
        },

        /**
         * create session
         * 
         * @param {Object} ctx - context
         * @param {Object} params - session params
         * 
         * @returns {Object} session - session object
         */
        async createSession(ctx, params) {
            // create session
            const session = await this.createEntity(ctx, {
                ...params,
            });

            // return session
            return session;
        },

        /**
         * resolve dns
         * 
         * @param {Object} ctx - context
         * @param {String} host - hostname
         * 
         * @returns {String} address - address
         */
        async resolveDNS(ctx, host) {
            // resolve dns
            const addresses = await ctx.call("v1.utils.dns.resolve", {
                host,
            }).catch((err) => {
                // return host
                return [];
            });

            // return first address
            return addresses[0];
        },

        /**
         * reverse dns
         * 
         * @param {Object} ctx - context
         * @param {String} ip - address
         * 
         * @returns {String} host - hostname
         */
        async reverseDNS(ctx, address) {
            // reverse dns
            const hostnames = await ctx.call("v1.utils.dns.reverse", {
                ip,
            }).catch((err) => {
                // return address
                return [];
            });

            // return first hostname
            return hostnames[0];
        },
    }
};


