import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";

/**
 * S3-compatible storage service (AWS S3 or Minio).
 * When S3_ENABLED is false, all methods no-op and return null.
 */
@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client | null = null;
  private readonly bucket: string;
  private readonly enabled: boolean;
  private readonly publicBaseUrl: string | null;

  constructor(private configService: ConfigService) {
    this.enabled =
      this.configService.get<string>("S3_ENABLED") === "true" ||
      this.configService.get<string>("S3_ENABLED") === "1";

    this.bucket = this.configService.get<string>("S3_BUCKET") || "hubnity-screenshots";
    this.publicBaseUrl = this.configService.get<string>("S3_PUBLIC_BASE_URL") || null;

    if (this.enabled) {
      const region = this.configService.get<string>("S3_REGION") || "us-east-1";
      const endpoint = this.configService.get<string>("S3_ENDPOINT");
      const accessKeyId = this.configService.get<string>("S3_ACCESS_KEY_ID");
      const secretAccessKey = this.configService.get<string>("S3_SECRET_ACCESS_KEY");

      if (!accessKeyId || !secretAccessKey) {
        this.logger.warn(
          "S3 enabled but S3_ACCESS_KEY_ID or S3_SECRET_ACCESS_KEY not set. S3 uploads will fail.",
        );
      }

      this.client = new S3Client({
        region,
        ...(endpoint && {
          endpoint,
          forcePathStyle: true, // Required for Minio
        }),
        credentials:
          accessKeyId && secretAccessKey
            ? {
                accessKeyId,
                secretAccessKey,
              }
            : undefined,
      });

      this.logger.log(
        `S3 initialized: bucket=${this.bucket}, region=${region}${endpoint ? `, endpoint=${endpoint}` : ""}`,
      );
    } else {
      this.logger.debug("S3 disabled, using local storage");
    }
  }

  isEnabled(): boolean {
    return this.enabled && this.client !== null;
  }

  async onModuleInit(): Promise<void> {
    if (!this.client || !this.enabled) return;
    await this.ensureBucketExists();
  }

  /**
   * Create bucket if it doesn't exist (Minio doesn't auto-create buckets).
   */
  private async ensureBucketExists(): Promise<void> {
    try {
      await this.client!.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.debug(`S3 bucket ${this.bucket} exists`);
    } catch {
      try {
        await this.client!.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`S3 bucket ${this.bucket} created`);
      } catch (createErr) {
        const msg = createErr instanceof Error ? createErr.message : String(createErr);
        if (msg.includes("BucketAlreadyOwnedByYou") || msg.includes("BucketAlreadyExists")) {
          this.logger.debug(`S3 bucket ${this.bucket} already exists`);
        } else {
          this.logger.error({ bucket: this.bucket, error: createErr }, "Failed to create S3 bucket");
        }
      }
    }
  }

  /**
   * Upload a buffer to S3. Returns the public URL or null if S3 disabled.
   */
  async uploadBuffer(
    key: string,
    buffer: Buffer,
    contentType: string = "image/jpeg",
  ): Promise<string | null> {
    if (!this.client || !this.enabled) {
      return null;
    }

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );

      if (this.publicBaseUrl) {
        const base = this.publicBaseUrl.replace(/\/$/, "");
        return `${base}/${key}`;
      }

      const region = this.configService.get<string>("S3_REGION") || "us-east-1";
      const endpoint = this.configService.get<string>("S3_ENDPOINT");
      if (endpoint) {
        return `${endpoint}/${this.bucket}/${key}`;
      }
      return `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error({ key, error: msg }, "S3 upload failed");
      throw error;
    }
  }

  /**
   * Delete an object from S3. No-op if S3 disabled.
   */
  async deleteObject(key: string): Promise<void> {
    if (!this.client || !this.enabled) {
      return;
    }

    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn({ key, error: msg }, "S3 delete failed");
    }
  }

  /**
   * Extract S3 key from URL for deletion.
   * Handles: s3.amazonaws.com/bucket/key, bucket.s3.region.amazonaws.com/key, custom endpoint/bucket/key
   */
  extractKeyFromUrl(url: string): string | null {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      try {
        const u = new URL(url);
        const pathParts = u.pathname.replace(/^\/+/, "").split("/");
        const bucketIdx = pathParts.indexOf(this.bucket);
        if (bucketIdx >= 0 && bucketIdx < pathParts.length - 1) {
          return pathParts.slice(bucketIdx + 1).join("/");
        }
        if (pathParts[0] === "screenshots" || pathParts[0] === "thumbnails") {
          return pathParts.join("/");
        }
        if (pathParts.length >= 1) {
          return pathParts.join("/");
        }
      } catch {
        return null;
      }
    }
    if (url.startsWith("screenshots/") || url.startsWith("thumbnails/")) {
      return url;
    }
    return null;
  }
}
