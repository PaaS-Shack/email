const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");
const { MoleculerClientError } = require("moleculer").Errors;


/**
 * this is the email account service
 */

module.exports = {
    // name of service
    name: "emails.accounts",
    // version of service
    version: 1,

    /**
     * Service Mixins
     * 
     * @type {Array}
     * @property {DbService} DbService - Database mixin
     * @property {ConfigLoader} ConfigLoader - Config loader mixin
     */
    mixins: [
        DbService({
            permissions: 'emails.accounts'
        }),
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

            // email account username
            username: {
                type: "string",
                required: true,
                unique: true,
            },

            // email account password
            password: {
                type: "string",
                required: true,
            },

            // email account email address
            email: {
                type: "string",
                required: true,
            },

            // sender address for this account
            sender: {
                type: "string",
                required: false,
            },

            // email new messages
            inbox: {
                type: "array",
                required: false,
                default: [],
                populate: {
                    action: "v1.emails.inbound.resolve",
                }
            },

            // email inbound messages
            inbound: {
                type: "array",
                required: false,
                default: [],
                populate: {
                    action: "v1.emails.inbound.resolve",
                }
            },

            // email outbound messages
            outbound: {
                type: "array",
                required: false,
                default: [],
                populate: {
                    action: "v1.emails.messages.resolve",
                }
            },

            // email account smtp details
            smtp: {
                type: "object",
                required: false,
                props: {
                    host: {
                        type: "string",
                        required: false,
                    },
                    port: {
                        type: "number",
                        required: false,
                    },
                    secure: {
                        type: "boolean",
                        required: false,
                    },
                    auth: {
                        type: "object",
                        required: false,
                        props: {
                            user: {
                                type: "string",
                                required: false,
                            },
                            pass: {
                                type: "string",
                                required: false,
                            },
                        }
                    }
                }
            },

            // email account imap details
            imap: {
                type: "object",
                required: false,
                props: {
                    host: {
                        type: "string",
                        required: false,
                    },
                    port: {
                        type: "number",
                        required: false,
                    },
                    secure: {
                        type: "boolean",
                        required: false,
                    },
                    auth: {
                        type: "object",
                        required: false,
                        props: {
                            user: {
                                type: "string",
                                required: false,
                            },
                            pass: {
                                type: "string",
                                required: false,
                            },
                        }
                    }
                }
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
         * auth account
         * 
         * @actions
         * @param {String} username - account username
         * @param {String} password - account password
         * @param {String} method - smtp auth methods
         * 
         * @returns {Object} - account
         */
        auth: {
            rest: {
                method: "POST",
                path: "/auth"
            },
            params: {
                username: {
                    type: "string",
                    required: true,
                },
                password: {
                    type: "string",
                    required: true,
                },
                method: {
                    type: "string",
                    enum: ['PLAIN', 'LOGIN', 'XOAUTH2'],
                    default: 'basic',
                }
            },
            async handler(ctx) {
                const { username, password } = ctx.params;

                // find account
                const account = await this.findEntity(null, {
                    query: {
                        username,
                    }
                });

                // check account
                if (!account) {
                    throw new MoleculerClientError("account not found", 404, "ACCOUNT_NOT_FOUND");
                }

                // check password
                if (account.password !== password) {
                    throw new MoleculerClientError("invalid password", 401, "INVALID_PASSWORD");
                }

                return account;
            },
        },

        /**
         * validate from address
         * 
         * @actions
         * @param {String} from - from address
         * @param {String} user - account id
         * 
         * @returns {Object} - account
         */
        validateFrom: {
            rest: {
                method: "GET",
                path: "/validate-from/:from/:user"
            },
            params: {
                from: {
                    type: "string",
                    required: true,
                },
                user: {
                    type: "string",
                    required: true,
                },
            },
            async handler(ctx) {
                const { from, user } = ctx.params;

                // find account
                const account = await this.findEntity(null, {
                    query: {
                        email: from
                    }
                });

                // check account
                if (!account) {
                    throw new MoleculerClientError("account not found", 404, "ACCOUNT_NOT_FOUND");
                }

                // check from address
                if (account.id !== user) {
                    throw new MoleculerClientError("invalid from address", 401, "INVALID_FROM_ADDRESS");
                }

                return account;
            },
        },

        /**
         * mark message as read
         * 
         * @actions
         * @param {String} id - account id
         * @param {String} message - message id
         * 
         * @returns {Object} - account
         */
        markRead: {
            rest: {
                method: "PUT",
                path: "/:id/read/:message"
            },
            params: {
                id: {
                    type: "string",
                    required: true,
                },
                message: {
                    type: "string",
                    required: true,
                },
            },
            async handler(ctx) {
                const { id, message } = ctx.params;

                // find account
                const account = await this.resolveEntities(ctx, {
                    id
                });

                // check account exists
                if (!account) {
                    throw new MoleculerClientError("account not found", 404, "ACCOUNT_NOT_FOUND");
                }

                // check message is not already read
                if (!account.inbox.includes(message)) {
                    throw new MoleculerClientError("message not found", 404, "MESSAGE_NOT_FOUND");
                }

                // check message is part of account
                if (!account.inbound.includes(message)) {
                    throw new MoleculerClientError("message not found", 404, "MESSAGE_NOT_FOUND");
                }

                // mark message as read
                await this.updateEntity(ctx, {
                    id,
                    $pull: {
                        inbox: message
                    }
                }, { raw: true });

                return account;
            }
        },

        /**
         * mark message as unread
         * 
         * @actions
         * @param {String} id - account id
         * @param {String} message - message id
         * 
         * @returns {Object} - account
         */
        markUnread: {
            rest: {
                method: "PUT",
                path: "/:id/unread/:message"
            },
            params: {
                id: {
                    type: "string",
                    required: true,
                },
                message: {
                    type: "string",
                    required: true,
                },
            },
            async handler(ctx) {
                const { id, message } = ctx.params;

                // find account
                const account = await this.resolveEntities(ctx, {
                    id
                });

                // check account
                if (!account) {
                    throw new MoleculerClientError("account not found", 404, "ACCOUNT_NOT_FOUND");
                }

                // check message
                if (account.inbox.includes(message)) {
                    throw new MoleculerClientError("message found", 404, "MESSAGE_FOUND");
                }

                if (!account.inbound.includes(message)) {
                    throw new MoleculerClientError("message not found", 404, "MESSAGE_NOT_FOUND");
                }

                // mark message as read
                await this.updateEntity(ctx, {
                    id,
                    $push: {
                        inbox: message
                    }
                }, { raw: true });

                return account;
            }
        },

        /**
         * mark message as deleted
         * 
         * @actions
         * @param {String} id - account id
         * @param {String} message - message id
         * 
         * @returns {Object} - account
         */
        markDeleted: {
            rest: {
                method: "PUT",
                path: "/:id/deleted/:message"
            },
            params: {
                id: {
                    type: "string",
                    required: true,
                },
                message: {
                    type: "string",
                    required: true,
                },
            },
            async handler(ctx) {
                const { id, message } = ctx.params;

                // find account
                const account = await this.resolveEntities(ctx, {
                    id
                });

                // check account
                if (!account) {
                    throw new MoleculerClientError("account not found", 404, "ACCOUNT_NOT_FOUND");
                }

                // check message
                if (!account.inbound.includes(message)) {
                    throw new MoleculerClientError("message not found", 404, "MESSAGE_NOT_FOUND");
                }

                // mark message as read
                await this.updateEntity(ctx, {
                    id,
                    $pull: {
                        inbox: message,
                        inbound: message
                    }
                }, { raw: true });

                return account;
            }
        },

        /**
         * read message
         * 
         * @actions
         * @param {String} id - account id
         * @param {String} message - message id
         * 
         * @returns {Object} - account
         */
        readMessage: {
            rest: {
                method: "GET",
                path: "/:id/message/:message"
            },
            params: {
                id: {
                    type: "string",
                    required: true,
                },
                message: {
                    type: "string",
                    required: true,
                },
            },
            async handler(ctx) {
                const { id, message } = ctx.params;

                // find account
                const account = await this.resolveEntities(ctx, {
                    id
                });

                // check account
                if (!account) {
                    throw new MoleculerClientError("account not found", 404, "ACCOUNT_NOT_FOUND");
                }

                // check message
                if (!account.inbound.includes(message)) {
                    throw new MoleculerClientError("message not found", 404, "MESSAGE_NOT_FOUND");
                }

                // read message
                const result = await ctx.call('v1.emails.inbound.resolve', {
                    id: message
                });

                if (!result) {
                    throw new MoleculerClientError("message not found", 404, "MESSAGE_NOT_FOUND");
                }

                if (!result.s3) {
                    throw new MoleculerClientError("raw message not found", 404, "RAW_MESSAGE_NOT_FOUND");
                }

                return ctx.call('v1.emails.parser.parse', {
                    id: result.id
                });
            }
        },

        /**
         * validate dkim signature
         * 
         * @actions
         * @param {String} id - account id
         * @param {String} message - message id
         * 
         * @returns {Object} - account
         */
        validateDkim: {
            rest: {
                method: "GET",
                path: "/:id/dkim/:message"
            },
            params: {
                id: {
                    type: "string",
                    required: true,
                },
                message: {
                    type: "string",
                    required: true,
                },
            },
            async handler(ctx) {
                const { id, message } = ctx.params;

                // find account
                const account = await this.resolveEntities(ctx, {
                    id
                });

                // check account
                if (!account) {
                    throw new MoleculerClientError("account not found", 404, "ACCOUNT_NOT_FOUND");
                }

                // check message
                if (!account.inbound.includes(message)) {
                    throw new MoleculerClientError("message not found", 404, "MESSAGE_NOT_FOUND");
                }

                // read message
                const result = await ctx.call('v1.emails.inbound.resolve', {
                    id: message
                });

                if (!result) {
                    throw new MoleculerClientError("message not found", 404, "MESSAGE_NOT_FOUND");
                }

                if (!result.s3) {
                    throw new MoleculerClientError("raw message not found", 404, "RAW_MESSAGE_NOT_FOUND");
                }

                return ctx.call('v1.emails.parser.verify', {
                    id: result.id
                });
            }
        },

        /**
         * import message for account
         * 
         * @actions
         * @param {String} id - account id
         * 
         * @returns {Object} - account
         */
        import: {
            rest: {
                method: "POST",
                path: "/:id/import"
            },
            params: {
                id: {
                    type: "string",
                    required: true,
                },
            },
            async handler(ctx) {
                const { id } = ctx.params;

                // find account
                const account = await this.resolveEntities(ctx, {
                    id
                });

                // check account
                if (!account) {
                    throw new MoleculerClientError("account not found", 404, "ACCOUNT_NOT_FOUND");
                }

                const messages = await ctx.call('v1.emails.inbound.find', {
                    query: {
                        to: account.email
                    },
                    fields: ['id']
                });

                // check messages
                if (!messages.length) {
                    throw new MoleculerClientError("no messages found", 404, "MESSAGES_NOT_FOUND");
                }

                // import messages
                const updated = await this.updateEntity(ctx, {
                    id,
                    inbound: messages.map(message => message.id),
                });

                return updated;
            }
        },

        /**
         * send message from account 
         * 
         * @actions
         * @param {String} id - account id
         * @param {String} to - to address
         * @param {String} subject - message subject
         * @param {String} text - message text
         * 
         * @returns {Object} - account
         */
        send: {
            rest: {
                method: "POST",
                path: "/:id/send"
            },
            params: {
                id: {
                    type: "string",
                    required: true,
                },
                to: {
                    type: "string",
                    required: true,
                },
                subject: {
                    type: "string",
                    required: true,
                },
                text: {
                    type: "string",
                    required: true,
                },
            },
            async handler(ctx) {
                const { id, to, subject, text } = ctx.params;

                // find account
                const account = await this.resolveEntities(ctx, {
                    id
                });

                // check account
                if (!account) {
                    throw new MoleculerClientError("account not found", 404, "ACCOUNT_NOT_FOUND");
                }

                // send message
                const message = await ctx.call('v1.emails.messages.create', {
                    from: account.email,
                    to: [to],
                    subject,
                    text,
                });

                // update account
                const updated = await this.updateEntity(ctx, {
                    id,
                    $push: {
                        outbound: message.id
                    }
                }, { raw: true });

                // queue message
                await ctx.call('v1.emails.messages.queue', {
                    id: message.id
                });

                return updated;
            }
        },

        // clean db
        clean: {
            async handler(ctx) {

                const entities = await this.findEntities(null, {});
                this.logger.info(`cleaning ${entities.length} entities`);
                // loop entities
                for (let index = 0; index < entities.length; index++) {
                    const entity = entities[index];

                    await this.removeEntity(ctx, {
                        id: entity.id
                    });
                }

            },
        },
    },

    /**
     * service events
     */
    events: {
        /**
         * on email received
         */
        async "emails.inbound.received"(ctx) {
            const { envelope } = ctx.params;
            const { from, to } = envelope;

            // find account
            const account = await this.findEntity(null, {
                query: {
                    email: to[0]
                }
            });

            // check account
            if (!account) {
                throw new MoleculerClientError("account not found", 404);
            }

            // add inbound message
            await this.updateEntity(ctx, {
                id: account.id,
                $push: {
                    inbound: envelope.id,
                    inbox: envelope.id
                }
            }, { raw: true });


        }
    },

    /**
     * service methods
     */
    methods: {

    }

}


