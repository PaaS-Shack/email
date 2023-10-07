

**Service Name:** `emails.outbound`

**Service Version:** 1

**Description:** This service is responsible for handling outbound emails. It integrates with a database, sends emails, and manages email pools.

Here's the documentation for the service:

### Introduction

The `emails.outbound` service is a MolecularJS service designed for handling outbound email communication. It is responsible for sending emails, managing email pools, and integrating with a database for persistence.

### Service Mixins

This service uses the following mixins:

1. **DbService**: Provides database integration for storing email-related data.
   - Permissions: 'emails.outbound'

2. **ConfigLoader**: Loads configuration settings required for email service.

### Service Dependencies

This service does not have any external dependencies on other services.

### Service Settings

The service has the following settings:

- **REST API**: Enabled for external communication.
- **Fields**: Defines fields, including s3 objects.
- **Default Populates**: No default populates are specified.
- **Scopes**: Inherits scopes from DbService.
- **Default Scopes**: Inherits default scopes from DbService.
- **Default Init Config Settings**: Predefined configuration settings for DKIM.

### Service Actions

1. **send**
   - Parameters:
     - to (email)
     - from (email)
     - subject (string)
     - text (string)
   - Description: Sends an email with the specified parameters.
   - Returns: Email object.

2. **createPool**
   - Parameters:
     - mxHost (string)
   - Description: Creates an email pool for the specified mxHost.
   - Returns: Pool object.

3. **validateTo**
   - Parameters:
     - to (string)
   - Description: Validates the recipient's email address.
   - Returns: Result object.

4. **clean**
   - Description: Cleans the database by removing email-related entities.

### Service Events

1. **emails.messages.queued**
   - Description: Event handler for queued email messages.
   - Actions:
     - Retrieves queued email messages.
     - Groups recipients by mx host.
     - Sends emails using email pools.

### Service Methods

1. **sendPoolEmail**
   - Parameters:
     - ctx (context)
     - pool (pool object)
     - to (string)
     - message (object)
   - Description: Sends an email using a specified pool.
   - Resolves DKIM for the sender's domain.
   - Returns: Email info object.

2. **sendEmail**
   - Parameters:
     - ctx (context)
     - params (object)
   - Description: Sends an email with specified parameters using a pool.
   - Resolves DKIM for the sender's domain.
   - Returns: Email object.

3. **createPool**
   - Parameters:
     - ctx (context)
     - mxHost (string)
   - Description: Creates an email pool for a specified mx host.
   - Attempts to create pools on ports 465, 587, and 25.
   - Returns: Pool object.

4. **getPool**
   - Parameters:
     - ctx (context)
     - to (string)
   - Description: Retrieves or creates an email pool based on the recipient's domain.
   - Returns: Pool object.

5. **createServer**
   - Parameters:
     - ctx (context)
   - Description: Creates an outbound SMTP server.
   - Resolves key and cert for secure communication.
   - Returns: Server object.

6. **resolveKeyCert**
   - Parameters:
     - hostname (string)
   - Description: Resolves key and cert for a specified hostname.
   - Returns: Key, CA, and Cert.

7. **onAuth**
   - Parameters:
     - auth (object)
     - session (object)
   - Description: Authenticates the user for SMTP server access.
   - Returns: User object or throws an error for invalid credentials.

8. **validateFrom**
   - Parameters:
     - ctx (context)
     - from (string)
     - user (string)
   - Description: Validates the sender's email address.
   - Returns: Validation result.

9. **validateTo**
   - Parameters:
     - ctx (context)
     - to (string)
   - Description: Validates the recipient's email address.
   - Returns: Validation result.

10. **storeMessage**
    - Parameters:
      - ctx (context)
      - session (object)
      - stream (stream)
    - Description: Stores an email message in S3.
    - Returns: Updated email entity.

11. **createEnvelope**
    - Parameters:
      - session (object)
    - Description: Creates an envelope for email tracking.
    - Returns: Envelope object.

12. **closePools**
    - Description: Closes all email pools.

### Service Lifecycle

- The service is created with an empty Map for email pools.
- The service starts without any specific actions.
- The service stops by closing all email pools.

This documentation summarizes the `emails.outbound` MolecularJS service. It provides an overview of its functionality, settings, actions, events, methods, and lifecycle. If you have any specific questions or need further details about any part of the service, please feel free to ask.

