import type { S3File } from "bun";
import { getAssetDiskPath } from "./api/assets";
import type { ApiConfig } from "./config";
import { getVideoAspectRatio } from "./api/videos";

export const myUploadToS3 = async (
  cfg: ApiConfig,
  videoKey: string,
  video: File
) => {
  const tempAssetDiskPath = getAssetDiskPath(cfg, videoKey);
  await Bun.write(tempAssetDiskPath, video);
  const bunFile = Bun.file(tempAssetDiskPath);

  const aspectRatio = await getVideoAspectRatio(tempAssetDiskPath);
  const finalKey = `${aspectRatio}/${videoKey}`;
  const s3file: S3File = cfg.s3Client.file(finalKey, { bucket: cfg.s3Bucket });
  const startTime = process.hrtime.bigint();
  await s3file.write(bunFile, { type: bunFile.type });
  const endTime = process.hrtime.bigint();
  await bunFile.delete();

  console.log(`Upload took ${Number(endTime - startTime) / 1000} milliseconds`);

  return finalKey;
};
