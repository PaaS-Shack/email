


module.exports = {
    name: "emails.imap.list",

    /**
     * Mixin settings
     */
    settings: {
        commands: {
            "LIST": {
                "arguments": ["reference", "mailbox"],
                "response": "OK",
                "handler": "listHandler"
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
         * LIST handler
         * @param {Context} ctx - moleculer context
         * @param {Object} session - imap session
         * @param {Object} command - command object
         * @param {String} command.action - command action
         * @param {Array} command.arguments - command arguments
         * @param {Object} command.options - command options
         * @returns {Promise}
         */
        async listHandler(ctx, session, command) {
            const { reference, mailbox } = command.arguments;

            // check authenticated
            if (!session.authenticated) {
                // send auth error
                return this.sendAuthError(ctx, session, command, "LIST failed");
            }

            // send untagged LIST response
            await this.sendUntaggedMailboxList(ctx, session);

            // send OK
            return this.sendTaggedOk(ctx, session, command, "LIST completed");
        },

        /**
         * Send untagged list response
         * @param {Context} ctx - moleculer context
         * @param {Object} session - imap session
         * @returns {Promise}
         */
        async sendUntaggedMailboxList(ctx, session) {
            const options = { meta: { userID: session.user.owner } };
            // list mailboxes
            const mailboxes = await ctx.call("v2.emails.mailboxes.find", {
                fields: ["name", "flags"],
            }, options);

            // send untagged LIST response
            for (const mailbox of mailboxes) {
                await this.sendUntagged(ctx, session, `[${mailbox.flags.join(" ")}] "/" "${mailbox.name}"`);
            }
        }
    }
};