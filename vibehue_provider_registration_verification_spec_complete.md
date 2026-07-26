# VibeHue Provider Registration & Verification Implementation Spec - Complete Version

> **Purpose:** This Markdown file is the source of truth for implementing the Provider Registration / Provider Verification module in VibeHue.  
> **Important:** This document focuses on flows, data rules, validations, security notes, API responsibilities, and implementation order. It intentionally avoids detailed source code so that the developer or AI coding assistant can implement based on the agreed design.

---

## 0. How to use this file

Use this file when implementing the Provider Registration module.

The AI/developer must follow this file strictly.

Priority:

1. Correct business flow.
2. Correct state transitions.
3. Correct use of existing collections.
4. Secure document storage.
5. Clear OCR behavior.
6. Clear Admin review behavior.
7. No extra roles or collections unless explicitly moved to Phase 2.

Do not invent alternative flows unless explicitly requested.

---

## 1. Current system context

### 1.1 Current tech stack

- Frontend: React
- Backend: NestJS
- Database: MongoDB
- Storage: MinIO
- OCR: Local OCR / Tesseract-style OCR
- Authentication: JWT + Refresh Token
- Payment: External payment gateway, no wallet

### 1.2 Current roles

The system has only 3 main roles:

```txt
CUSTOMER
ADMIN
PROVIDER
```

Do not create these roles:

```txt
PROVIDER_AODAI
PROVIDER_PHOTOGRAPHER
PROVIDER_BOTH
ADMIN_REVIEWER
SECURITY_ADMIN
SUPER_ADMIN
```

Provider type is not a role.

Provider type is represented by:

```txt
providers.capabilities
```

Examples:

```txt
Provider-AoDai:
capabilities = ['AODAI_RENTAL']

Provider-Photographer:
capabilities = ['PHOTOGRAPHY']

Provider-Both:
capabilities = ['AODAI_RENTAL', 'PHOTOGRAPHY']
```

---

## 2. Current collections

The project currently uses these collections.

### 2.1 Auth & User

1. `users`
2. `roles`
3. `permissions`
4. `refresh_tokens`
5. `verification_tokens`

### 2.2 Provider

6. `providers`
7. `provider_verifications`

### 2.3 Product / Inventory / Photographer

8. `categories`
9. `products`
10. `price_versions`
11. `promotions`
12. `inventory_items`
13. `inventory_reservations`
14. `photography_packages`
15. `provider_schedules`

### 2.4 Cart / Booking / Contract / Pickup Return

16. `carts`
17. `bookings`
18. `booking_items`
19. `booking_schedules`
20. `digital_contracts`
21. `rental_handovers`

### 2.5 Payment / Refund / Settlement

22. `payments`
23. `payment_webhook_events`
24. `refund_requests`
25. `booking_settlements`

### 2.6 Review / Dispute / Notification / Audit

26. `reviews`
27. `disputes`
28. `notifications`
29. `audit_logs`

---

## 3. Design decisions

### 3.1 Final collection decision

Use the existing collection:

```txt
provider_verifications
```

for the entire Provider registration and verification workflow.

Do not create these collections in Phase 1:

```txt
provider_applications
provider_documents
provider_verification_documents
security_alerts
data_deletion_requests
```

Mapping from older design to current design:

| Old idea | New design |
|---|---|
| `provider_applications` | Use `provider_verifications` |
| `provider_documents` | Store document metadata/version inside `provider_verifications.documents[]` |
| `ADMIN_REVIEWER` role | Use `ADMIN` role or `ADMIN` with permissions |
| `SECURITY_ADMIN` role | Use `ADMIN` role or permission `audit:view_all` |
| Provider sub-roles | Use `providers.capabilities` |

### 3.2 Final role decision

Only use:

```txt
CUSTOMER
ADMIN
PROVIDER
```

If more detailed authorization is needed, use `permissions`.

Example permission strings:

```txt
provider_verification:create_own
provider_verification:view_own
provider_verification:update_own
provider_verification:submit_own
provider_verification:review_all
provider_verification:approve_all
provider_verification:reject_all
provider_verification:request_changes_all
provider:suspend_all
audit:view_all
```

In Phase 1, it is acceptable to check role directly:

```txt
CUSTOMER can create own verification.
ADMIN can review all verifications.
PROVIDER can manage own provider resources after approval.
```

### 3.3 Final Provider type decision

Do not store `Provider-Both` as a separate role or type.

Use:

```txt
providers.capabilities
```

Allowed capability values:

```txt
AODAI_RENTAL
PHOTOGRAPHY
```

A provider with both capabilities:

```txt
['AODAI_RENTAL', 'PHOTOGRAPHY']
```

---

## 4. Scope

### 4.1 Phase 1 - Must implement

Phase 1 must support a complete demoable Provider Registration flow.

Must implement:

1. Customer creates Provider Verification.
2. Customer selects requested capabilities.
3. Customer fills business profile.
4. Customer accepts data processing consent.
5. Customer uploads required verification documents.
6. Backend stores files in MinIO private bucket.
7. Backend stores document metadata in `provider_verifications`.
8. Backend supports document versioning.
9. Backend supports OCR for current document version.
10. Customer submits verification.
11. Admin reviews verification.
12. Admin approves, rejects, or requests changes.
13. Approved verification creates or updates `providers`.
14. User receives `PROVIDER` role after approval.
15. Notifications are created for important results.
16. Audit logs are written for sensitive actions.

### 4.2 Phase 2 - Optional later

Can be implemented later:

1. `ADD_CAPABILITY`
2. `UPDATE_DOCUMENTS`
3. `REACTIVATION_REQUEST`
4. Malware scanning
5. Advanced security alerts
6. Data deletion request workflow
7. Separate `provider_verification_documents` collection
8. MinIO SSE-KMS
9. Full admin security dashboard
10. Advanced provider compliance flow

### 4.3 Out of scope for this module

Do not implement in this module:

1. Booking flow.
2. Payment settlement.
3. Refund workflow.
4. Dispute resolution.
5. Full eKYC.
6. Face matching.
7. Government ID database verification.
8. Automatic Provider approval by OCR.

---

## 5. Domain model overview

### 5.1 users

`users` stores:

- Auth profile
- Roles
- Default role
- Account status
- Profile
- Preferences
- Addresses
- Favorites
- Loyalty summary
- Provider link
- Security information
- Consent information

Provider-related user fields can include:

```txt
roles: ['CUSTOMER', 'PROVIDER']
providerId: ObjectId
```

After Provider verification is approved:

```txt
Add PROVIDER role to user.
Set providerId if needed.
```

### 5.2 roles

Allowed roles:

```txt
CUSTOMER
ADMIN
PROVIDER
```

Do not create:

```txt
PROVIDER_AODAI
PROVIDER_PHOTOGRAPHER
PROVIDER_BOTH
```

Reason:

```txt
Role defines the user's permission group.
Capability defines what the Provider can offer.
```

### 5.3 providers

`providers` stores the approved Provider profile.

Important fields:

```txt
userId
businessName
capabilities
contact
address
media
policies
paymentAccounts[]
rating
status
approvedAt
approvedBy
createdAt
updatedAt
```

Provider status:

```txt
PENDING_APPROVAL
ACTIVE
SUSPENDED
REJECTED
```

Recommended Phase 1 behavior:

```txt
Only create provider after provider_verification is approved.
```

This keeps `providers` clean and prevents mixing draft verification data with active Provider data.

### 5.4 provider_verifications

`provider_verifications` is the central collection for Provider Registration.

It stores:

- Owner user
- Requested capabilities
- Business profile snapshot
- Consent
- Required documents
- Uploaded document metadata
- Document version history
- OCR results
- Verification status
- Admin review decision
- Status timeline

