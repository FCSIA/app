---
tags: [feature, uploads, storage]
---

# Uploads

[Home](../index.md)

Uploads let users attach files to supported features through Convex storage.

## What It Does

- Generates a Convex upload URL.
- Uploads the browser `File` directly to Convex storage.
- Finalizes the upload by storing metadata or a domain reference.

## Source Files

- Backend: `apps/convex/src/uploads/files.ts`
- Web helper: `apps/web/src/lib/convex-upload.ts`
- Club image UI: `apps/web/src/components/clubs/club-hero.tsx`
- Channel attachment UI: `apps/web/src/app/clubs/[clubId]/channels/[channelId]/page.tsx`

## Convex Surface

- `api.uploads.files.generateUploadUrl`
- `api.uploads.files.finalizeChatAttachment`
- `api.uploads.files.finalizeClubImage`

## Current Consumers

- Club profile/hero images.
- Club channel message attachments.

## Club chat image review

Images and GIFs attached to club messages enter the Reports review queue. Staff
can open the original animation and approve or reject it. Approval makes the
attachment visible in the message. Rejection deletes the upload, and unreviewed
uploads expire after seven days. Message text and other supported file types
can appear immediately. Review previews require staff access.

## Permissions

The finalize mutation enforces the domain permission. Generating an upload URL
is not enough to make a file visible in the app.

## Related

- [Storage and uploads](../backend/storage-and-uploads.md)
- [Clubs](clubs.md)
