const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");

const { MoleculerClientError, MoleculerServerError } = require("moleculer").Errors;

const pls = require("../lib/psl.min.js");

/**
 * This service keeps track of email blacklists entities.
 * 
 * Entity can be an email address, domain, or ip address
 */

module.exports = {
    // name of service
    name: "emails.blacklists.entities",
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

            // blacklist id
            blacklist: {
                type: "string",
                required: true,
                populate: {
                    action: "v2.emails.blacklists.get"
                }
            },

            // email blacklist name
            name: {
                type: "string",
                required: false,
            },

            // entity type (address, domain, ip)
            type: {
                type: "string",
                required: false,
                default: "address",
                enum: [
                    "address",
                    "domain",
                    "ip",
                ]
            },

            // blacklist email address
            email: {
                type: "string",
                required: false,
            },

            // blacklist domain
            domain: {
                type: "string",
                required: false,
            },

            // blacklist ip address
            ip: {
                type: "object",
                required: false,
                items: {

                    // blacklist ip address
                    address: {
                        type: "string",
                        required: false,
                    },

                    // blacklist ip family
                    family: {
                        type: "string",
                        required: false,
                        default: "ipv4",
                        enum: [
                            "ipv4",
                            "ipv6",
                        ]
                    },

                    // blacklist ip high range
                    high: {
                        type: "number",
                        required: false,
                    },

                    // blacklist ip low range
                    low: {
                        type: "number",
                        required: false,
                    },
                }
            },


            // session valid
            valid: {
                type: "boolean",
                required: false,
                default: true,
            },

            // session active
            active: {
                type: "boolean",
                required: false,
                default: true,
            },

            // session blocked
            blocked: {
                type: "boolean",
                required: false,
                default: false,
            },

            // blacklist reason
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
                 * lookup email address in blacklists
                 * Break address into parts and lookup each part in blacklists
                 * Test parts of the domain as wildcards to see if any part of the domain is blacklisted
                 * 
                 * @actions
                 * @param {String} address - email address
                 * 
                 * @returns {Object} - email blacklist
                 */
        lookupEmail: {
            params: {
                address: {
                    type: "string",
                    required: true,
                }
            },
            async handler(ctx) {
                const email = ctx.params.address;
                const parts = email.split("@");
                const user = parts[0];
                const hostname = parts[1];

                // parse domain
                const parsed = pls.parse(hostname);
                const domain = parsed.domain;

                // lookup email address in entites
                const query = {
                    $or: [
                        { email: email },
                        { email: `*@${hostname}` },
                        { email: `${user}@*` },
                        { domain: domain },
                    ]
                };

                const entites = await this.findEntities(null, {
                    query,
                    limit: 1,
                    populate: "blacklist"
                }, { raw: true });

                return {
                    email,
                    domain,
                    user,
                    ...entites[0],
                }
            }
        },

        /**
         * lookup domain in blacklists
         * 
         * @actions
         * @param {String} domain - email domain
         * 
         * @returns {Object} - email blacklist
         */
        lookupDomain: {
            params: {
                domain: {
                    type: "string",
                    required: true,
                }
            },
            async handler(ctx) {
                // lookup email domain in entites
                return ctx.call("v2.emails.blacklists.entities.find", {
                    query: {
                        domain: ctx.params.domain,
                    },
                    limit: 1
                }).then((entities) => {
                    return entities[0];
                });
            }
        },

        /**
         * lookup ip address in blacklists
         * 
         * @actions
         * @param {String} ip - ip address
         * 
         * @returns {Object} - email blacklist
         */
        lookupIp: {
            params: {
                ip: {
                    type: "string",
                    required: true,
                }
            },
            async handler(ctx) {
                // lookup ip address in entites
                return ctx.call("v2.emails.blacklists.entities.find", {
                    query: {
                        ip: ctx.params.ip,
                    },
                    limit: 1
                }).then((entities) => {
                    return entities[0];
                });
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

    }

}