This collection replaces the need for `provider_applications` and `provider_documents` in Phase 1.

---

## 6. provider_verifications collection design

### 6.1 Purpose

`provider_verifications` stores the entire verification workflow before a Provider becomes active.

It should answer:

1. Who submitted the verification?
2. What capabilities did they request?
3. What business information did they provide?
4. Did they accept consent?
5. What documents did they upload?
6. What did OCR extract?
7. What mismatch flags were detected?
8. What did Admin decide?
9. What is the current verification status?
10. What is the history of status changes?

### 6.2 Main field groups

#### Owner

```txt
userId
providerId
```

| Field | Meaning |
|---|---|
| userId | User who submitted the verification |
| providerId | Created after approval, can be null before approval |

#### Verification info

```txt
verificationType
requestedCapabilities
status
```

`verificationType` values:

```txt
NEW_PROVIDER
ADD_CAPABILITY
UPDATE_DOCUMENTS
REACTIVATION_REQUEST
```

Phase 1 only needs:

```txt
NEW_PROVIDER
```

`requestedCapabilities` examples:

```txt
['AODAI_RENTAL']
['PHOTOGRAPHY']
['AODAI_RENTAL', 'PHOTOGRAPHY']
```

#### Business profile snapshot

Store the information submitted by user:

```txt
businessName
ownerName
phone
email
address
province
description
aodaiInfo
photographyInfo
```

Important:

```txt
This is the submitted verification snapshot.
When approved, this data is copied into providers.
```

#### Ao Dai info

Required when `requestedCapabilities` includes `AODAI_RENTAL`.

Fields:

```txt
shopName
rentalPolicy
depositPolicy
pickupAddress
sizeSupport
```

#### Photography info

Required when `requestedCapabilities` includes `PHOTOGRAPHY`.

Fields:

```txt
studioName
workingArea
photographyStyles
portfolioUrls
```

#### Consent

```txt
consent.accepted
consent.version
consent.acceptedAt
consent.ipAddress
consent.userAgent
```

Rules:

```txt
User cannot upload verification documents before consent is accepted.
Consent must be stored with version and timestamp.
```

#### Documents

Use:

```txt
documents[]
```

Each document entry represents one document type.

Each document entry should have:

```txt
documentType
required
currentVersion
versions[]
```

Each version should have:

```txt
versionNo
isCurrent
uploadStatus
storageProvider
bucket
storageKey
originalFileName
mimeType
size
checksum
fileValidation
ocrStatus
ocrConfidence
extractedFields
mismatchFlags
uploadedAt
processedAt
replacedAt
deletedAt
```

Important:

```txt
Only metadata is stored in MongoDB.
The actual file is stored in MinIO.
```

#### Review

```txt
review.reviewedBy
review.reviewedAt
review.decision
review.reason
review.note
```

Decision values:

```txt
APPROVED
REJECTED
NEEDS_CHANGES
```

#### Status timeline

Use:

```txt
statusTimeline[]
```

Each timeline item:

```txt
fromStatus
toStatus
changedBy
changedAt
reason
```

Purpose:

```txt
Debugging
Admin history
Audit support
Demo explanation
```

---

## 7. Verification status machine

Allowed statuses:

```txt
DRAFT
SUBMITTED
UNDER_REVIEW
NEEDS_CHANGES
APPROVED
REJECTED
CANCELLED
```

### 7.1 Status meaning

| Status | Meaning |
|---|---|
| DRAFT | Customer is filling the verification form |
| SUBMITTED | Customer submitted for review |
| UNDER_REVIEW | Admin is reviewing |
| NEEDS_CHANGES | Admin requested changes |
| APPROVED | Verification approved |
| REJECTED | Verification rejected |
| CANCELLED | Customer cancelled before review |

### 7.2 User permissions by status

| Status | User can edit profile | User can upload document | User can submit |
|---|---:|---:|---:|
| DRAFT | Yes | Yes | Yes |
| SUBMITTED | No | No | No |
| UNDER_REVIEW | No | No | No |
| NEEDS_CHANGES | Yes | Yes | Yes |
| APPROVED | No | No | No |
| REJECTED | Optional | Optional | Optional |
| CANCELLED | No | No | No |

### 7.3 Admin permissions by status

| Status | Admin can approve/reject/request changes |
|---|---:|
| DRAFT | No |
| SUBMITTED | Yes |
| UNDER_REVIEW | Yes |
| NEEDS_CHANGES | No |
| APPROVED | No |
| REJECTED | No |
| CANCELLED | No |

### 7.4 Important status rules

```txt
User can only edit and upload documents when status is DRAFT or NEEDS_CHANGES.
```

```txt
After SUBMITTED, user cannot edit until Admin requests changes.
```

```txt
After APPROVED, user cannot upload new verification documents directly.
```

```txt
Provider suspension does not change old provider_verification status.
```

---

## 8. Provider status machine

`providers.status` values:

```txt
PENDING_APPROVAL
ACTIVE
SUSPENDED
REJECTED
```

Recommended Phase 1 behavior:

```txt
Create provider only after verification is APPROVED.
Set providers.status = ACTIVE.
```

If later creating provider earlier:

```txt
Create with PENDING_APPROVAL.
Set ACTIVE only after approval.
```

### Important separation

`provider_verifications.status` and `providers.status` are separate.

Example:

```txt
provider_verifications.status = APPROVED
providers.status = ACTIVE
```

If provider is suspended later:

```txt
provider_verifications.status remains APPROVED
providers.status becomes SUSPENDED
```

---

## 9. Required documents

### 9.1 Document types

Supported document types:

```txt
IDENTITY_CARD_FRONT
IDENTITY_CARD_BACK
PASSPORT
BUSINESS_LICENSE
TAX_REGISTRATION
SHOP_PHOTO_PROOF
STUDIO_PORTFOLIO_PROOF
PROFESSIONAL_CERTIFICATE
```

### 9.2 Required documents by capability

#### AODAI_RENTAL

Required:

```txt
IDENTITY_CARD_FRONT
IDENTITY_CARD_BACK
SHOP_PHOTO_PROOF
```

Optional in Phase 1:

```txt
BUSINESS_LICENSE
```

#### PHOTOGRAPHY

Required:

```txt
IDENTITY_CARD_FRONT
IDENTITY_CARD_BACK
STUDIO_PORTFOLIO_PROOF
```

Optional in Phase 1:

```txt
BUSINESS_LICENSE
```

#### Both capabilities

Required:

```txt
IDENTITY_CARD_FRONT
IDENTITY_CARD_BACK
SHOP_PHOTO_PROOF
STUDIO_PORTFOLIO_PROOF
```

Optional:

```txt
BUSINESS_LICENSE
```

---

## 10. Full Provider Registration Flow

### Step 1: Customer starts Provider verification

Preconditions:

```txt
User is authenticated.
User has CUSTOMER role.
User email is verified.
User does not already have an active NEW_PROVIDER verification in DRAFT, SUBMITTED, or UNDER_REVIEW.
```

Actions:

```txt
Create provider_verifications document.
verificationType = NEW_PROVIDER.
requestedCapabilities = selected capabilities.
status = DRAFT.
Resolve required documents from requestedCapabilities.
Initialize documents[] with required document types.
Initialize documentSummary.
Write audit log.
```

Audit:

```txt
CREATE_PROVIDER_VERIFICATION
```

### Step 2: Customer updates verification profile

Allowed only when:

```txt
status = DRAFT or NEEDS_CHANGES
```

Actions:

```txt
Update business profile snapshot.
Validate required fields based on requestedCapabilities.
Update statusTimeline if necessary.
Write audit log.
```

Validation:

