
const DbService = require("db-mixin");
const ConfigLoader = require("config-mixin");
const { MoleculerClientError } = require("moleculer").Errors;

/**
 * emails queue service
 * This service is responsible for storing emails to be sent in a queue.
 * single collection for diffrent queues inbound, outbound, visus spam, etc...
 *  
 */
module.exports = {
    name: "emails.store",
    version: 1,

    mixins: [
        DbService({}),
    ],

    /**
     * Service dependencies
     */
    dependencies: [],

    /**
     * Service settings
     */
    settings: {
        rest: true,
        fields: {
            //DB fields that fit the mailparser schema
            state: {
                type: "string",
                enum: [
                    "inbound", "outbound",
                    "visus", "spam",
                    "sent", "draft", "trash", "archive",
                    "inbox", "outbox", "spambox", "trashbox", "archivebox"
                ],
                default: "outbound",
                index: true,
                required: true,

            },
            // email subject
            subject: {
                type: "string",
                required: true,
            },
            // email from address
            from: {
                type: "string",
                required: true,
            },
            // email to address
            to: {
                type: "string",
                required: true,
            },
            // email cc address
            cc: {
                type: "string",
                required: false,
            },
            // email bcc address
            bcc: {
                type: "string",
                required: false,
            },
            // email body
            body: {
                type: "string",
                required: true,
            },
            // email attachments
            attachments: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        filename: {
                            type: "string",
                            required: true,
                        },
                        contentType: {
                            type: "string",
                            required: true,
                        },
                        contentDisposition: {
                            type: "string",
                            required: true,
                        },
                        contentId: {
                            type: "string",
                            required: true,
                        },
                        contentMD5: {
                            type: "string",
                            required: true,
                        },
                        content: {
                            type: "string",
                            required: true,
                        },
                        length: {
                            type: "number",
                            required: true,
                        },
                    },
                },
                required: false,
            },
            // email headers
            headers: {
                type: "object",
                properties: {
                    "x-priority": {
                        type: "string",
                        required: false,
                    },
                    "x-msmail-priority": {
                        type: "string",
                        required: false,
                    },
                    "importance": {
                        type: "string",
                        required: false,
                    },
                    "priority": {
                        type: "string",
                        required: false,
                    },
                    "x-mailer": {
                        type: "string",
                        required: false,
                    },
                    "x-mimeole": {
                        type: "string",
                        required: false,
                    },
                    "x-msmail-priority": {
                        type: "string",
                        required: false,
                    },
                    "x-originalarrivaltime": {
                        type: "string",
                        required: false,
                    },
                    "x-transport": {
                        type: "string",
                        required: false,
                    },
                    "x-microsoft-antispam": {
                        type: "string",
                        required: false,
                    },
                    "x-incomingtopheadermarker": {
                        type: "string",
                        required: false,
                    },
                    "x-ms-exchange-organization-authas": {
                        type: "string",
                        required: false,
                    },
                },
                required: false,
            },
            // email envelope
            envelope: {
                type: "object",
                properties: {
                    from: {
                        type: "string",
                        required: true,
                    },
                    to: {
                        type: "string",
                        required: true,
                    },
                },
                required: true,
            },
            // email messageId
            messageId: {
                type: "string",
                required: true,
            },
            // email priority
            priority: {
                type: "number",
                required: false,
            },
            // email date
            date: {
                type: "number",
                required: true,
            },
            // email inReplyTo
            inReplyTo: {
                type: "string",
                required: false,
            },
            // email references
            references: {
                type: "string",
                required: false,
            },
            // email html
            html: {
                type: "string",
                required: false,
            },
            // email text
            text: {
                type: "string",
                required: false,
            },
            // email textAsHtml
            textAsHtml: {
                type: "string",
                required: false,
            },
            // email replyTo
            replyTo: {
                type: "string",
                required: false,
            },
            // email sender
            sender: {
                type: "string",
                required: false,
            },
            // email fromName
            fromName: {
                type: "string",
                required: false,
            },
            // email toName
            toName: {
                type: "string",
                required: false,
            },
            // email ccName
            ccName: {
                type: "string",
                required: false,
            },
            // email bccName
            bccName: {
                type: "string",
                required: false,
            },

            ...DbService.FIELDS,// inject dbservice fields
        },

        // default database populates
        defaultPopulates: [],

        // database scopes
        scopes: {
            ...DbService.SCOPE,// inject dbservice scope
        },

        // default database scope
        defaultScopes: [...DbService.DSCOPE],// inject dbservice dscope

        // default init config settings
        config: {

        }
    },

    /**
     * Actions
     */
    actions: {


    },

    /**
     * Events
     */
    events: {

    },

    /**
     * Methods
     */
    methods: {

    },

    /**
     * Service created lifecycle event handler
     */
    created() { },

    /**
     * Service started lifecycle event handler
     */
    started() {

    },

    /**
     * Service stopped lifecycle event handler
     */
    stopped() {

    }
};