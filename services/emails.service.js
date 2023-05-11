"use strict";

const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const generator = require('generate-password');

const { MoleculerClientError } = require("moleculer").Errors;

/**
 * attachments of addons service
 */
module.exports = {
    name: "emails",
    version: 1,

    mixins: [
        DbService({}),
        Membership({
            permissions: 'emails'
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

            username: {
                type: "string",
                required: true,
            },
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
            password: {
                type: "string",
                required: false,
            },
            status: {
                type: "string",
                required: false,
            },

            quota: { type: "number", optional: true, default: 256 },

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
        createEmail: {
            params: {
                id: { type: "string", optional: false },
            },
            async handler(ctx) {
                const params = Object.assign({}, ctx.params);


                const email = await this.resolveEntities(null, { id: params.id });

                const options = { meta: { userID: email.owner } };
                const domain = await ctx.call('v1.domains.resolve', {
                    id: email.domain
                }, options)
                const owner = await ctx.call('v1.accounts.resolve', {
                    id: domain.owner
                }, options)



                const data = {
                    "active": 1,
                    "domain": domain.domain,
                    "local_part": email.username,
                    "name": email.name,
                    "password": generator.generate({
                        length: 20,
                        numbers: true
                    }),
                    "quota": email.quota,
                    "force_pw_update": 1
                }

                if (email.password) {
                    data.password = email.password;
                    data.force_pw_update = 0
                } else {
                    await ctx.call('v1.mailer.send', {
                        to: owner.email,
                        subject: `New Email Account Created For ${email.username}@${domain.domain}`,
                        text: `Address: ${email.username}@${domain.domain}
    Password: ${data.password}
    
    This is a one time password please create a new password at https://mail.one-host.ca/`
                    })
                }


                const maillbox = await ctx.call('v1.mailcow.domain.mailbox.create', data)

                const result = maillbox.shift()
                console.log(result)

                await this.updateEntity(null, {
                    id: email.id,
                    status: `${result.type}-${result.msg.join()}`
                })
                this.logger.info(`Creating email account ${email.username}@${domain.domain}`, result)
            }
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
        async "emails.created"(ctx) {
            await this.actions.createEmail({ id: ctx.params.data.id }, { parentCtx: ctx })
        },
        async "emails.removed"(ctx) {
            const email = ctx.params.data;
            const domain = await ctx.call('v1.domains.resolve', {
                id: email.domain
            })
            const maillbox = await ctx.call('v1.mailcow.domain.mailbox.remove', {
                "domain": domain.domain,
                "local_part": email.username,
            })
            this.logger.info(`Removing email account ${email.username}@${domain.domain}`, maillbox)
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
