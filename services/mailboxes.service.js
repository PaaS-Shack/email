const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");

const { MoleculerClientError, MoleculerServerError } = require("moleculer").Errors;


/**
 * This is the mailbox service for webmail, imap, pop3, smtp
 * Every email has a default mailbox called inbox
 * Mailboxes have flags and other metadata for imap and pop3
 * Mailboxes have messages that are stored in the emails.messages service
 * 
 * When a new evelope is received, it is stored in the mailbox of the email account
 */

module.exports = {
    // name of service
    name: "emails.mailboxes",
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

            // mailbox name
            name: {
                type: "string",
                required: true,
                min: 3,
                max: 25,
                trim: true,
            },

            // mailbox description
            description: {
                type: "string",
                required: false,
            },

            // mailbox flags
            flags: {
                type: "array",
                required: false,
                default: [],
                items: "string"
            },

            // mailbox email address
            email: {
                type: "string",
                required: true,
                emutible: true,
                populate: {
                    action: "v2.emails.addresses.get",
                }
            },

            // mailbox email aliases
            alias: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.addresses.resolve",
                }
            },

            // mailbox messages
            messages: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.messages.resolve",
                }
            },

            // mailbox email account
            account: {
                type: "string",
                required: true,
                populate: {
                    action: "v2.emails.accounts.get",
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
         * get mailbox stats
         * 
         * @actions
         * @param {String} id - mailbox id
         * 
         * @returns {Object} mailbox stats  
         */
        stats: {
            rest: {
                method: "GET",
                path: "/:id/stats",
            },
            params: {
                id: {
                    type: "string",
                    optional: true,
                },
            },
            async handler(ctx) {
                // get mailbox
                const mailbox = await this.getMailbox(ctx, ctx.params.id);

                // check mailbox
                if (!mailbox) {
                    // throw error
                    throw new MoleculerClientError("Mailbox not found", 404, "MAILBOX_NOT_FOUND", { id: ctx.params.id });
                }

                // get unread count
                const unread = await ctx.call("v2.emails.messages.count", {
                    query: {
                        mailbox: mailbox.id,
                        seen: false,
                    }
                });

                // get total count
                const total = await ctx.call("v2.emails.messages.count", {
                    query: {
                        mailbox: mailbox.id,
                    }
                });

                // get unseen count
                const unseen = await ctx.call("v2.emails.messages.count", {
                    query: {
                        mailbox: mailbox.id,
                        seen: false,
                        recent: true,
                    }
                });

                // get recent count
                const recent = await ctx.call("v2.emails.messages.count", {
                    query: {
                        mailbox: mailbox.id,
                        recent: true,
                    }
                });

                // get flagged count
                const flagged = await ctx.call("v2.emails.messages.count", {
                    query: {
                        mailbox: mailbox.id,
                        flagged: true,
                    }
                });

                // get answered count
                const answered = await ctx.call("v2.emails.messages.count", {
                    query: {
                        mailbox: mailbox.id,
                        answered: true,
                    }
                });

                // get draft count
                const draft = await ctx.call("v2.emails.messages.count", {
                    query: {
                        mailbox: mailbox.id,
                        draft: true,
                    }
                });

                return {
                    unread,
                    total,
                    unseen,
                    recent,
                    flagged,
                    answered,
                    draft,
                }
            }
        },
    },

    /**
     * service events
     */
    events: {
        /**
         * envelope created event
         */
        async "emails.envelopes.processed"(ctx) {
            const envelope = ctx.params;

            // loop to address
            for (const id of envelope.to) {
                // lookup mailbox by id
                const mailbox = await this.findEntities(null, {
                    query: {
                        email: id,
                    },
                });

                const alias = await this.findEntities(null, {
                    query: {
                        alias: id,
                    },
                });

                const found = mailbox.concat(alias);

                this.logger.info(`Found ${found.length} mailboxes for ${id}`);

                // loop mailbox
                for (const box of found) {
                    // process envelope
                    await this.processEnvelope(ctx, box, envelope)
                        .catch(err => {
                            this.logger.error(`Error processing envelope ${envelope.id} in mailbox ${box.id}`, err);
                        });
                }
            }
        }
    },

    /**
     * service methods
     */
    methods: {
        /**
         * process envelope
         * 
         * @param {Context} ctx
         * @param {Object} mailbox - mailbox object
         * @param {Object} envelope - envelope object
         * 
         * @returns {Promise}
         */
        async processEnvelope(ctx, mailbox, envelope) {


            if (!envelope.processed) {
                // throw error
                throw new MoleculerClientError("Envelope not processed", 404, "ENVELOPE_NOT_PROCESSED", { id: envelope.id });
            }

            // get email
            const email = await ctx.call("v2.emails.find", {
                query: {
                    envelope: envelope.id,
                },
                fields: ["id", "envelope", "mailbox", "from", "to", "cc", "bcc", "subject"],
            }).then(res => res[0]);

            // create message
            const message = await ctx.call("v2.emails.messages.create", {
                mailbox: mailbox.id,
                envelope: envelope.id,
                flags: [],
                from: email.from,
                to: email.to,
                cc: email.cc,
                bcc: email.bcc,
                subject: email.subject,
                recent: true,
            });

            // add message to mailbox
            await this.updateEntity(ctx, {
                id: mailbox.id,
                $push: {
                    messages: message.id,
                }
            }, { raw: true });

            this.logger.info(`Message ${message.id} created in mailbox ${mailbox.id}`);

        },
        /**
         * lookup mailboxes by email address
         * 
         * @param {Context} ctx
         * @param {String} address - email address
         * 
         * @returns {Promise}
         */
        async lookupByEmailAddress(ctx, address) {
            return ctx.call("v2.emails.addresses.lookupByEmailAddress", { address });
        },

        /**
         * get headers from envelope
         * 
         * @param {Context} ctx
         * @param {Object} envelope - envelope object
         * 
         * @returns {Array} email headers
         */
        async getEnvelopeHeaders(ctx, envelope) {
            // get envelope stream from s3
            const stream = await this.getMessageStream(envelope);

            // header stream
            const headerStream = new HeaderStream();

            return new Promise((resolve, reject) => {
                headerStream.once('error', reject)
                headerStream.once('headers', (headers) => {
                    stream.end();
                    resolve(headers);
                });
                stream.pipe(headerStream);
            })
        },

        /**
         * get mailbox by id
         * 
         * @param {Context} ctx
         * @param {String} id - mailbox id
         * 
         * @returns {Promise} mailbox object
         */
         async getMailbox(ctx, id) {
            // get mailbox
            return this.resolveEntities(null,{
                id
            });
        },
    }

}


