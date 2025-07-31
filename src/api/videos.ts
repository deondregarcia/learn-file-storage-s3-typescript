import { respondWithJSON } from "./json";

import { type ApiConfig } from "../config";
import type { BunRequest, S3File, BunFile } from "bun";
import { BadRequestError, UserForbiddenError } from "./errors";
import { getBearerToken, validateJWT } from "../auth";
import { getVideo, updateVideo, type Video } from "../db/videos";
import { createTempPath, mediaTypeToExt } from "./assets";
import crypto from "crypto";
import { myUploadToS3 } from "../s3";
import { rm } from "fs/promises";
import path from "path";
import fs from "fs";
import { cfg } from "../config";

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
  // const video = getVideo(cfg.db, videoId);
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

  const tempPath = createTempPath(videoId);

  await Bun.write(tempPath, video);
  const aspectRatio = await getVideoAspectRatio(tempPath);
  const key = `${aspectRatio}/${videoId}.mp4`;

  const outputPath = await processVideoForFastStart(tempPath);

  await myUploadToS3(cfg, outputPath, key);

  videoMetaData.videoURL = `${cfg.s3CfDistribution}/${key}`;
  updateVideo(cfg.db, videoMetaData);

  await Promise.all([
    rm(tempPath, { force: true }),
    rm(`${tempPath}.processed.mp4`, { force: true }),
  ]);

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

export const processVideoForFastStart = async (tempPath: string) => {
  const outputPath = `${tempPath}.processed.mp4`;
  const proc = Bun.spawn(
    [
      "ffmpeg",
      "-i",
      tempPath,
      "-movflags",
      "faststart",
      "-map_metadata",
      "0",
      "-codec",
      "copy",
      "-f",
      "mp4",
      outputPath,
    ],
    {
      stderr: "pipe",
    }
  );

  const exitCode = await proc.exited;
  const errorMessage = await proc.stderr.text();
  if (exitCode !== 0) {
    throw new Error(`Could not process video: ${errorMessage}`);
  }

  return outputPath;
};
