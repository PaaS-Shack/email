


module.exports = {
    name: "emails.imap.noop",

    /**
     * Mixin settings
     */
    settings: {
        commands: {
            "NOOP": {
                "arguments": [],
                "response": "OK",
                "handler": "noopHandler"
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
         * NOOP handler
         * @param {Context} ctx - moleculer context
         * @param {Object} session - imap session
         * @param {Object} command - command object
         * @param {String} command.action - command action
         * @param {Array} command.arguments - command arguments
         * @param {Object} command.options - command options
         * @returns {Promise}
         */
        async noopHandler(ctx, session, command) {
            // send OK
            return this.sendTaggedOk(ctx, session, command, "NOOP completed");
        }
    }
};