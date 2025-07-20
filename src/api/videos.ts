import { respondWithJSON } from "./json";

import { type ApiConfig } from "../config";
import type { BunRequest, S3File } from "bun";
import { BadRequestError, UserForbiddenError } from "./errors";
import { getBearerToken, validateJWT } from "../auth";
import { getVideo, updateVideo } from "../db/videos";
import { getAssetDiskPath, mediaTypeToExt } from "./assets";
import crypto from "crypto";
import { myUploadToS3 } from "../s3";
import path from "path";
import fs from "fs";

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);
  const videoMetaData = getVideo(cfg.db, videoId);
  if (userID !== videoMetaData?.userID) {
    throw new UserForbiddenError("Invalid user");
  }

  const formData = await req.formData();
  const video = formData.get("video");
  const MAX_UPLOAD_SIZE = 1 << 30;
  if (!(video instanceof File)) {
    throw new BadRequestError("Video not found");
  }
  if (video.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("Video size greater than 1 GB");
  }
  if (video.type !== "video/mp4") {
    throw new BadRequestError("Video must be of type mp4");
  }

  const randomString = crypto.randomBytes(32).toString("base64url");
  const ext = mediaTypeToExt(video.type);
  const videoKey = `${randomString}${ext}`;

  const finalKey = await myUploadToS3(cfg, videoKey, video);

  videoMetaData.videoURL = `https://${cfg.s3Bucket}.s3.${cfg.s3Region}.amazonaws.com/${finalKey}`;
  updateVideo(cfg.db, videoMetaData);

  return respondWithJSON(200, null);
}

export const getVideoAspectRatio = async (filePath: string) => {
  const proc = Bun.spawn(
    [
      "ffprobe",
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "json",
      filePath,
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  const exitCode = await proc.exited;
  const errorText = await proc.stderr.text();
  if (exitCode !== 0) {
    throw new Error(`ffprobe error: ${errorText}`);
  }

  const output = await proc.stdout.json();
  if (!output.streams || output.streams.length === 0) {
    throw new Error("No video streams found");
  }

  const { width, height } = output.streams[0];

  return determineAspectRatio(width, height);
};

const determineAspectRatio = (width: number, height: number) => {
  const calculatedRatio = width / height;
  const landscapeRatio = 16 / 9;
  const portraitRatio = 9 / 16;
  const toleranceRange = 0.01;

  if (Math.abs(calculatedRatio - landscapeRatio) < toleranceRange) {
    return "landscape";
  }

  if (Math.abs(calculatedRatio - portraitRatio) < toleranceRange) {
    return "portrait";
  }

  return "other";
};
