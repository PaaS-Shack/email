const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");

const { MoleculerClientError, MoleculerServerError } = require("moleculer").Errors;


/**
 * This is the envelope service for long term storage of emails
 * Raw emails are stored in s3 and the envelope is stored in this service
 */

module.exports = {
    // name of service
    name: "emails.envelopes",
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

            // email envelope smtp session id
            session: {
                type: "string",
                required: true,
                populate: {
                    action: "v2.emails.sessions.resolve",
                }
            },

            // email envelope from address
            from: {
                type: "string",
                required: true,
                populate: {
                    action: "v2.emails.addresses.resolve",
                }
            },

            // email envelope to addresses
            to: {
                type: "array",
                required: true,
                populate: {
                    action: "v2.emails.addresses.resolve",
                }
            },

            // email envelope s3 bucket
            bucket: {
                type: "string",
                required: true,
            },

            // email envelope s3 key
            key: {
                type: "string",
                required: true,
            },

            // email envelope size
            size: {
                type: "number",
                required: true,
            },

            // email message attachments
            attachments: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.attachments.resolve",
                }
            },

            // email envelope processed flag
            processed: {
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
         * add attachment to email
         * 
         * @actions
         * @param {String} id - envelope id
         * @param {String} attachment - attachment id
         * 
         * @returns {Object} attachment
         */
        addAttachment: {
            params: {
                id: {
                    type: "string",
                    optional: false,
                },
                attachment: {
                    type: "string",
                    optional: false,
                }
            },
            async handler(ctx) {
                const { id, attachment: attachmentID } = ctx.params;

                // get envelope
                const envelope = await this.resolveEntities(ctx, { id });

                // check envelope
                if (!envelope) {
                    throw new MoleculerClientError("Envelope not found", 404, "ENVELOPE_NOT_FOUND", { id });
                }

                // get attachment
                const attachment = await ctx.call("v2.emails.attachments.resolve", { id: attachmentID });

                // check attachment
                if (!attachment) {
                    throw new MoleculerClientError("Attachment not found", 404, "ATTACHMENT_NOT_FOUND", { id: attachmentID });
                }

                const query = {
                    id: envelope.id,
                    $push: {
                        from: attachment.id,
                    }
                };

                // update session
                const update = await this.updateEntity(ctx, query);

                // return session
                return update;
            }
        },

        /**
         * remove attachment from email
         * 
         * @actions
         * @param {String} id - envelope id
         * @param {String} attachment - attachment id
         * 
         * @returns {Object} attachment
         */
        removeAttachment: {
            params: {
                id: {
                    type: "string",
                    optional: false,
                },
                attachment: {
                    type: "string",
                    optional: false,
                }
            },
            async handler(ctx) {
                const { id, attachment: attachmentID } = ctx.params;

                // get envelope
                const envelope = await this.resolveEntities(ctx, { id });

                // check envelope
                if (!envelope) {
                    throw new MoleculerClientError("Envelope not found", 404, "ENVELOPE_NOT_FOUND", { id });
                }

                // get attachment
                const attachment = await ctx.call("v2.emails.attachments.resolve", { id: attachmentID });

                // check attachment
                if (!attachment) {
                    throw new MoleculerClientError("Attachment not found", 404, "ATTACHMENT_NOT_FOUND", { id: attachmentID });
                }

                const query = {
                    id: envelope.id,
                    $pull: {
                        from: attachment.id,
                    }
                };

                // update session
                const update = await this.updateEntity(ctx, query);

                // return session
                return update;
            }
        },

        /**
         * mark envelope as processed
         * 
         * @actions
         * @param {String} id - envelope id
         * 
         * @returns {Object} envelope
         */
        processed: {
            params: {
                id: {
                    type: "string",
                    optional: false,
                },
            },
            async handler(ctx) {
                const { id } = ctx.params;

                // get envelope
                const envelope = await this.resolveEntities(ctx, { id });

                // check envelope
                if (!envelope) {
                    throw new MoleculerClientError("Envelope not found", 404, "ENVELOPE_NOT_FOUND", { id });
                }

                const query = {
                    id: envelope.id,
                    $set: {
                        processed: true,
                    }
                };

                // update session
                const update = await this.updateEntity(ctx, query, { raw: true });

                // emit processed event
                await ctx.emit('emails.envelopes.processed', update);   

                // return session
                return update;
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

    },

    /**
     * service methods
     */
    methods: {

    }

}


