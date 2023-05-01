"use strict";

const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const generator = require('generate-password');

const { MoleculerClientError } = require("moleculer").Errors;

/**
 * attachments of addons service
 */
module.exports = {
    name: "emails.alias",
    version: 1,

    mixins: [
        DbService({}),
        Membership({
            permissions: 'emails.alias'
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
        rest: "/v1/emails/",

        fields: {

            name: {
                type: "string",
                required: true,
            },
            domain: {
                type: "string",
                required: true,
                populate: {
                    action: "v1.domains.resolve",
                    params: {
                        //fields: ["id", "username", "fullName", "avatar"]
                    }
                },
            },
            address: {
                type: "string",
                required: true,
            },
            goto: {
                type: "string",
                required: true,
            },
            status: {
                type: "string",
                required: false,
            },
            index: {
                convert: true,
                type: 'number',
                required: false
            },

            options: { type: "object" },
            createdAt: {
                type: "number",
                readonly: true,
                onCreate: () => Date.now(),
            },
            updatedAt: {
                type: "number",
                readonly: true,
                onUpdate: () => Date.now(),
            },
            deletedAt: {
                type: "number",
                readonly: true,
                hidden: "byDefault",
                onRemove: () => Date.now(),
            },
            ...Membership.FIELDS,
        },

        defaultPopulates: [],

        scopes: {
            notDeleted: { deletedAt: null },
            async domain(query, ctx, params) { return this.validateHasPermissions(query, ctx, params) },
            ...Membership.SCOPE,
        },

        defaultScopes: ["domain", ...Membership.DSCOPE, "notDeleted"]
    },

    /**
     * Actions
     */

    actions: {

        create: {
            permissions: ['emails.create'],
        },
        list: {
            permissions: ['emails.list'],
            params: {
                //domain: { type: "string" }
            }
        },

        find: {
            rest: "GET /find",
            permissions: ['emails.find'],
            params: {
                //domain: { type: "string" }
            }
        },

        count: {
            rest: "GET /count",
            permissions: ['emails.count'],
            params: {
                //domain: { type: "string" }
            }
        },

        get: {
            needEntity: true,
            permissions: ['emails.get'],
        },

        update: {
            rest: false,
            needEntity: true,
            permissions: ['emails.update'],
        },

        replace: false,

        remove: {
            needEntity: true,
            permissions: ['emails.remove'],

        },
    },

    /**
     * emails
     */
    events: {
        async "domains.removed"(ctx) {
            const domain = ctx.params.data;
            const name = domain.name

        },
        async "emails.alias.created"(ctx) {
            const alias = ctx.params.data;


            const data = {
                "active": 1,
                "address": alias.address,
                "goto": alias.goto
            }


            const maillbox = await ctx.call('v1.mailcow.domain.alias.create', data)

            const result = maillbox.shift()
console.log(result)
            await this.updateEntity(null, {
                id: alias.id,
                index: result.msg.pop()
            })
            this.logger.info(`Creating alias email account`, result)
        },
        async "emails.alias.removed"(ctx) {
            const alias = ctx.params.data;
            const maillbox = await ctx.call('v1.mailcow.domain.alias.remove', {
                id: alias.index,
            })
            this.logger.info(`Removing alias email account`, maillbox)
        },
    },
    /**
     * Methods
     */
    methods: {
        async validateHasPermissions(query, ctx, params) {
            // Adapter init
            if (!ctx) return query;

            if (params.domain) {
                const res = await ctx.call("v1.domains.resolve", {
                    id: params.domain,
                    fields: ['id']
                });

                if (res) {
                    query.domain = params.domain;
                    return query;
                }
                throw new MoleculerClientError(
                    `You have no right for the domain '${params.domain}'`,
                    403,
                    "ERR_NO_PERMISSION",
                    { domain: params.domain }
                );
            }
            if (ctx.action && ctx.action.params.domain && !ctx.action.params.domain.optional) {
                throw new MoleculerClientError(`domain is required`, 422, "VALIDATION_ERROR", [
                    { type: "required", field: "domain" }
                ]);
            }
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
