GitHub Copilot: # `emails.inbound` Service

The `emails.inbound` service is an inbound SMTP server designed to handle incoming email messages. It provides functionality for receiving, processing, and storing incoming emails.

## Introduction

The `emails.inbound` service is responsible for handling incoming email messages, processing them, and storing them in a database. The service uses the `DbService` mixin for database integration, the `ConfigLoader` mixin for loading configuration settings, and the `S3Mixin` for storing email messages in an S3 storage.

## Service Mixins

This service uses the following mixins:

1. `DbService`: Provides database-related functionality for storing email-related data.
   - Permissions: 'emails.inbound'

2. `ConfigLoader`: Loads configuration settings for the service.

3. `S3Mixin`: Adds support for storing email messages in an S3 storage.

## Service Settings

The service has the following settings:

- `rest`: Enables the REST API for this service.
- `fields`: Defines various fields used by the service for storing email-related data.
- `defaultPopulates`: Specifies default database populates.
- `scopes`: Database scopes for querying data.
- `defaultScopes`: Default database scope.
- `config`: Default configuration settings for the service.

## Service Actions

1. `clean`
   - Description: Removes all email-related entities from the database.

## Service Events

This service does not have any events defined.

## Service Methods

1. `setup(ctx: Context)`
   - Parameters: `ctx` - The context object.
   - Description: Sets up the SMTP server with the provided configuration.
   - Returns: Promise.

2. `resolveKeyCert(hostname: string)`
   - Parameters: `hostname` - The hostname to resolve.
   - Description: Resolves SSL key and certificate for the specified hostname.
   - Returns: Promise containing an array `[privkey, chain, cert]` representing the private key, certificate chain, and certificate.

3. `onMailFrom(address: string, session: object, server: object)`
   - Parameters: `address` - The sender's email address, `session` - Session object, `server` - SMTP server object.
   - Description: Handles the "MAIL FROM" SMTP command.
   - Returns: Promise.

4. `onRcptTo(address: string, session: object, server: object)`
   - Parameters: `address` - The recipient's email address, `session` - Session object, `server` - SMTP server object.
   - Description: Handles the "RCPT TO" SMTP command.
   - Returns: Promise.

5. `onAuth(auth: object, session: object, server: object)`
   - Parameters: `auth` - Authentication information, `session` - Session object, `server` - SMTP server object.
   - Description: Handles SMTP authentication.
   - Returns: Promise.

6. `onData(stream: object, session: object, server: object)`
   - Parameters: `stream` - Data stream, `session` - Session object, `server` - SMTP server object.
   - Description: Handles the email data transmission.
   - Returns: Promise.

7. `onClose(session: object, server: object)`
   - Parameters: `session` - Session object, `server` - SMTP server object.
   - Description: Handles the SMTP connection close event.
   - Returns: Promise.

8. `onConnect(session: object, server: object)`
   - Parameters: `session` - Session object, `server` - SMTP server object.
   - Description: Handles the SMTP connection initiation event.
   - Returns: Promise.

9. `handleMessage(stream: object, session: object, server: object)`
   - Parameters: `stream` - Data stream, `session` - Session object, `server` - SMTP server object.
   - Description: Handles incoming email message data.
   - Returns: Promise.

10. `onSecure(socket: object, session: object, server: object)`
    - Parameters: `socket` - Secure socket object, `session` - Session object, `server` - SMTP server object.
    - Description: Handles secure SMTP connections.
    - Returns: Promise.

11. `closeServer()`
    - Description: Closes the SMTP server.
    - Returns: Promise.

12. `SNICallback(servername: string)`
    - Parameters: `servername` - The SNI servername.
    - Description: Handles Server Name Indication (SNI) for SSL connections.
    - Returns: Promise containing an SSL context.

13. `createEnvelope(session: object, server: object)`
    - Parameters: `session` - Session object, `server` - SMTP server object.
    - Description: Creates an email envelope for incoming email messages.
    - Returns: Promise.

## Service Lifecycle

- The service is created with initialization of caching and server maps.
- The service starts by setting up the SMTP server.
- The service stops by closing the SMTP server.

This documentation summarizes the `emails.inbound` MolecularJS service. It provides an overview of its functionality, settings, actions, events, methods, and lifecycle. If you have any specific questions or need further details about any part of the service, please feel free to ask.