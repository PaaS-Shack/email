"use strict";

const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const generator = require('generate-password');

const { MoleculerClientError } = require("moleculer").Errors;

/**
 * email mailboxs service
 */
module.exports = {
    name: "emails.mailboxs",
    version: 1,

    mixins: [
        DbService({
            permissions: 'emails.mailboxs'
        }),
        Membership({
            permissions: 'emails.mailboxs'
        })
    ],

    /**
     * Service dependencies
     */
    dependencies: [

    ],
    /**
     * Service settings
     */
    settings: {
        rest: "/v1/emails/mailboxs",

        fields: {

            name: {
                type: "string",
                required: true,
                pattern: /^[a-zA-Z0-9]+$/,
            },

            domain: {
                type: "string",
                required: true,
                populate: {
                    action: "v1.domains.resolve",
                },
            },

            address: {
                type: "string",
                required: true,
            },

            password: {
                type: "string",
                required: true,
            },

            // mailbox status can be active, inactive, suspended, or deleted
            status: {
                type: "string",
                enum: ["active", "inactive", "suspended", "deleted"],
                required: false,
            },

            //index is used for mailbox sorting in the mailbox list
            index: {
                convert: true,
                type: 'number',
                required: false
            },

            // mailbox quota message count
            quota: {
                type: 'object',
                props: {
                    count: {
                        convert: true,
                        type: 'number',
                        required: false
                    },
                    size: {
                        convert: true,
                        type: 'number',
                        required: false
                    },
                },
                required: false,
                default: {
                    count: 0,
                    size: 0,
                }
            },


            ...DbService.FIELDS,// inject dbservice fields
            ...Membership.FIELDS,// inject membership fields
        },
        defaultPopulates: [],

        scopes: {
            ...DbService.SCOPE,
            ...Membership.SCOPE,
        },

        defaultScopes: [
            ...DbService.DSCOPE,
            ...Membership.DSCOPE
        ],

        // default init config settings
        config: {

        }
    },

    /**
     * Actions
     */

    actions: {
        /**
         * lookup mailboxs by address
         * 
         * @actions
         * @param {String} address - mailbox address
         * 
         * @returns {Object} mailbox
         */
        lookup: {
            rest: {
                method: "GET",
                path: "/lookup/:address",
            },
            permissions: ['emails.mailboxs.lookup'],
            params: {
                address: { type: "string" }
            },
            async handler(ctx) {
                const { address } = ctx.params;

                const mailbox = await this.resolveMailbox(ctx, address);
                
                return mailbox;
            }
        },

        /**
         * is Quota Exceeded
         * 
         * @actions
         * @param {String} address - mailbox address
         * 
         * @returns {Object} mailbox
         */
        isQuotaExceeded: {
            rest: {
                method: "GET",
                path: "/isQuotaExceeded/:address",
            },
            permissions: ['emails.mailboxs.isQuotaExceeded'],
            params: {
                address: { type: "string" }
            },
            async handler(ctx) {
                const { address } = ctx.params;

                const mailbox = await this.resolveMailbox(ctx, address);

                if (mailbox.quota.size > mailbox.quota.count) {
                    throw new MoleculerClientError("mailbox quota exceeded", 409);
                }

                return mailbox;
            }
        },

        /**
         * checkPassword
         * 
         * @actions
         * @param {String} address - mailbox address
         * @param {String} password - mailbox password
         * 
         * @returns {Object} mailbox
         */
        checkPassword: {
            rest: {
                method: "POST",
                path: "/checkPassword",
            },
            permissions: ['emails.mailboxs.checkPassword'],
            params: {
                address: { type: "string" },
                password: { type: "string" }
            },
            async handler(ctx) {
                const { address, password } = ctx.params;

                const mailbox = await this.findEntity(null, {
                    query: {
                        address,
                        password,
                    },
                });

                if (!mailbox) {
                    throw new MoleculerClientError("mailbox not found", 404);
                }
                return mailbox;
            }
        },

        /**
         * create mailbox
         * 
         * @actions
         * @param {String} name - mailbox name
         * @param {String} domain - mailbox domain
         * @param {String} password - mailbox password
         * @param {String} status - mailbox status
         * 
         * @returns {Object} mailbox
         */
        createMailbox: {
            rest: {
                method: "POST",
                path: "/",
            },
            permissions: ['emails.mailboxs.create'],
            params: {
                name: { type: "string" },
                domain: { type: "string" },
                password: { type: "string" },
                status: { type: "string" },
            },
            async handler(ctx) {
                const { name, domain, password, status } = ctx.params;

                const mailbox = await this.validateEntity(ctx, {
                    name,
                    domain,
                    password,
                    status,
                });

                return mailbox;
            }
        },

        /**
         * check mailbox quota size
         * 
         * @actions
         * @param {String} address - mailbox address
         * @param {String} size - mailbox size
         * 
         * @returns {Object} mailbox
         */
        checkQuotaSize: {
            rest: {
                method: "POST",
                path: "/checkQuota",
            },
            permissions: ['emails.mailboxs.checkQuota'],
            params: {
                address: { type: "string" },
                size: { type: "number" },
            },
            async handler(ctx) {
                const { address, size } = ctx.params;

                const mailbox = await this.resolveMailbox(ctx, address);

                if (mailbox.quota.size + size > mailbox.quota.count) {
                    throw new MoleculerClientError("mailbox quota exceeded", 409);
                }

                return mailbox;
            }
        },

        /**
         * update mailbox quota size
         * 
         * @actions
         * @param {String} address - mailbox address
         * @param {String} size - mailbox size
         * 
         * @returns {Object} mailbox
         */
        updateQuotaSize: {
            rest: {
                method: "POST",
                path: "/updateQuota",
            },
            permissions: ['emails.mailboxs.updateQuota'],
            params: {
                address: { type: "string" },
                size: { type: "number" },
            },
            async handler(ctx) {
                const { address, size } = ctx.params;

                const mailbox = await this.resolveMailbox(ctx, address);

                mailbox.quota.size += size;

                await this.updateEntity(ctx, mailbox);

                return mailbox;
            }
        },

        /**
         * reset mailbox password
         * 
         * @actions
         * @param {String} address - mailbox address
         * 
         * @returns {Object} mailbox
         */
        resetPassword: {
            rest: {
                method: "POST",
                path: "/resetPassword",
            },
            permissions: ['emails.mailboxs.resetPassword'],
            params: {
                address: { type: "string" },
            },
            async handler(ctx) {
                const { address } = ctx.params;

                const mailbox = await this.resolveMailbox(ctx, address);

                mailbox.password = generator.generate({
                    length: 10,
                    numbers: true,
                });

                await this.updateEntity(ctx, mailbox);

                return mailbox;
            }
        },

        /**
         * update mailbox password
         * 
         * @actions
         * @param {String} address - mailbox address
         * @param {String} password - mailbox password
         * 
         * @returns {Object} mailbox
         */
        updatePassword: {
            rest: {
                method: "POST",
                path: "/updatePassword",
            },
            permissions: ['emails.mailboxs.updatePassword'],
            params: {
                address: { type: "string" },
                password: { type: "string" },
            },
            async handler(ctx) {
                const { address, password } = ctx.params;

                const mailbox = await this.resolveMailbox(ctx, address);

                mailbox.password = password;

                await this.updateEntity(ctx, mailbox);

                return mailbox;
            }
        },

        /**
         * update mailbox status
         * 
         * @actions
         * @param {String} address - mailbox address
         * @param {String} status - mailbox status
         * 
         * @returns {Object} mailbox
         */
        updateStatus: {
            rest: {
                method: "POST",
                path: "/updateStatus",
            },
            permissions: ['emails.mailboxs.updateStatus'],
            params: {
                address: { type: "string" },
                status: { type: "string" },
            },
            async handler(ctx) {
                const { address, status } = ctx.params;

                const mailbox = await this.resolveMailbox(ctx, address);

                mailbox.status = status;

                await this.updateEntity(ctx, mailbox);

                return mailbox;
            }
        },

        /**
         * update mailbox index
         * 
         * @actions
         * @param {String} address - mailbox address
         * @param {String} index - mailbox index
         * 
         * @returns {Object} mailbox
         */
        updateIndex: {
            rest: {
                method: "POST",
                path: "/updateIndex",
            },
            permissions: ['emails.mailboxs.updateIndex'],
            params: {
                address: { type: "string" },
                index: { type: "number" },
            },
            async handler(ctx) {
                const { address, index } = ctx.params;

                const mailbox = await this.resolveMailbox(ctx, address);

                mailbox.index = index;

                await this.updateEntity(ctx, mailbox);

                return mailbox;
            }
        },

    },

    /**
     * emails
     */
    events: {

    },
    /**
     * Methods
     */
    methods: {
        /**
         * resolve mailbox entity
         * 
         * @param {Object} ctx - context
         * @param {String} address - mailbox address
         * 
         * @returns {Object} mailbox
         */
        async resolveMailbox(ctx, address) {
            const mailbox = await this.findEntity(null, {
                query: {
                    address,
                },
            });

            if (!mailbox) {
                throw new MoleculerClientError("mailbox not found", 404);
            }

            return mailbox;
        },
        /**
         * validate mailbox entity
         * 
         * @param {Object} ctx - context
         * @param {Object} entity - mailbox entity
         * 
         * @returns {Object} mailbox
         */
        async validateEntity(ctx, entity) {
            const { name, domain, password, status } = entity;

            const domainEntity = await ctx.call("v1.domains.resolve", { id: domain });

            if (!domainEntity) {
                throw new MoleculerClientError("domain not found", 404);
            }

            const address = `${name}@${domainEntity.domain}`;

            const mailbox = await this.findEntity(null, {
                query: {
                    address,
                },
            });

            if (mailbox) {
                throw new MoleculerClientError("mailbox already exists", 409);
            }

            const newMailbox = await this.createEntity(ctx, {
                name,
                domain: domainEntity.id,
                address,
                password,
                status,
            });

            return newMailbox;
        },

    },
    /**
     * Service created lifecycle event handler
     */
    created() {

    },

    /**
     * Service started lifecycle event handler
     */
    async started() {

    },

    /**
     * Service stopped lifecycle event handler
     */
    stopped() {

    }
};
