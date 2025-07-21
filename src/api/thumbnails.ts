import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import path from "path";
import { createTempPath, isUnsupportedType, mediaTypeToExt } from "./assets";
import crypto from "crypto";

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  const formData = await req.formData();
  const file = formData.get("thumbnail");
  if (!(file instanceof File)) {
    throw new BadRequestError("Image not found");
  }

  // if file.type is neither of them
  // if (!(file.type === "image/png" || file.type === "image/jpeg"))
  if (isUnsupportedType(file.type))
    throw new BadRequestError("Unsupported file type");

  const MAX_UPLOAD_SIZE = 10 << 20;
  if (file.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("File size greater than 10MB");
  }

  const imgArrayBuffer = await file.arrayBuffer();
  const videoMetaData = getVideo(cfg.db, videoId);
  if (userID !== videoMetaData?.userID) {
    throw new UserForbiddenError("Incorrect user");
  }

  const fileExtension = mediaTypeToExt(file.type);
  const randomString = crypto.randomBytes(32).toString("base64url");
  const filename = `${randomString}${fileExtension}`;

  const assetDiskPath = createTempPath(cfg, filename);
  Bun.write(assetDiskPath, imgArrayBuffer);
  videoMetaData.thumbnailURL = `http://localhost:${cfg.port}/assets/${filename}`;

  updateVideo(cfg.db, videoMetaData);

  return respondWithJSON(200, videoMetaData);
}