```txt
If AODAI_RENTAL is requested, validate Ao Dai info.
If PHOTOGRAPHY is requested, validate Photography info.
If both are requested, validate both.
```

Audit:

```txt
UPDATE_PROVIDER_VERIFICATION
```

### Step 3: Customer accepts consent

Precondition:

```txt
Verification exists.
User is owner.
Status is DRAFT or NEEDS_CHANGES.
```

Actions:

```txt
Set consent.accepted = true.
Set consent.version.
Set consent.acceptedAt.
Set consent.ipAddress.
Set consent.userAgent.
Write audit log.
```

Rule:

```txt
Document upload is blocked until consent.accepted = true.
```

Audit:

```txt
ACCEPT_PROVIDER_VERIFICATION_CONSENT
```

### Step 4: Customer uploads verification document

Preconditions:

```txt
User is authenticated.
User is owner of provider_verification.
Verification status is DRAFT or NEEDS_CHANGES.
consent.accepted = true.
Upload rate limit is not exceeded.
```

Backend checks:

```txt
JWT.
Owner permission.
Verification status.
Consent.
Upload quota.
File validation.
```

File validation:

```txt
Allowed extensions: jpg, jpeg, png, pdf.
Must check magic bytes.
Max file size: 5MB.
Minimum image resolution: 800x500 for images.
Optional malware scan in Phase 2.
```

Actions:

```txt
Create new document version.
Upload file to MinIO private bucket.
Store metadata in documents[].versions[].
Mark previous version isCurrent = false.
Mark new version isCurrent = true.
Write audit log.
```

Important:

```txt
Do not return public file URL.
Do not return MinIO storageKey to frontend unless strictly needed internally.
Frontend receives documentType, versionNo, uploadStatus, ocrStatus.
```

Audit:

```txt
UPLOAD_PROVIDER_VERIFICATION_DOCUMENT
DOCUMENT_VERSION_CREATED
```

---

## 11. Document versioning rules

### 11.1 First upload

If document type does not have any version:

```txt
Create versionNo = 1.
Set isCurrent = true.
Set currentVersion = 1.
```

### 11.2 Re-upload same document type

If document type already has current version:

```txt
Keep old version.
Set old version isCurrent = false.
Set old version replacedAt = now.
Create new version.
Set new versionNo = previousVersion + 1.
Set new version isCurrent = true.
Set currentVersion = new versionNo.
```

### 11.3 Do not delete old versions

Reason:

```txt
Preserve audit trail.
Allow Admin to compare old and new documents.
Detect suspicious repeated changes.
Support dispute or investigation.
```

---

## 12. MinIO storage design

### 12.1 Bucket design

Use:

```txt
provider-documents
```

for sensitive Provider verification documents.

Bucket must be private.

Other buckets:

```txt
ocr-temp-files
product-images
system-backups
```

### 12.2 Storage rules

```txt
Files are stored in MinIO.
MongoDB stores metadata and storageKey only.
Frontend never accesses MinIO directly.
Backend is the only service with MinIO credentials.
No public URL is returned.
```

### 12.3 Object key format

Use format:

```txt
provider-verifications/{verificationId}/documents/{documentType}/v{versionNo}-{randomId}
```

Do not use:

```txt
User full name.
ID card number.
Original filename as primary key.
Publicly guessable path.
```

### 12.4 Production security

Production should use:

```txt
HTTPS between frontend and backend.
HTTPS or private network between backend and MinIO.
Private bucket.
Service account instead of root MinIO key.
Access key rotation.
Encryption at rest if possible.
```

---

## 13. Upload consistency and orphan cleanup

### 13.1 Problem

Possible failure:

```txt
MinIO upload succeeds but MongoDB update fails.
```

This creates orphan object.

### 13.2 Phase 1 recommended approach

Because documents are embedded inside `provider_verifications`, use this order:

```txt
1. Create document version metadata with uploadStatus = PENDING_UPLOAD.
2. Upload file to MinIO.
3. Update version uploadStatus = UPLOADED.
4. If upload fails, mark UPLOAD_FAILED.
```

### 13.3 Cleanup job

A scheduled backend job should:

```txt
Run every 30 minutes.
Find document versions with PENDING_UPLOAD older than 30 minutes.
Check if MinIO object exists.
Delete orphan object if needed.
Mark version UPLOAD_FAILED or DELETED.
Write audit log.
```

Audit:

```txt
ORPHAN_OBJECT_CLEANED
```

---

## 14. OCR design

### 14.1 OCR purpose

OCR is used to support Admin review.

OCR can:

```txt
Extract text from documents.
Detect ID number.
Detect owner name if possible.
Estimate confidence score.
Compare extracted data with submitted form.
Generate mismatch flags.
```

OCR cannot:

```txt
Automatically approve Provider.
Legally verify document authenticity.
Replace Admin decision.
Guarantee fake document detection.
```

### 14.2 OCR flow

```txt
1. User/Admin triggers OCR for current document version.
2. Backend checks permission.
3. Backend checks OCR rate limit.
4. Backend reads file from MinIO private bucket.
5. OCR service processes file.
6. OCR extracts fields.
7. System masks/hashes sensitive values.
8. System compares fields with verification profile.
9. System creates mismatch flags.
10. System saves OCR result to current document version.
11. System writes audit log.
```

### 14.3 OCR status values

```txt
NOT_STARTED
OCR_PROCESSING
OCR_PASSED
OCR_FAILED
OCR_LOW_CONFIDENCE
MISMATCH_DETECTED
NEEDS_MANUAL_REVIEW
```

### 14.4 OCR decision rules

| Condition | OCR status |
|---|---|
| Cannot read required fields | OCR_FAILED |
| Confidence < 0.8 | OCR_LOW_CONFIDENCE |
| Extracted field mismatches profile | MISMATCH_DETECTED |
| Good confidence and no mismatch | OCR_PASSED |

### 14.5 OCR data storage

Store safe data only:

```txt
fullName
idNumberMasked
idNumberHash
ocrConfidence
mismatchFlags
processedAt
```

Do not store long-term:

```txt
Raw OCR text.
Plain ID card number.
Temporary processed image.
Sensitive values in logs.
```

Audit:

```txt
RUN_PROVIDER_VERIFICATION_OCR
```

---

## 15. Submit verification

### 15.1 Submit preconditions

User can submit if:

```txt
Status is DRAFT or NEEDS_CHANGES.
Required business fields are complete.
Consent is accepted.
Required documents are uploaded.
No required current document has OCR_FAILED.
```

Allowed with Admin warning:

```txt
OCR_LOW_CONFIDENCE
MISMATCH_DETECTED
NEEDS_MANUAL_REVIEW
```

Blocked:

```txt
Missing required document.
Consent not accepted.
Required document OCR_FAILED.
Status is SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, or CANCELLED.
```

### 15.2 Submit actions

```txt
Set status = SUBMITTED.
Add statusTimeline entry.
Write audit log.
Create notification for Admin if needed.
```

Audit:

```txt
SUBMIT_PROVIDER_VERIFICATION
```

---

## 16. Admin review flow

### 16.1 Admin can view

Admin should see:

```txt
Verification owner.
Requested capabilities.
Business profile snapshot.
Consent information.
Current documents.
Document version history.
OCR results.
Mismatch flags.
Status timeline.
Related audit logs if available.
```

### 16.2 Admin actions

Admin can:

```txt
Approve.
Reject.
Request changes.
```

---

## 17. Admin approve flow

### 17.1 Preconditions

Admin can approve if:

```txt
Verification status is SUBMITTED or UNDER_REVIEW.
Required documents are present.
No required document is OCR_FAILED.
Admin has ADMIN role.
```

### 17.2 Actions

