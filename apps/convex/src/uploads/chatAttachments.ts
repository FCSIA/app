import { STAFF_ROLES } from "../../../shared/roles";
import { internal } from "../_generated/api";
import { getCurrentAppUser, requireAnyRole, viewerWithRoles } from "../../lib/currentUser";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { deleteStorageQuietly } from "../../lib/storage";
import { httpAction, internalMutation, internalQuery, mutation, query, type MutationCtx } from "../_generated/server";
import {
  isSupportedStoredFileMime,
  normalizeStoredFileMime,
} from "./fileSignatures";
import {
  MAX_CHANNEL_MESSAGE_ATTACHMENTS,
  MAX_CHAT_ATTACHMENT_BYTES,
  MAX_CHAT_ATTACHMENT_FILE_NAME_CHARACTERS,
} from "../../../shared/chat/attachments";

export const STAGED_CHAT_ATTACHMENT_TTL_MS = 60 * 60 * 1000;

const CHAT_IMAGE_REVIEW_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type StorageMetadataInput = {
  contentType?: string;
  size: number;
};

function characterCount(value: string) {
  return Array.from(value).length;
}

export function normalizeChatAttachmentFileName(fileName: string) {
  const normalized = fileName.trim().split(/[\\/]/).at(-1)?.trim() ?? "";
  if (!normalized || /[\u0000-\u001F\u007F]/.test(normalized)) {
    throw new ConvexError("File name is invalid");
  }
  if (characterCount(normalized) > MAX_CHAT_ATTACHMENT_FILE_NAME_CHARACTERS) {
    throw new ConvexError("File name is too long");
  }
  return normalized;
}

export function validateChatAttachmentMetadata(metadata: StorageMetadataInput) {
  const mimeType = normalizeStoredFileMime(
    metadata.contentType ?? "application/octet-stream",
  );
  if (!Number.isFinite(metadata.size) || metadata.size < 0) {
    throw new ConvexError("File size is invalid");
  }
  if (metadata.size > MAX_CHAT_ATTACHMENT_BYTES) {
    throw new ConvexError("File too large");
  }
  if (!isSupportedStoredFileMime(mimeType)) {
    throw new ConvexError("This file type is not supported");
  }
  return { mimeType, size: metadata.size };
}

export function assertStagedChatAttachmentIds(
  attachmentUploadIds: Id<"clubChannelAttachmentUploads">[],
) {
  if (attachmentUploadIds.length > MAX_CHANNEL_MESSAGE_ATTACHMENTS) {
    throw new ConvexError(`A message can include at most ${MAX_CHANNEL_MESSAGE_ATTACHMENTS} attachments`);
  }
  if (new Set(attachmentUploadIds).size !== attachmentUploadIds.length) {
    throw new ConvexError("An attachment can only be added once");
  }
}

export function assertStagedChatAttachmentOwner(
  attachment: Pick<Doc<"clubChannelAttachmentUploads">, "uploaderId">,
  uploaderId: Id<"users">,
) {
  if (attachment.uploaderId !== uploaderId) {
    throw new ConvexError("Attachment not found");
  }
}

export async function deleteStoredChatAttachment(
  ctx: MutationCtx,
  attachment: Pick<Doc<"clubChannelMessageAttachments">, "storageId">,
) {
  await deleteStorageQuietly(ctx, attachment.storageId);
}

