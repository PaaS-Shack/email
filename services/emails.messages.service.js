"use strict";

const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const generator = require('generate-password');

const { MoleculerClientError } = require("moleculer").Errors;

/**
 * attachments of addons service
 */
module.exports = {
    name: "emails.messages",
    version: 1,

    mixins: [
        DbService({}),
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
        rest: "/v1/emails-messages/",

        fields: {
            body: { type: "object" },
            session: { type: "object" },
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
        },

        defaultPopulates: [],

        scopes: {
            notDeleted: { deletedAt: null },
        },

        defaultScopes: [ "notDeleted"]
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
        
    },
    /**
     * Methods
     */
    methods: {
        
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