```txt
Set provider_verifications.status = APPROVED.
Set review.decision = APPROVED.
Set review.reviewedBy.
Set review.reviewedAt.
Create providers document.
Copy business profile snapshot to providers.
Set providers.capabilities = requestedCapabilities.
Set providers.status = ACTIVE.
Set providers.approvedAt.
Set providers.approvedBy.
Add PROVIDER role to user if not already present.
Set users.providerId if using provider link.
Create notification for user.
Write audit log.
```

Audit:

```txt
APPROVE_PROVIDER_VERIFICATION
CREATE_PROVIDER_FROM_VERIFICATION
```

Notification:

```txt
Your Provider verification has been approved.
```

---

## 18. Admin reject flow

### 18.1 Preconditions

Admin can reject if:

```txt
Verification status is SUBMITTED or UNDER_REVIEW.
Admin has ADMIN role.
Reject reason is provided.
```

### 18.2 Actions

```txt
Set provider_verifications.status = REJECTED.
Set review.decision = REJECTED.
Save reason.
Add statusTimeline entry.
Create notification for user.
Write audit log.
```

Audit:

```txt
REJECT_PROVIDER_VERIFICATION
```

Notification:

```txt
Your Provider verification has been rejected.
```

---

## 19. Admin request changes flow

### 19.1 Preconditions

Admin can request changes if:

```txt
Verification status is SUBMITTED or UNDER_REVIEW.
Admin has ADMIN role.
Reason is provided.
```

### 19.2 Actions

```txt
Set provider_verifications.status = NEEDS_CHANGES.
Set review.decision = NEEDS_CHANGES.
Save reason.
Add statusTimeline entry.
Create notification for user.
Write audit log.
```

After that:

```txt
User can update profile.
User can upload new document versions.
Old document versions are preserved.
```

Audit:

```txt
REQUEST_PROVIDER_VERIFICATION_CHANGES
```

Notification:

```txt
Your Provider verification requires changes.
```

---

## 20. View document flow

### 20.1 Customer view own document

Customer can view own document only if:

```txt
User owns the provider_verification.
Document exists.
Document version is not deleted.
```

### 20.2 Admin view document

Admin can view any verification document for review.

### 20.3 Backend flow

```txt
Check JWT.
Check owner or ADMIN role.
Check rate limit.
Load document metadata from provider_verifications.
Read object from MinIO.
Stream file through backend.
Write audit log.
```

Do not:

```txt
Return public URL.
Expose storageKey to frontend.
Allow direct MinIO access.
```

Audit:

```txt
VIEW_PROVIDER_VERIFICATION_DOCUMENT
FAILED_PROVIDER_VERIFICATION_DOCUMENT_ACCESS
```

Security headers:

```txt
Cache-Control: no-store
Pragma: no-cache
X-Content-Type-Options: nosniff
Content-Disposition: inline
```

---

## 21. Rate limits

Recommended Phase 1 limits:

| Endpoint | Limit |
|---|---|
| Upload document | 10/hour/user |
| View document | 30/minute/user |
| Run OCR | 5/hour/user |
| OCR per document | 3/day/document |
| Submit verification | 10/hour/user |
| Admin review actions | Reasonable admin rate limit |
| Failed document access | Alert after repeated 403 |

If a user repeatedly gets 403 viewing documents:

```txt
Write audit log.
Optionally create notification/admin alert.
Optionally temporarily block document view.
```

---

## 22. Audit log requirements

### 22.1 Required audit actions

```txt
CREATE_PROVIDER_VERIFICATION
UPDATE_PROVIDER_VERIFICATION
ACCEPT_PROVIDER_VERIFICATION_CONSENT
UPLOAD_PROVIDER_VERIFICATION_DOCUMENT
DOCUMENT_VERSION_CREATED
RUN_PROVIDER_VERIFICATION_OCR
VIEW_PROVIDER_VERIFICATION_DOCUMENT
FAILED_PROVIDER_VERIFICATION_DOCUMENT_ACCESS
SUBMIT_PROVIDER_VERIFICATION
APPROVE_PROVIDER_VERIFICATION
CREATE_PROVIDER_FROM_VERIFICATION
REJECT_PROVIDER_VERIFICATION
REQUEST_PROVIDER_VERIFICATION_CHANGES
SUSPEND_PROVIDER
UNSUSPEND_PROVIDER
ORPHAN_OBJECT_CLEANED
PROVIDER_DOCUMENT_DELETED
```

### 22.2 Audit log fields

```txt
actorId
actorRole
action
targetType
targetId
metadata
ipAddress
userAgent
createdAt
```

### 22.3 Audit rules

```txt
Audit log should be append-only.
Normal users cannot view audit logs.
ADMIN can view audit logs if allowed by permission.
Do not log raw ID card number.
Do not log raw OCR text.
```

---

## 23. Notifications

Use `notifications` collection for important events.

Create notification when:

```txt
Verification submitted.
Admin approves verification.
Admin rejects verification.
Admin requests changes.
Provider is suspended.
Provider is unsuspended.
```

Notification targets:

```txt
Customer / Provider owner
Admin if needed
```

---

## 24. Data security rules

### 24.1 Document storage security

```txt
Do not store files in MongoDB.
Do not store files in public folder.
Do not return public URL.
Do not let frontend access MinIO directly.
Do not expose MinIO credentials.
```

### 24.2 Sensitive data handling

```txt
Mask ID number.
Hash ID number if duplicate checking is needed.
Do not store raw OCR text long-term.
Do not log sensitive document data.
```

### 24.3 Payment account security

In `providers.paymentAccounts[]`:

```txt
Store masked account number.
Do not treat paymentAccounts as wallet.
Do not create balance.
Do not allow withdrawal logic.
```

If storing full bank account number is required:

```txt
Encrypt the field.
Restrict access.
Audit admin access.
```

---

## 25. Data retention

Phase 1 can implement basic retention later, but design should follow:

```txt
Backend scheduled job is the main retention mechanism.
MinIO lifecycle is only supplementary for temp files.
```

Retention suggestions:

| Data | Rule |
|---|---|
| OCR temp files | Delete after 1 day |
| Rejected verification documents | Delete after 30 days if no dispute/security hold |
| Replaced document versions | Keep during retention period |
| Approved verification documents | Keep restricted |
| Audit logs | Keep longer, but avoid sensitive metadata |

---

## 26. API design

### 26.1 Customer APIs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/provider-verifications` | Create verification |
| GET | `/provider-verifications/me/current` | Get current verification |
| GET | `/provider-verifications/:id` | Get verification detail |
| PATCH | `/provider-verifications/:id` | Update verification profile |
| POST | `/provider-verifications/:id/consent` | Accept consent |
| POST | `/provider-verifications/:id/documents` | Upload document |
| GET | `/provider-verifications/:id/documents` | List documents |
| GET | `/provider-verifications/:id/documents/:documentType/view` | View current document |
| POST | `/provider-verifications/:id/documents/:documentType/ocr` | Run OCR |
| POST | `/provider-verifications/:id/submit` | Submit verification |
| GET | `/provider-verifications/:id/status` | Get status |