Is there anything else you'd like to add or any specific questions you have about this service?GitHub Copilot: # `emails.outbound` Service

The `emails.outbound` service is a MolecularJS service designed for handling outbound email communication. It integrates with a database for persistence, sends emails, and manages email pools.

## Introduction

The `emails.outbound` service is responsible for sending emails, managing email pools, and integrating with a database for persistence.

## Service Mixins

This service uses the following mixins:

1. `DbService`: Provides database integration for storing email-related data.
   - Permissions: 'emails.outbound'

2. `ConfigLoader`: Loads configuration settings required for email service.

## Service Dependencies

This service does not have any external dependencies on other services.

## Service Settings

The service has the following settings:

- `REST API`: Enabled for external communication.
- `Fields`: Defines fields, including s3 objects.
- `Default Populates`: No default populates are specified.
- `Scopes`: Inherits scopes from DbService.
- `Default Scopes`: Inherits default scopes from DbService.
- `Default Init Config Settings`: Predefined configuration settings for DKIM.

## Service Actions

1. `send`
   - Parameters:
     - `to` (email)
     - `from` (email)
     - `subject` (string)
     - `text` (string)
   - Description: Sends an email with the specified parameters.
   - Returns: Email object.

2. `createPool`
   - Parameters:
     - `mxHost` (string)
   - Description: Creates an email pool for the specified mxHost.
   - Returns: Pool object.

3. `validateTo`
   - Parameters:
     - `to` (string)
   - Description: Validates the recipient's email address.
   - Returns: Result object.

4. `clean`
   - Description: Cleans the database by removing email-related entities.

## Service Events

1. `emails.messages.queued`
   - Description: Event handler for queued email messages.
   - Actions:
     - Retrieves queued email messages.
     - Groups recipients by mx host.
     - Sends emails using email pools.

## Service Methods

1. `sendPoolEmail`
   - Parameters:
     - `ctx` (context)
     - `pool` (pool object)
     - `to` (string)
     - `message` (object)
   - Description: Sends an email using a specified pool.
   - Resolves DKIM for the sender's domain.
   - Returns: Email info object.

2. `sendEmail`
   - Parameters:
     - `ctx` (context)
     - `params` (object)
   - Description: Sends an email with specified parameters using a pool.
   - Resolves DKIM for the sender's domain.
   - Returns: Email object.

3. `createPool`
   - Parameters:
     - `ctx` (context)
     - `mxHost` (string)
   - Description: Creates an email pool for a specified mx host.
   - Attempts to create pools on ports 465, 587, and 25.
   - Returns: Pool object.

4. `getPool`
   - Parameters:
     - `ctx` (context)
     - `to` (string)
   - Description: Retrieves or creates an email pool based on the recipient's domain.
   - Returns: Pool object.

5. `createServer`
   - Parameters:
     - `ctx` (context)
   - Description: Creates an outbound SMTP server.
   - Resolves key and cert for secure communication.
   - Returns: Server object.

6. `resolveKeyCert`
   - Parameters:
     - `hostname` (string)
   - Description: Resolves key and cert for a specified hostname.
   - Returns: Key, CA, and Cert.

7. `onAuth`
   - Parameters:
     - `auth` (object)
     - `session` (object)
   - Description: Authenticates the user for SMTP server access.
   - Returns: User object or throws an error for invalid credentials.

8. `validateFrom`
   - Parameters:
     - `ctx` (context)
     - `from` (string)
     - `user` (string)
   - Description: Validates the sender's email address.
   - Returns: Validation result.

9. `validateTo`
   - Parameters:
     - `ctx` (context)
     - `to` (string)
   - Description: Validates the recipient's email address.
   - Returns: Validation result.

10. `storeMessage`
    - Parameters:
      - `ctx` (context)
      - `session` (object)
      - `stream` (stream)
    - Description: Stores an email message in S3.
    - Returns: Updated email entity.

11. `createEnvelope`
    - Parameters:
      - `session` (object)
    - Description: Creates an envelope for email tracking.
    - Returns: Envelope object.

12. `closePools`
    - Description: Closes all email pools.

## Service Lifecycle

- The service is created with an empty Map for email pools.
- The service starts without any specific actions.
- The service stops by closing all email pools.

This documentation summarizes the `emails.outbound` MolecularJS service. It provides an overview of its functionality, settings, actions, events, methods, and lifecycle. If you have any specific questions or need further details about any part of the service, please feel free to ask.