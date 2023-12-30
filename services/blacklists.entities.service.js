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
                        set: function ({ params }) {
                            if (params.ip && !params.ip.high) return this.ip2int(params.ip.address)
                        },
                    },

                    // blacklist ip low range
                    low: {
                        type: "number",
                        required: false,
                        set: function ({ params }) {
                            if (params.ip && !params.ip.low) return this.ip2int(params.ip.address)
                        },
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
                default: true,
            },

            // blacklist reason
            reason: {
                type: "string",
                required: false,
                default: "unknown",
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

                const entity = await this.findEntity(null, {
                    query,
                    populate: "blacklist"
                }, { raw: true });

                return entity;
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
                const domain = ctx.params.domain;

                // parse domain
                const parsed = pls.parse(domain);
                const hostname = parsed.domain;

                // query for domain
                const query = {
                    $or: [
                        { domain: domain },
                        { domain: hostname },
                    ]
                };

                // lookup domain in entites
                const entity = await this.findEntity(null, {
                    query,
                    populate: "blacklist"
                }, { raw: true });

                return entity;
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

                const ip = ctx.params.ip;

                // parse ip
                const parsed = pls.parse(ip);

                // convert ip to int
                const ipInt = this.ip2int(ip);

                // query for ip
                const query = {
                    $or: [
                        { "ip.address": ip },
                    ]
                };

                // lookup ip in entites
                const entity = await this.findEntity(null, {
                    query,
                    populate: "blacklist"
                }, { raw: true });

                if (!entity) {
                    // lookup ip in entites
                    return this.findEntity(null, {
                        query: {
                            $and: [
                                { "ip.low": { $lte: ipInt } },
                                { "ip.high": { $gte: ipInt } },
                            ]
                        },
                        populate: "blacklist"
                    }, { raw: true });
                }

                return entity;
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
         * ip address to int
         * 
         * @param {String} ip - ip address
         * 
         * @returns {Number} - ip int
         */
        ip2int(ip) {
            return ip.split('.').reduce(function (ipInt, octet) { return (ipInt << 8) + parseInt(octet, 10) }, 0) >>> 0;
        },

        /**
        * int to ip address
        * 
        * @param {Number} ipInt - ip int
        * 
        * @returns {String} - ip address
        */
        int2ip(ipInt) {
            return ((ipInt >>> 24) + '.' + (ipInt >> 16 & 255) + '.' + (ipInt >> 8 & 255) + '.' + (ipInt & 255));
        }
    }

}