### 26.2 Admin APIs

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/admin/provider-verifications` | List verifications |
| GET | `/admin/provider-verifications/:id` | Verification detail |
| GET | `/admin/provider-verifications/:id/documents/:documentType/view` | View document |
| PATCH | `/admin/provider-verifications/:id/approve` | Approve |
| PATCH | `/admin/provider-verifications/:id/reject` | Reject |
| PATCH | `/admin/provider-verifications/:id/request-changes` | Request changes |
| PATCH | `/admin/providers/:id/suspend` | Suspend provider |
| PATCH | `/admin/providers/:id/unsuspend` | Unsuspend provider |

---

## 27. Frontend screens

### 27.1 Customer screens

```txt
BecomeProviderPage
ProviderCapabilitySelection
ProviderBusinessProfileForm
ProviderConsentStep
ProviderDocumentUploadStep
ProviderOcrResultStep
ProviderReviewBeforeSubmit
ProviderVerificationStatusPage
```

### 27.2 Admin screens

```txt
AdminProviderVerificationList
AdminProviderVerificationDetail
AdminProviderDocumentViewer
AdminProviderDocumentVersionHistory
AdminOcrResultPanel
AdminReviewDecisionModal
```

---

## 28. Frontend flow

Recommended stepper:

```txt
Step 1: Select capabilities
Step 2: Fill business profile
Step 3: Accept consent
Step 4: Upload required documents
Step 5: Run OCR / check OCR result
Step 6: Review information
Step 7: Submit
Step 8: Track status
```

Frontend rules:

```txt
Do not display MinIO URL.
Use backend API to view documents.
Show OCR warnings clearly.
Show missing required documents.
Disable submit until required fields are complete.
```

---

## 29. Backend module responsibility

Suggested module name:

```txt
ProviderVerificationModule
```

Responsibilities:

```txt
Create verification.
Update verification.
Accept consent.
Upload documents.
Manage document versions.
Run OCR.
Submit verification.
Admin review.
Approve/reject/request changes.
Create provider from approved verification.
Write audit logs.
Create notifications.
```

Suggested internal services:

```txt
ProviderVerificationService
ProviderVerificationDocumentService
ProviderVerificationOcrService
ProviderVerificationReviewService
ProviderActivationService
ProviderVerificationAuditService
ProviderVerificationCleanupService
```

These are logical responsibilities. Actual file names can follow the project's existing convention.

---

## 30. Implementation order

Follow this order to avoid confusion:

```txt
1. Confirm roles: CUSTOMER, ADMIN, PROVIDER.
2. Confirm provider capabilities.
3. Create provider_verifications schema.
4. Confirm providers schema supports capabilities.
5. Implement create provider verification.
6. Implement get/update own verification.
7. Implement consent API.
8. Setup MinIO private bucket.
9. Implement upload document.
10. Store document metadata in provider_verifications.documents[].
11. Implement document versioning.
12. Implement view document through backend.
13. Implement OCR flow.
14. Implement submit verification.
15. Implement admin list/detail.
16. Implement admin approve/reject/request changes.
17. Implement provider activation on approval.
18. Add PROVIDER role to user after approval.
19. Create notifications.
20. Write audit logs.
21. Add rate limits.
22. Add cleanup job for PENDING_UPLOAD.
23. Prepare frontend stepper.
24. Prepare demo test cases.
```

---

## 31. Acceptance criteria

### 31.1 Verification creation

Must pass:

```txt
Customer can create NEW_PROVIDER verification.
Guest cannot create verification.
Unverified email cannot create verification.
Customer cannot create duplicate active verification.
```

### 31.2 Profile update

Must pass:

```txt
Owner can update verification in DRAFT.
Owner can update verification in NEEDS_CHANGES.
Owner cannot update verification in SUBMITTED.
Owner cannot update verification in APPROVED.
```

### 31.3 Consent

Must pass:

```txt
Owner can accept consent.
Consent version is stored.
Consent timestamp is stored.
Cannot upload document before consent.
```

### 31.4 Document upload

Must pass:

```txt
Valid document uploads to MinIO.
Metadata saved in provider_verifications.
No public URL returned.
Fake MIME file is rejected.
Oversized file is rejected.
Low resolution image is rejected.
Re-upload creates new version.
Old version remains.
```

### 31.5 OCR

Must pass:

```txt
OCR reads current document from MinIO.
OCR result is saved to current version.
ID number is masked/hashed.
OCR does not approve verification.
Mismatch creates warning.
Low confidence creates warning.
```

### 31.6 Submit

Must pass:

```txt
Cannot submit without consent.
Cannot submit without required documents.
Cannot submit if required document OCR_FAILED.
Can submit with OCR_LOW_CONFIDENCE or MISMATCH_DETECTED.
Submit changes status to SUBMITTED.
```

### 31.7 Admin review

Must pass:

```txt
Admin can list submitted verifications.
Admin can view verification detail.
Admin can view current documents.
Admin can see version history.
Admin can approve.
Admin can reject with reason.
Admin can request changes with reason.
```

### 31.8 Approval

Must pass:

```txt
Approval creates provider.
Provider status becomes ACTIVE.
Provider capabilities match requestedCapabilities.
User receives PROVIDER role.
Notification is created.
Audit log is written.
```

### 31.9 Security

Must pass:

```txt
Guest cannot view document.
Other customer cannot view document.
Owner can view own document.
Admin can view for review.
MinIO URL is not exposed.
Audit log is written for document view.
```

---

## 32. Test cases

### 32.1 Happy path

```txt
Customer logs in.
Customer creates verification.
Customer selects AODAI_RENTAL.
Customer fills profile.
Customer accepts consent.
Customer uploads ID front/back and shop proof.
Customer runs OCR.
Customer submits verification.
Admin approves.
Provider is created.
User receives PROVIDER role.
```

### 32.2 Request changes path

```txt
Customer submits verification.
Admin finds mismatch.
Admin requests changes.
Status becomes NEEDS_CHANGES.
Customer uploads new document version.
Old version remains.
Customer submits again.
Admin approves.
```

### 32.3 Reject path

```txt
Customer submits invalid verification.
Admin rejects with reason.
Status becomes REJECTED.
Notification is sent.
```

### 32.4 Security path

```txt
Guest tries to view document → 401.
Other customer tries to view document → 403.
Owner views document → success.
Admin views document → success.
Audit log is created.
```

### 32.5 Upload validation path

```txt
Upload .exe renamed to .jpg → reject.
Upload image below 800x500 → reject.
Upload file larger than 5MB → reject.
Upload without consent → reject.
Upload after APPROVED → reject.
```

---

## 33. Demo checklist

Prepare:

```txt
Customer account.
Admin account.
MinIO running.
Private provider-documents bucket.
Sample valid ID image.
Sample invalid file.
Audit log access.
```

Demo flow:

```txt
1. Customer creates provider verification.
2. Customer selects Provider-AoDai.
3. Customer fills profile.
4. Customer accepts consent.
5. Customer uploads document.
6. Show API does not return public URL.
7. Show MinIO bucket is private.
8. Run OCR.
9. Show OCR result with masked ID number.
10. Submit verification.
11. Admin views verification.
12. Admin views document.
13. Admin requests changes.
14. Customer uploads new version.
15. Admin sees version history.
16. Admin approves.
17. Provider becomes ACTIVE.
18. User role includes PROVIDER.
```

---

## 34. Do not implement differently

Do not:

```txt
Create PROVIDER_AODAI role.
Create PROVIDER_PHOTOGRAPHER role.
Create PROVIDER_BOTH role.
Create provider_applications collection in Phase 1.
Create provider_documents collection in Phase 1.
Store document files in MongoDB.
Store CCCD in public folder.
Return public document URL.
Allow frontend to access MinIO.
Auto approve Provider by OCR.
Delete old document version on re-upload.
Allow upload after APPROVED.
Mix provider_verifications.status and providers.status.
Use wallet logic for provider payment accounts.
```

---

## 35. Final summary

Final architecture:

```txt
Roles:
CUSTOMER, ADMIN, PROVIDER

Provider type:
providers.capabilities

Registration/verification hồ sơ:
provider_verifications

Active provider profile:
providers

Verification documents:
provider_verifications.documents[].versions[]

Actual file storage:
MinIO private bucket

