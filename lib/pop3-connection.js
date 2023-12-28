'use strict';

const crypto = require('crypto');
const EventEmitter = require('events');
const base32 = require('base32.js');
const packageData = require('../package.json');
const DataStream = require('nodemailer/lib/smtp-connection/data-stream');
const os = require('os');

const SOCKET_TIMEOUT = 60 * 1000;

class POP3Connection extends EventEmitter {
    constructor(service, socket, options) {
        super();

        options = options || {};

        this.ignore = options.ignore;

        this.service = service;
        this._socket = socket;

        this._closed = false;
        this._closing = false;
        this._closingTimeout = null;

        this.secured = this.service.config['emails.pop3.secure'];
        this._upgrading = false;

        // Store remote address for later usage
        this.remoteAddress = this._socket.remoteAddress;
        // Unique ID for the connection
        this.id = base32.encode(crypto.randomBytes(10)).toLowerCase();

        this.processing = false;
        this.queue = [];
        this._remainder = '';

    }
    /**
     * Initializes connection. Checks if connection is still alive and starts
     */
    init() {
        // set initial timeout
        this._setListeners();
        this._resetSession();
        // message to send to client
        let msg = '+OK ';
        if (this.service.config['emails.pop3.disableVersionString']) {
            msg += `${this.service.config['emails.pop3.name']}`;
        } else {
            msg += `${this.service.config['emails.pop3.name']} v${packageData.version}`;
        }

        msg += ` ready for requests from ${this.remoteAddress} ${this.id}`;

        this.send(msg);
    }

    /**
     * Writes a line to the socket
     */
    write(payload) {
        if (!this._socket || this._socket.destroyed || this._socket.readyState !== 'open') {
            return;
        }
        this._socket.write(payload);
    }

    /**
     * Sends a line to the socket
     */
    send(payload) {
        if (!this._socket || this._socket.destroyed || this._socket.readyState !== 'open') {
            return;
        }

        if (Array.isArray(payload)) {
            payload = payload.join('\r\n') + '\r\n.';
        }

        this.write(payload + '\r\n');
    }

    /**
     * Sets up connection listeners
     */
    _setListeners() {
        this._socket.on('close', () => this._onClose());
        this._socket.on('error', err => this._onError(err));

        const socketTimeout = this.service.config['emails.pop3.socketTimeout'] || SOCKET_TIMEOUT;
        this._socket.setTimeout(socketTimeout, () => this._onTimeout());

        this._socket.on('readable', () => {
            if (this.processing) {
                return;
            }
            this.processing = true;

            this.read();
        });
    }

    /**
     * Fired when the socket is closed
     * @event
     */
    _onClose(/* hadError */) {
        clearTimeout(this._closingTimeout);
        if (this._closed) {
            return;
        }

        this.queue = [];
        this.processing = false;
        this._remainder = '';

        this._closed = true;
        this._closing = false;

        // clear session
        this.session = null;

        this.emit('close');
    }

    /**
     * Fired when an error occurs with the socket
     *
     * @event
     * @param {Error} err Error object
     */
    _onError(err) {
        if (['ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'EHOSTUNREACH'].includes(err.code)) {
            this.close(); // mark connection as 'closing'
            return;
        }

        this.emit('error', err);
    }

    /**
     * Fired when socket timeouts. Closes connection
     *
     * @event
     */
    _onTimeout() {
        this.send('-ERR Disconnected for inactivity');
        this.close();
    }

    /**
     * Resets session data
     */
    _resetSession() {
        this.session = {
            id: this.id,
            state: 'AUTHORIZATION',
            remoteAddress: this.remoteAddress
        };
    }

    /**
     * Closes the connection
     */
    close() {
        if (this._closed || this._closing) {
            return;
        }

        if (!this._socket.destroyed && this._socket.writable) {
            this._socket.end();
        }

        this.service.connections.delete(this);

        // allow socket to close in 1500ms or force it to close
        this._closingTimeout = setTimeout(() => {
            if (this._closed) {
                return;
            }

            try {
                this._socket.destroy();
            } catch (err) {
                // ignore
            }

            setImmediate(() => this._onClose());
        }, 1500);
        this._closingTimeout.unref();

        this._closing = true;
    }

   async read() {
        let chunk;
        let data = this._remainder;
        while ((chunk = this._socket.read()) !== null) {
            data += chunk.toString('binary');
            if (data.indexOf('\n') >= 0) {
                let lines = data.split(/\r?\n/).map(line => Buffer.from(line, 'binary').toString());
                this._remainder = lines.pop();

                if (lines.length) {
                    if (this.queue.length) {
                        this.queue = this.queue.concat(lines);
                    } else {
                        this.queue = lines;
                    }
                }

                return this.processQueue();
            }
        }

        this.processing = false;
    }

    async processQueue() {
        if (!this.queue.length) {
            this.read(); // see if there's anything left to read
            return;
        }
        let line = this.queue.shift().trim();


        let parts = line.split(' ');
        let command = parts.shift().toUpperCase();
        let args = parts.join(' ');

        let logLine = (line || '').toString();
        if (/^(PASS|AUTH PLAIN)\s+[^\s]+/i.test(line)) {
            logLine = logLine.replace(/[^\s]+$/, '*hidden*');
        }

        // log command
        this.service.logger.info(`[${this.session.id}] C: ${logLine}`)

        // lookup command handler in service actions
        if (this.service.actions[command]) {
            await this.service.actions[command]({
                args,
                command,
                sline,
                session: this.session
            })
                .catch(err => {
                    this.send(`-ERR ${err.message}`);
                })
                .then(() => {
                    this.processQueue();
                });
            return;
        }



        this.send('-ERR bad command');
        this.close();
        return;
    }

}

module.exports = POP3Connection;