export async function consumeStagedChatAttachments(
  ctx: MutationCtx,
  input: {
    attachmentUploadIds: Id<"clubChannelAttachmentUploads">[];
    uploaderId: Id<"users">;
    messageId: Id<"clubChannelMessages">;
  },
) {
  assertStagedChatAttachmentIds(input.attachmentUploadIds);

  for (const attachmentUploadId of input.attachmentUploadIds) {
    const staged = await ctx.db.get(attachmentUploadId);
    if (!staged) throw new ConvexError("Attachment not found");
    assertStagedChatAttachmentOwner(staged, input.uploaderId);

    const metadata = await ctx.db.system.get("_storage", staged.storageId);
    if (!metadata) throw new ConvexError("Attachment upload not found");
    const authoritative = validateChatAttachmentMetadata(metadata);
    if (
      authoritative.mimeType !== staged.mimeType ||
      authoritative.size !== staged.size
    ) {
      throw new ConvexError("Attachment metadata changed");
    }
    if (staged.pendingMessageId) {
      throw new ConvexError("Attachment is already awaiting review");
    }
    if (authoritative.mimeType.startsWith("image/")) {
      await ctx.db.patch(staged._id, {
        pendingMessageId: input.messageId,
        reviewSubmittedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(
        CHAT_IMAGE_REVIEW_TTL_MS,
        internal.uploads.chatAttachments.expirePendingImage,
        { attachmentUploadId },
      );
    } else {
      await publishAttachment(ctx, staged, input.messageId);
    }
  }
}

async function publishAttachment(
  ctx: MutationCtx,
  staged: Doc<"clubChannelAttachmentUploads">,
  messageId: Id<"clubChannelMessages">,
) {
  const fileUrl = await ctx.storage.getUrl(staged.storageId);
  if (!fileUrl) throw new ConvexError("Attachment upload not found");
  await ctx.db.insert("clubChannelMessageAttachments", {
    messageId,
    storageId: staged.storageId,
    uploaderId: staged.uploaderId,
    fileName: staged.fileName,
    fileUrl,
    mimeType: staged.mimeType,
    size: staged.size,
    createdAt: Date.now(),
  });
  await ctx.db.delete(staged._id);
}

async function removeStaged(ctx: MutationCtx, staged: Doc<"clubChannelAttachmentUploads">) {
  await deleteStorageQuietly(ctx, staged.storageId);
  await ctx.db.delete(staged._id);
}

export const cleanupStagedChatAttachment = internalMutation({
  args: { attachmentUploadId: v.id("clubChannelAttachmentUploads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const staged = await ctx.db.get(args.attachmentUploadId);
    if (staged && !staged.pendingMessageId) await removeStaged(ctx, staged);
    return null;
  },
});

export const expirePendingImage = internalMutation({
  args: { attachmentUploadId: v.id("clubChannelAttachmentUploads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const staged = await ctx.db.get(args.attachmentUploadId);
    if (staged?.pendingMessageId) await removeStaged(ctx, staged);
    return null;
  },
});

export const listPendingImages = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("clubChannelAttachmentUploads"),
    fileName: v.string(),
  })),
  handler: async (ctx) => {
    if (!(await viewerWithRoles(ctx, STAFF_ROLES))) return [];
    const rows = await ctx.db.query("clubChannelAttachmentUploads")
      .withIndex("by_reviewSubmittedAt", (q) => q.gt("reviewSubmittedAt", undefined))
      .take(20);
    return rows.map(({ _id, fileName }) => ({ _id, fileName }));
  },
});

export const decideImage = mutation({
  args: { attachmentUploadId: v.id("clubChannelAttachmentUploads"), approve: v.boolean() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const reviewer = await getCurrentAppUser(ctx);
    requireAnyRole(reviewer, STAFF_ROLES);
    const staged = await ctx.db.get(args.attachmentUploadId);
    if (!staged?.pendingMessageId) return false;
    const message = await ctx.db.get(staged.pendingMessageId);
    if (args.approve && message && !message.deletedAt) {
      await publishAttachment(ctx, staged, message._id);
      return true;
    }
    await removeStaged(ctx, staged);
    return !args.approve;
  },
});

export const getPendingImageStorage = internalQuery({
  args: { attachmentUploadId: v.id("clubChannelAttachmentUploads") },
  returns: v.union(v.null(), v.object({
    storageId: v.id("_storage"),
    mimeType: v.string(),
  })),
  handler: async (ctx, args) => {
    if (!(await viewerWithRoles(ctx, STAFF_ROLES))) return null;
    const row = await ctx.db.get(args.attachmentUploadId);
    return row?.pendingMessageId ? { storageId: row.storageId, mimeType: row.mimeType } : null;
  },
});

export const previewPendingImage = httpAction(async (ctx, request) => {
  if (!(await ctx.auth.getUserIdentity())) return new Response(null, { status: 401 });
  const id = new URL(request.url).searchParams.get("attachmentUploadId");
  if (!id) return new Response(null, { status: 404 });
  try {
    const image = await ctx.runQuery(internal.uploads.chatAttachments.getPendingImageStorage, {
      attachmentUploadId: id as Id<"clubChannelAttachmentUploads">,
    });
    const blob = image && await ctx.storage.get(image.storageId);
    if (!blob || !image) return new Response(null, { status: 404 });
    return new Response(blob, {
      headers: {
        "Content-Type": image.mimeType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
});