OCR result:
Stored in current document version

Audit:
audit_logs

Notification:
notifications
```

This design fits the current 29-collection architecture, avoids unnecessary new collections, keeps roles clean, supports Provider-AoDai / Provider-Photographer / Provider-Both through capabilities, and provides enough structure for AI/developers to implement the module without confusion.

---

# 36. Final Additional Implementation Rules

> This section completes the Provider Verification implementation specification. These rules must be followed to avoid ambiguous behavior during coding.

---

## 36.1 Storage Service Layer

Even though the system uses MinIO, Provider Verification services must not call MinIO directly.

Correct dependency direction:

```txt
ProviderVerificationDocumentService
→ PrivateStorageService
→ MinioPrivateStorageService
→ MinIO private bucket
```

Incorrect dependency direction:

```txt
ProviderVerificationDocumentService
→ MinIO SDK directly
```

### Responsibilities of PrivateStorageService

PrivateStorageService is responsible for:

```txt
Uploading private files.
Reading private files as stream.
Deleting private files.
Checking whether a file exists.
Keeping storage provider details hidden from business services.
```

PrivateStorageService is not responsible for:

```txt
Checking user permissions.
Checking verification status.
Running OCR.
Approving Provider.
Writing business audit logs.
Creating notifications.
```

### Final storage decision

The system uses:

```txt
MinIO as the current storage provider.
PrivateStorageService as the backend abstraction layer.
provider_verifications as the metadata store.
```

MinIO must not replace the storage service layer.

---

## 36.2 Schema and Index Checklist

### provider_verifications

Recommended indexes:

```txt
userId
status
verificationType
requestedCapabilities
createdAt
```

Recommended business rule:

```txt
One user must not have more than one active NEW_PROVIDER verification at the same time.
```

Active verification statuses:

```txt
DRAFT
SUBMITTED
UNDER_REVIEW
NEEDS_CHANGES
```

If user already has a verification in one of these statuses, do not allow creating another `NEW_PROVIDER` verification.

### providers

Recommended indexes:

```txt
userId
status
capabilities
province
```

Recommended Phase 1 rule:

```txt
One user must not have duplicate ACTIVE provider profiles.
```

If user already has an ACTIVE provider during `NEW_PROVIDER` approval, return conflict or move to the future `ADD_CAPABILITY` flow.

### audit_logs

Recommended indexes:

```txt
actorId
action
targetType
targetId
createdAt
```

### notifications

Recommended indexes:

```txt
userId
isRead
createdAt
type
```

---

## 36.3 requestedCapabilities Validation

`requestedCapabilities` must follow these rules:

```txt
Must not be empty.
Must only contain AODAI_RENTAL or PHOTOGRAPHY.
Must not contain duplicate values.
```

If `requestedCapabilities` contains `AODAI_RENTAL`, then `aodaiInfo` must be provided and valid before submit.

If `requestedCapabilities` contains `PHOTOGRAPHY`, then `photographyInfo` must be provided and valid before submit.

If both capabilities are selected, both `aodaiInfo` and `photographyInfo` must be valid before submit.

### Changing requestedCapabilities

In Phase 1:

```txt
User can change requestedCapabilities only before uploading any document.
```

After at least one document has been uploaded:

```txt
Do not allow changing requestedCapabilities.
```

Reason:

```txt
Changing capabilities after document upload changes required documents and can make documentSummary inconsistent.
```

Audit action if capabilities are changed before document upload:

```txt
CHANGE_PROVIDER_VERIFICATION_CAPABILITIES
```

---

## 36.4 OCR Scope by Document Type

OCR should not run on every document type.

### OCR Required

OCR should be applied to:

```txt
IDENTITY_CARD_FRONT
IDENTITY_CARD_BACK
```

### OCR Optional

OCR may be applied to:

```txt
BUSINESS_LICENSE
TAX_REGISTRATION
PROFESSIONAL_CERTIFICATE
```

### OCR Not Required

OCR should not be required for:

```txt
SHOP_PHOTO_PROOF
STUDIO_PORTFOLIO_PROOF
```

These documents should be reviewed manually by Admin.

### Submit rule

For Phase 1:

```txt
IDENTITY_CARD_FRONT and IDENTITY_CARD_BACK should not be OCR_FAILED.
SHOP_PHOTO_PROOF and STUDIO_PORTFOLIO_PROOF only need to be uploaded successfully.
```

OCR warnings such as these do not block submit:

```txt
OCR_LOW_CONFIDENCE
MISMATCH_DETECTED
NEEDS_MANUAL_REVIEW
```

They are shown to Admin during review.

---

## 36.5 UNDER_REVIEW Transition Rule

`UNDER_REVIEW` should be used when Admin starts reviewing a submitted verification.

Phase 1 acceptable option:

```txt
When Admin opens the verification detail for the first time, the system may automatically change status from SUBMITTED to UNDER_REVIEW.
```

Alternative acceptable option:

```txt
PATCH /admin/provider-verifications/:id/start-review
```

If using auto transition, the system must:

```txt
Only change SUBMITTED → UNDER_REVIEW once.
Write statusTimeline.
Write audit log START_PROVIDER_VERIFICATION_REVIEW.
```

Required audit action:

```txt
START_PROVIDER_VERIFICATION_REVIEW
```

---

## 36.6 Full State Transition Rules

Allowed transitions:

| From | To | Trigger |
|---|---|---|
| DRAFT | SUBMITTED | Customer submit |
| DRAFT | CANCELLED | Customer cancel |
| SUBMITTED | UNDER_REVIEW | Admin starts review |
| SUBMITTED | APPROVED | Admin approve |
| SUBMITTED | REJECTED | Admin reject |
| SUBMITTED | NEEDS_CHANGES | Admin request changes |
| UNDER_REVIEW | APPROVED | Admin approve |
| UNDER_REVIEW | REJECTED | Admin reject |
| UNDER_REVIEW | NEEDS_CHANGES | Admin request changes |
| NEEDS_CHANGES | SUBMITTED | Customer resubmit |

Forbidden transitions:

```txt
APPROVED → DRAFT
APPROVED → NEEDS_CHANGES
REJECTED → APPROVED directly
SUBMITTED → DRAFT automatically
CANCELLED → SUBMITTED
CANCELLED → APPROVED
```

Important:

```txt
All status changes must be recorded in statusTimeline.
Important status changes must also write audit_logs.
```

---

## 36.7 Document Current Version and Version History

Each document type can have many versions, but only one current version.

### Current version rule

```txt
Only the version with isCurrent = true is used for submit validation and Admin approval validation.
```

Old versions are used only for:

```txt
Audit trail.
Admin comparison.
Investigation.
History display.
```

### Failed or deleted version rule

The following versions must not count as submitted documents:

```txt
UPLOAD_FAILED
DELETED
PENDING_UPLOAD
```

Only this status counts as uploaded successfully:

```txt
UPLOADED
```

### Version history APIs

Customer side:

```txt
GET /provider-verifications/:id/documents/:documentType/versions
GET /provider-verifications/:id/documents/:documentType/versions/:versionNo/view
```

Admin side:

```txt
GET /admin/provider-verifications/:id/documents/:documentType/versions
GET /admin/provider-verifications/:id/documents/:documentType/versions/:versionNo/view
```

The existing endpoint:

```txt
GET /provider-verifications/:id/documents/:documentType/view
```

means:

```txt
View current version only.
```

---

## 36.8 Repeated Request Changes Rule

Admin can request changes more than once.

Each request changes action must:

```txt
Set status = NEEDS_CHANGES.
Save reason.
Append statusTimeline entry.
Create notification for user.
Write audit log.
```

When user uploads a corrected document after request changes:

```txt
Create a new document version.
Keep old versions.
Do not delete old OCR result.
Do not delete old mismatch flags.
```

This allows Admin to compare old and new submissions.

---

## 36.9 Concurrency Rule for Document Upload

Because document versions are stored inside `provider_verifications.documents[]`, backend must prevent inconsistent current versions.

When uploading a new version:

```txt
Only one version per documentType can have isCurrent = true.
```

The implementation should ensure this by:

```txt
Checking currentVersion before update.
Updating old current version to isCurrent = false.
Creating new current version.
Saving the change atomically when possible.
```

If two uploads happen at the same time for the same documentType:

```txt
The system must not leave two current versions.
```

If conflict is detected:

```txt
Return conflict error and ask frontend to reload document list.
```

Suggested error:

```txt
409 Document version conflict
```

---

## 36.10 API Contract Rules

Each API must clearly define:

```txt
Allowed role.
Allowed status.
Required input.
Success result.
Common errors.
Audit action if needed.
```

### Create Provider Verification

Endpoint:

```txt
POST /provider-verifications
```

Allowed role:

```txt
CUSTOMER
```

Allowed when:

```txt
User email is verified.
User does not already have active NEW_PROVIDER verification.
```

Success result:

```txt
verificationId
status = DRAFT
requestedCapabilities
requiredDocuments
```

Common errors:

```txt
401 Unauthorized
403 Forbidden
400 Email not verified
400 Invalid requestedCapabilities
409 Active verification already exists
```

Audit:

```txt
CREATE_PROVIDER_VERIFICATION
```

---

### Upload Document

Endpoint:

```txt
POST /provider-verifications/:id/documents
```

Allowed role:

```txt
CUSTOMER
```

Allowed status:

```txt
DRAFT
NEEDS_CHANGES
```

Required conditions:

```txt
User owns verification.
Consent accepted.
File is valid.
Upload quota not exceeded.
```

Success result:

```txt
documentType
versionNo
uploadStatus
ocrStatus
```

Must not return:

```txt
publicUrl
storageKey
bucket
MinIO endpoint
```

Common errors:

```txt
400 Consent not accepted
400 Invalid file
400 Low image resolution
403 Not owner
409 Invalid verification status
409 Document version conflict
429 Too many uploads
```

Audit:

```txt
UPLOAD_PROVIDER_VERIFICATION_DOCUMENT
DOCUMENT_VERSION_CREATED
```

---

### Run OCR

Endpoint:

```txt
POST /provider-verifications/:id/documents/:documentType/ocr
```

Allowed role:

```txt
CUSTOMER owner
ADMIN
```

Allowed when:

```txt
Document current version exists.
Document uploadStatus = UPLOADED.
Document type is OCR required or OCR optional.
OCR rate limit not exceeded.
```

Success result:

```txt
ocrStatus
ocrConfidence
extractedFields safe version
mismatchFlags
```

Common errors:

```txt
403 Not owner or not admin
404 Document not found
409 Upload not completed
409 OCR not applicable for this document type
429 OCR rate limit exceeded
500 OCR processing failed
```

Audit:

```txt
RUN_PROVIDER_VERIFICATION_OCR
```

---

### Submit Verification

Endpoint:

```txt
POST /provider-verifications/:id/submit
```

Allowed role:

```txt
CUSTOMER
```

Allowed status:

```txt
DRAFT
NEEDS_CHANGES
```

Required:

```txt
Required business fields complete.
Consent accepted.
Required documents uploaded.
No required OCR document has OCR_FAILED.
```

Success result:

```txt
status = SUBMITTED
submittedAt
```

Common errors:

```txt
400 Missing required field
400 Missing required document
400 OCR failed document exists
409 Invalid status
```

Audit:

```txt
SUBMIT_PROVIDER_VERIFICATION
```

---

### Admin Start Review

Endpoint:

```txt
PATCH /admin/provider-verifications/:id/start-review
```

Allowed role:

```txt
ADMIN
```

Allowed status:

```txt
SUBMITTED
```

Success result:

```txt
status = UNDER_REVIEW
```

Common errors:

```txt
403 Not admin
409 Invalid status
```

Audit:

```txt
START_PROVIDER_VERIFICATION_REVIEW
```

---

### Admin Approve

Endpoint:

```txt
PATCH /admin/provider-verifications/:id/approve
```

Allowed role:

```txt
ADMIN
```

Allowed status:

```txt
SUBMITTED
UNDER_REVIEW
```

Required:

```txt
Required documents exist.
Required current document versions are UPLOADED.
No required OCR document has OCR_FAILED.
User does not already have duplicate active provider in Phase 1.
```

Success result:

```txt
verification.status = APPROVED
provider.status = ACTIVE
user.roles includes PROVIDER
```

Common errors:

```txt
403 Not admin
400 Missing required document
400 OCR failed
409 Invalid status
409 Provider already exists
```

Audit:

```txt
APPROVE_PROVIDER_VERIFICATION
CREATE_PROVIDER_FROM_VERIFICATION
```

---

## 36.11 Sensitive Response Policy

APIs must not return sensitive internal data unless required.

Customer-facing APIs must not return:

```txt
storageKey
bucket
MinIO endpoint
MinIO credential
plain ID number
raw OCR text
full bank account number
```

Customer-facing APIs may return:

```txt
documentType
versionNo
uploadStatus
ocrStatus
ocrConfidence
idNumberMasked
mismatchFlags summary
```

Admin APIs may return more review information but still must not return:

```txt
plain ID number
raw file storage credential
MinIO credential
```

No API should return plain ID card number.

---

## 36.12 Provider Verification Detail Response

The verification detail API should return enough data for frontend to render the stepper.

Recommended response groups:

```txt
verificationId
status
verificationType
requestedCapabilities
businessProfile
aodaiInfo
photographyInfo
consent summary
requiredDocuments
submittedDocuments
missingDocuments
documents current version summary
ocr warning summary
review result
statusTimeline
createdAt
updatedAt
```

Do not include raw file content, public file URL, plain ID number, or MinIO credential.

---

## 36.13 Submit Validation Summary

Before submit, backend must validate:

```txt
Status is DRAFT or NEEDS_CHANGES.
Required business fields are complete.
Consent accepted.
All required document types have current version.
All required current versions have uploadStatus = UPLOADED.
Required OCR documents are not OCR_FAILED.
```

Submit is allowed with warnings:

```txt
OCR_LOW_CONFIDENCE
MISMATCH_DETECTED
NEEDS_MANUAL_REVIEW
```

Submit is blocked by:

```txt
Missing required document.
PENDING_UPLOAD document.
UPLOAD_FAILED document.
DELETED document.
OCR_FAILED on required OCR document.
```

---

## 36.14 Admin Approval Validation Summary

Before approval, backend must validate:

```txt
Verification status is SUBMITTED or UNDER_REVIEW.
Required documents are present.
Required current document versions are UPLOADED.
Required OCR documents are not OCR_FAILED.
User does not already have duplicate ACTIVE provider in Phase 1.
```

Admin can still approve with warnings if business policy allows:

```txt
OCR_LOW_CONFIDENCE
MISMATCH_DETECTED
NEEDS_MANUAL_REVIEW
```

Reason:

```txt
OCR is an assistant tool. Admin is the final decision maker.
```

---

## 36.15 Provider Activation Rules

When Admin approves verification:

```txt
Create provider only if user does not already have an ACTIVE provider in Phase 1.
Copy business profile snapshot from provider_verifications to providers.
Set providers.capabilities = requestedCapabilities.
Set providers.status = ACTIVE.
Add PROVIDER role to user if missing.
Set users.providerId if the users schema supports it.
```

Do not:

```txt
Create duplicate provider for same user in Phase 1.
Set PROVIDER role before approval.
Set provider ACTIVE before approval.
Use requestedCapabilities as approved capabilities before Admin approves.
```

---

## 36.16 Error Handling Checklist

The implementation must handle these cases:

```txt
Guest creates verification.
Unverified email creates verification.
Customer creates duplicate active verification.
User submits invalid requestedCapabilities.
User changes requestedCapabilities after document upload.
User uploads without consent.
User uploads after SUBMITTED.
User uploads after APPROVED.
User uploads invalid file.
User uploads two files concurrently for same documentType.
MinIO upload fails.
MongoDB update fails after MinIO upload.
OCR fails.
OCR run on non-OCR document type.
Other user views document.
Admin approves missing document.
Admin approves OCR_FAILED required document.
Admin approves already APPROVED verification.
Provider already exists during approval.
```

Each case must return a clear error and should not leave the system in an inconsistent state.

---

## 36.17 Environment and Seed Checklist

### Environment variables

Prepare:

```txt
MINIO_ENDPOINT
MINIO_PORT
MINIO_USE_SSL
MINIO_ACCESS_KEY
MINIO_SECRET_KEY
MINIO_PROVIDER_DOCUMENT_BUCKET
```

### MinIO buckets

Prepare:

```txt
provider-documents
ocr-temp-files
```

`provider-documents` must be private.

### Seed roles

Prepare:

```txt
CUSTOMER
ADMIN
PROVIDER
```

### Seed permissions if used

```txt
provider_verification:create_own
provider_verification:update_own
provider_verification:submit_own
provider_verification:review_all
provider_verification:approve_all
provider_verification:reject_all
audit:view_all
```

### Test accounts

Prepare:

```txt
Customer account with verified email.
Admin account.
```

---

## 36.18 Module Boundary

### ProviderVerificationService

Responsible for:

```txt
Create verification.
Update profile.
Accept consent.
Submit verification.
Manage verification status.
```

### ProviderVerificationDocumentService

Responsible for:

```txt
Validate document upload rules.
Manage document versions.
Call PrivateStorageService.
Update document metadata.
```

### PrivateStorageService

Responsible for:

```txt
Upload file.
Read file stream.
Delete file.
Check file exists.
Hide MinIO details.
```

### MinioPrivateStorageService

Responsible for:

```txt
Implement PrivateStorageService using MinIO.
Manage bucket operations.
Upload/read/delete objects.
No business rules.
```

### ProviderVerificationOcrService

Responsible for:

```txt
Read document via PrivateStorageService.
Run OCR.
Mask/hash sensitive fields.
Save OCR result.
Generate mismatch flags.
```

### ProviderVerificationReviewService

Responsible for:

```txt
Admin start review.
Admin approve.
Admin reject.
Admin request changes.
Update review block.
Update statusTimeline.
```

### ProviderActivationService

Responsible for:

```txt
Create providers record after approval.
Add PROVIDER role to user.
Link providerId to user if needed.
Prevent duplicate active provider in Phase 1.
```

### AuditService

Responsible for:

```txt
Write audit logs.
Avoid logging sensitive raw data.
```

### NotificationService

Responsible for:

```txt
Notify user when submitted, approved, rejected, or requested changes.
```

---

## 36.19 Extra Audit Actions

Add these audit actions:

```txt
START_PROVIDER_VERIFICATION_REVIEW
CHANGE_PROVIDER_VERIFICATION_CAPABILITIES
VIEW_PROVIDER_VERIFICATION_VERSION_HISTORY
```

Use `CHANGE_PROVIDER_VERIFICATION_CAPABILITIES` only if requestedCapabilities is changed before document upload.

Use `VIEW_PROVIDER_VERIFICATION_VERSION_HISTORY` when Admin opens document version history.

---

## 36.20 Final Implementation Order Update

Updated implementation order:

```txt
1. Confirm roles: CUSTOMER, ADMIN, PROVIDER.
2. Confirm provider capabilities.
3. Create provider_verifications schema.
4. Confirm providers schema supports capabilities.
5. Setup StorageModule.
6. Setup PrivateStorageService abstraction.
7. Implement MinioPrivateStorageService.
8. Setup MinIO private bucket.
9. Implement create provider verification.
10. Implement get/update own verification.
11. Implement requestedCapabilities validation.
12. Implement consent API.
13. Implement upload document.
14. Implement file validation.
15. Store document metadata in provider_verifications.documents[].
16. Implement document versioning.
17. Implement version history APIs.
18. Implement view document through backend.
19. Implement manual OCR flow.
20. Implement submit verification.
21. Implement admin list/detail.
22. Implement admin start-review.
23. Implement admin approve/reject/request changes.
24. Implement provider activation on approval.
25. Add PROVIDER role to user after approval.
26. Create notifications.
27. Write audit logs.
28. Add rate limits.
29. Add cleanup job for PENDING_UPLOAD.
30. Prepare frontend stepper.
31. Prepare demo test cases.
```

---

## 36.21 Final Acceptance Criteria Update

The module is complete when all below are true:

```txt
Customer can create NEW_PROVIDER verification.
Guest cannot create verification.
Unverified email cannot create verification.
Customer cannot create duplicate active verification.
Invalid requestedCapabilities are rejected.
Owner can update in DRAFT and NEEDS_CHANGES only.
requestedCapabilities cannot change after document upload.
Owner must accept consent before upload.
Valid document uploads to MinIO through PrivateStorageService.
No public URL is returned.
Fake MIME file is rejected.
Oversized file is rejected.
Low resolution image is rejected.
Re-upload creates new version.
Old version remains.
Only one version is current.
Concurrent upload does not create two current versions.
OCR reads current document from MinIO via PrivateStorageService.
OCR only runs for OCR required/optional document types.
OCR result is saved to current version.
ID number is masked/hashed.
OCR does not approve verification.
Cannot submit without consent.
Cannot submit without required documents.
Cannot submit if required OCR document is OCR_FAILED.
Submit changes status to SUBMITTED.
Admin can start review.
Admin can approve/reject/request changes.
Admin can view current documents.
Admin can view version history.
Admin can view old document version.
Approval creates provider.
Provider status = ACTIVE.
Provider capabilities = requestedCapabilities.
User gets PROVIDER role.
Notification is created.
Audit log is written.
Guest viewing document gets 401.
Other customer viewing document gets 403.
Owner can view own document.
Admin can view document for review.
MinIO URL is not exposed.
StorageKey is not exposed to frontend.
Plain ID number is not returned.
```

---

## 36.22 Final Phase 1 Boundary

Phase 1 must not implement:

```txt
ADD_CAPABILITY full flow
UPDATE_DOCUMENTS full flow
REACTIVATION_REQUEST full flow
Auto OCR queue
Malware scan
Data deletion UI
Provider document collection split
Advanced security alert dashboard
```

However, the schema may reserve fields for these future flows.

---

# Final Complete Architecture Summary

Final architecture after this addendum:

```txt
Roles:
CUSTOMER, ADMIN, PROVIDER

Provider type:
providers.capabilities

Registration / verification hồ sơ:
provider_verifications

Active provider profile:
providers

Verification documents:
provider_verifications.documents[].versions[]

Actual file storage:
MinIO private bucket

Storage abstraction:
PrivateStorageService

MinIO implementation:
MinioPrivateStorageService

OCR result:
Stored in current document version

Audit:
audit_logs

Notification:
notifications
```

This complete specification fits the current 29-collection architecture, avoids unnecessary new collections, keeps roles clean, supports Provider-AoDai / Provider-Photographer / Provider-Both through capabilities, and is strict enough for developer or AI coding assistant to implement without confusion.
