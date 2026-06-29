import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cook certificates live in a private Cloudflare R2 bucket. The DB column
// `cook_certifications.file_url` stores the R2 object KEY (e.g.
// `certs/<cookId>/<ts>-<name>`), not a public URL, so it can only be viewed
// through a short-lived signed URL. Bucket name and signing match the main
// 7eats app's lib/storage (CERTS bucket, 900s TTL clamped to 1h).
const CERTS_BUCKET = "homecook-certs-private";

let _client: S3Client | undefined;

function getR2Client(): S3Client {
  if (_client) return _client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 credentials are not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)",
    );
  }

  _client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _client;
}

export async function getSignedCertUrl(
  key: string,
  expiresIn = 900,
): Promise<string> {
  const clampedExpiry = Math.min(expiresIn, 3600);
  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({ Bucket: CERTS_BUCKET, Key: key }),
    { expiresIn: clampedExpiry },
  );
}
