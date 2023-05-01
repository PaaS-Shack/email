"use strict";

const { MoleculerError, MoleculerRetryableError } = require("moleculer").Errors;
const nodemailer = require("nodemailer");
const htmlToText = require("nodemailer-html-to-text").htmlToText;
const ConfigLoader = require("config-mixin");


/**
 * attachments of addons service
 */
module.exports = {
    name: "mailer",
    version: 1,

    mixins: [
        ConfigLoader(['mailer.**']),
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
        
    },

    /**
     * Actions
     */

    actions: {
        send: {
            params: {
                to: { type: "string", optional: false },
                attachments: {
                    type: "array",
                    default: [],
                    items: { type: "string", empty: false },
                },
                text: { type: "string", optional: false },
                html: { type: "string", optional: true },
                subject: { type: "string", optional: false },
            },
            async handler(ctx) {
                const params = Object.assign({}, ctx.params);
                return this.send(params);
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
        send(msg) {
            return new this.Promise((resolve, reject) => {
                this.logger.debug(`Sending email to ${msg.to} with subject '${msg.subject}'...`);

                if (!msg.from) msg.from = this.config["mailer.from"];

                if (this.transporter) {
                    this.transporter.sendMail(msg, (err, info) => {
                        if (err) {
                            this.logger.warn("Unable to send email: ", err);
                            reject(
                                new MoleculerRetryableError("Unable to send email! " + err.message)
                            );
                        } else {
                            this.logger.info("Email message sent.", info.response);
                            resolve(info);
                        }
                    });
                } else {
                    return reject(
                        new MoleculerError(
                            "Unable to send email! Invalid mailer transport: " +
                            this.settings.transport
                        )
                    );
                }
            });
        }
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
        this.transporter = nodemailer.createTransport({
            host: this.config["mailer.transport.host"],
            port: this.config["mailer.transport.port"],
            auth: {
                user: this.config["mailer.transport.auth.user"],
                pass: this.config["mailer.transport.auth.pass"]
            }
        });
        this.transporter.use("compile", htmlToText());
    },

    /**
     * Service stopped lifecycle event handler
     */
    stopped() {

    }
};
