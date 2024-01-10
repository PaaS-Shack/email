


module.exports = {
    name: "emails.imap.status",

    /**
     * Mixin settings
     */
    settings: {
        commands: {
            "STATUS": {
                "arguments": ["mailbox", "status-att"],
                "response": "OK",
                "handler": "statusHandler"
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
         * STATUS handler
         * 
         * Example:
         * C: A042 STATUS blurdybloop (UIDNEXT MESSAGES)
         * S: * STATUS blurdybloop (MESSAGES 231 UIDNEXT 44292)
         * S: A042 OK STATUS completed
         * 
         * @param {Context} ctx - moleculer context
         * @param {Object} session - imap session
         * @param {Object} command - command object
         * @param {String} command.action - command action
         * @param {Array} command.arguments - command arguments
         * @param {Object} command.options - command options
         * @returns {Promise}
         */
        async statusHandler(ctx, session, command) {
            const { mailbox: name, statusAtt } = command.arguments;

            // check authenticated
            if (!session.authenticated) {
                // send auth error
                return this.sendAuthError(ctx, session, command, "STATUS failed");
            }

            const attributes = [];

            // strip brackets
            const att = statusAtt.replace(/\(|\)/g, "");

            // split attributes
            const atts = att.split(" ");

            // check attributes
            atts.forEach((a) => {
                // check attribute
                if (["MESSAGES", "RECENT", "UIDNEXT", "UIDVALIDITY", "UNSEEN"].indexOf(a) > -1) {
                    attributes.push(a);
                }
            });

            // get mailbox
            const mailbox = await ctx.call("v2.emails.mailboxes.exists", { mailbox: name });

            // check mailbox
            if (!mailbox) {
                // send NO
                return this.sendTaggedNo(ctx, session, command, "STATUS failed");
            }


            // send untagged STATUS response
            await this.sendUntaggedMailboxStatus(ctx, session, mailbox, attributes);

            // send OK
            return this.sendTaggedOk(ctx, session, command, "STATUS completed");
        },

        /**
         * Send untagged STATUS response
         * @param {Context} ctx - moleculer context
         * @param {Object} session - imap session
         * @param {Object} mailbox - mailbox object
         * @param {Array} attributes - mailbox attributes
         * @returns {Promise}
         */
        async sendUntaggedMailboxStatus(ctx, session, mailbox, attributes) {
            const responce = [];

            // loop attributes
            for (let i = 0; i < attributes.length; i++) {
                const attribute = attributes[i];

                // check attribute
                switch (attribute) {
                    case "MESSAGES":
                        // get total count
                        const total = await ctx.call("v2.emails.messages.count", { query: { mailbox: mailbox.id } });
                        // push attribute
                        responce.push(`MESSAGES ${total}`);
                        break;
                    case "RECENT":
                        // get recent count
                        const recent = await ctx.call("v2.emails.messages.count", { query: { mailbox: mailbox.id, recent: true } });
                        // push attribute
                        responce.push(`RECENT ${recent}`);
                        break;
                    case "UIDNEXT":
                        // push attribute
                        responce.push(`UIDNEXT ${mailbox.uidnext}`);
                        break;
                    case "UIDVALIDITY":
                        // push attribute
                        responce.push(`UIDVALIDITY ${mailbox.uidvalidity}`);
                        break;
                    case "UNSEEN":
                        // get unseen count
                        const unseen = await ctx.call("v2.emails.messages.count", { query: { mailbox: mailbox.id, seen: false } });
                        // push attribute
                        responce.push(`UNSEEN ${unseen}`);
                        break;
                }
            }

            // send untagged STATUS response
            return this.sendUntagged(ctx, session, `STATUS "${mailbox.name}" (${responce.join(" ")})`);

        }
    }
};