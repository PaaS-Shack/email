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

            // session localAddress
            localAddress: {
                type: "string",
                required: true,
            },

            // session localPort
            localPort: {
                type: "number",
                required: true,
            },

            // session remoteAddress
            remoteAddress: {
                type: "string",
                required: true,
            },

            // session remotePort
            remotePort: {
                type: "number",
                required: true,
            },

            // session clientHostname
            clientHostname: {
                type: "string",
                required: false,
            },

            // session hostNameAppearsAs
            hostNameAppearsAs: {
                type: "string",
                required: false,
            },

            // session openingCommand
            openingCommand: {
                type: "string",
                required: false,
            },

            // session transmissionType
            transmissionType: {
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

            // session valid
            valid: {
                type: "boolean",
                required: false,
                default: true,
            },

            // session valid message
            validMessage: {
                type: "string",
                required: false,
            },

            // session active
            active: {
                type: "boolean",
                required: false,
                default: true,
            },

            // session active message
            activeMessage: {
                type: "string",
                required: false,
            },

            // session blocked
            blocked: {
                type: "boolean",
                required: false,
                default: false,
            },

            // session blocked message
            blockedMessage: {
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
         * lookup session, if not found create it
         * 
         * @actions
         * @param {String} localAddress - local address
         * @param {Number} localPort - local port
         * @param {String} remoteAddress - remote address
         * @param {Number} remotePort - remote port
         * @param {String} clientHostname - client hostname
         * @param {String} hostNameAppearsAs - hostname appears as
         * @param {String} openingCommand - opening command
         * @param {String} transmissionType - transmission type
         * 
         * @returns {Object} session - session object
         */
        lookup: {
            rest: {
                method: "POST",
                path: "/lookup",
            },
            params: {
                localAddress: {
                    type: "string",
                    required: true,
                },
                localPort: {
                    type: "number",
                    required: true,
                },
                remoteAddress: {
                    type: "string",
                    required: true,
                },
                remotePort: {
                    type: "number",
                    required: true,
                },
                clientHostname: {
                    type: "string",
                    required: false,
                },
                hostNameAppearsAs: {
                    type: "string",
                    required: false,
                },
                openingCommand: {
                    type: "string",
                    required: false,
                },
                transmissionType: {
                    type: "string",
                    required: false,
                },
            },
            async handler(ctx) {
                return this.lookupSession(ctx.params);
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
         * lookup session by params and validate, if not found create it
         * 
         * @param {Object} ctx - context
         * @param {Object} params - lookup params
         * 
         * @returns {Object} session - session object
         */
        async lookupSession(ctx, params) {
            // resolve clientHostname
            const remoteAddress = await this.resolveDNS(ctx, params.clientHostname);
            // reverse dns lookup
            const clientHostname = await this.reverseDNS(ctx, params.remoteAddress);

            // check client hostname match
            if (params.clientHostname !== clientHostname) {
                // create new session and block it
                return this.createSession(ctx, {
                    ...params,
                    blocked: true,
                    blockedMessage: "Invalid client hostname",
                });
            }

            // check remote address match
            if (params.remoteAddress !== remoteAddress) {
                // create new session and block it
                return this.createSession(ctx, {
                    ...params,
                    blocked: true,
                    blockedMessage: "Invalid remote address",
                });
            }

            // lookup session
            const session = await this.findEntity(null, {
                query: {
                    localAddress: params.localAddress,
                    localPort: params.localPort,
                    remoteAddress: params.remoteAddress,
                    remotePort: params.remotePort,
                }
            });

            // validate session
            if (session && !session.valid) {
                // create new session and block it
                return this.createSession(ctx, {
                    ...params,
                    blocked: true,
                    blockedMessage: session.validMessage,
                });
            }

            // block session
            if (session && session.blocked) {
                // create new session and block it
                return this.createSession(ctx, {
                    ...params,
                    blocked: true,
                    blockedMessage: session.blockedMessage,
                });
            }

            // return new session
            return this.createSession(ctx, params);
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
            })
                .catch((err) => {
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
            })
                .catch((err) => {
                    // return address
                    return [];
                });

            // return first hostname
            return hostnames[0];
        },
    }
};


