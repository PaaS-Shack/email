


module.exports = {
    name: "emails.imap.select",

    /**
     * Mixin settings
     */
    settings: {
        commands: {
            "SELECT": {
                "arguments": ["mailbox"],
                "response": "OK",
                "handler": "selectHandler"
            }
        }
    },


    /**
     * Actions
     */
    actions: {

    },

    /**
     * Methods
     */
    methods: {
        /**
         * SELECT handler
         * @param {Context} ctx - moleculer context
         * @param {Object} session - imap session
         * @param {Object} command - command object
         * @param {String} command.action - command action
         * @param {Array} command.arguments - command arguments
         * @param {Object} command.options - command options
         * @returns {Promise}
         */
        async selectHandler(ctx, session, command) {
            const { mailbox } = command.arguments;

            // check authenticated
            if (!session.authenticated) {
                // send auth error
                return this.sendAuthError(ctx, session, command, "SELECT failed");
            }

            const options = { meta: { userID: session.user.owner } };

            // check mailbox exists
            const exists = await ctx.call("v2.emails.mailboxes.exists", { mailbox }, options);
            if (!exists) {
                // send TRYCREATE
                return this.sendTagged(ctx, session, "[TRYCREATE]", "Mailbox does not exist");

            }

            // select mailbox
            session.selectedMailbox = exists;

            // send EXISTS
            await this.sendUntaggedExists(ctx, session, exists);
            // send RECENT
            await this.sendUntaggedRecent(ctx, session, exists);
            // send FLAGS
            await this.sendUntaggedMailboxFlags(ctx, session, exists);
            // send uidvalidity
            await this.sendUntagged(ctx, session, `[UIDVALIDITY ${exists.uidvalidity}]`, '');
            // send uidnext
            await this.sendUntagged(ctx, session, `[UIDNEXT ${exists.uidnext}]`, '');

            // send OK
            return this.sendTaggedOk(ctx, session, `[READ-WRITE]`, "SELECT completed");
        },

        /**
         * send EXISTS
         * @param {Context} ctx - moleculer context
         * @param {Object} session - imap session
         * @param {Object} mailbox - mailbox object
         * @returns {Promise}
         */
        async sendUntaggedExists(ctx, session, mailbox) {
            // get total count
            const total = await ctx.call("v2.emails.messages.count", {
                query: {
                    mailbox: mailbox.id,
                }
            });
            // send EXISTS
            return this.sendUntagged(ctx, session, `${total}`, `EXISTS`);
        },

        /**
         * send RECENT
         * @param {Context} ctx - moleculer context
         * @param {Object} session - imap session
         * @param {Object} mailbox - mailbox object
         * @returns {Promise}
         */
        async sendUntaggedRecent(ctx, session, mailbox) {
            // get recent count
            const recent = await ctx.call("v2.emails.messages.count", {
                query: {
                    mailbox: mailbox.id,
                    recent: true,
                }
            });
            // send RECENT
            return this.sendUntagged(ctx, session, `${recent}`, `RECENT`);
        },

        /**
         * send FLAGS
         * @param {Context} ctx - moleculer context
         * @param {Object} session - imap session
         * @param {Object} mailbox - mailbox object
         * @returns {Promise}
         */
        async sendUntaggedMailboxFlags(ctx, session, mailbox) {
            // get flags
            const flags = mailbox.flags.join(" ");
            // send FLAGS
            return this.sendUntagged(ctx, session, "FLAGS", `(${flags})`);
        }
    }
};