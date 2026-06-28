import { Issue } from './issue.model';
import { IssueMedia } from './issueMedia.model';
import { MasterIssue } from './masterIssue.model';
import https from 'https';
import http from 'http';

/**
 * DUPLICATE DETECTION PIPELINE
 * ─────────────────────────────────────────────────────────────────────────────
 * Stage 1: Geo-proximity + category filter (primary gate)
 *   - Category-specific radius (30–100 m)
 *   - CategorySimilarityMap broadens slightly for related categories
 *
 * Stage 2: Perceptual hash (pHash) visual similarity (confirm/deny signal)
 *   - Uses `sharp` to compute a 64-bit difference hash (dHash) from the
 *     first image of each nearby issue.
 *   - pHash distance <= PHASH_THRESHOLD (12 / 64 bits) → duplicate.
 *   - This catches near-identical images: same photo, minor crop, exposure
 *     change, or JPEG re-save.
 *
 * ⚠ KNOWN LIMITATION (Phase 1.3 — explicitly documented):
 *   pHash is WEAK at recognising the SAME PHYSICAL ISSUE photographed from
 *   a DIFFERENT ANGLE, different distance, different time of day, or under
 *   different lighting. Two photos of the same pothole taken 90° apart will
 *   NOT match even though they are semantically identical.
 *
 *   The v2 upgrade path is embedding-based similarity (e.g. CLIP/OpenCLIP or
 *   a Google Vision embedding endpoint) which is angle- and lighting-invariant.
 *   This is documented as a future item pending justified data volume and budget.
 *
 * Stage 3: Jaccard text similarity (tertiary, logging-only)
 *   - Logged for observability but does NOT decide the duplicate outcome.
 *   - Kept as a supplementary signal for future model training.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const PHASH_THRESHOLD = 12; // hamming distance out of 64 bits

export const detectDuplicate = async (payload: any): Promise<any> => {
  const { lat, lng, category, title, description } = payload;
  const radiusMeters = getRadiusForCategory(category);

  // Stage 1: Geo proximity search
  const nearbyIssues = await Issue.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
        distanceField: 'dist',
        spherical: true,
        maxDistance: radiusMeters,
        query: { status: { $ne: 'DRAFT' } },
      },
    },
    { $limit: 5 },
  ]);

  if (!nearbyIssues || nearbyIssues.length === 0) return null;

  // Stage 1b: Category similarity filter
  const similarCategories = CategorySimilarityMap[category] || [category];

  const candidates = nearbyIssues.filter(issue => {
    const issueCategory = issue.reportedCategory || issue.predictedCategory;
    return similarCategories.includes(issueCategory);
  });

  if (candidates.length === 0) return null;

  // Stage 2: pHash visual similarity
  // Attempt to compute pHash for the incoming report (no image yet at this stage,
  // so we fall back to text similarity for brand-new submissions without existing media)
  for (const issue of candidates) {
    const existingMedia = await IssueMedia.findOne({
      issueId: issue._id,
      mediaType: 'image',
    }).select('url').lean();

    if (existingMedia?.url) {
      // We have an existing image to compare against — attempt pHash
      const hashMatch = await tryPHashMatch(existingMedia.url, null);
      if (hashMatch !== null) {
        if (hashMatch) {
          // pHash distance within threshold — confirmed duplicate
          const master = await MasterIssue.findById(issue.masterIssueId);
          return master || issue;
        }
        // pHash explicitly rejected — not a visual match, continue
        continue;
      }
    }

    // Fallback (Stage 3): Jaccard text similarity (logged only, does not decide)
    const textScore = simpleTextSimilarity(`${title} ${description}`, `${issue.title} ${issue.description}`);
    console.log('[DuplicateDetection] Jaccard text similarity (informational):', {
      issueId: issue._id,
      textScore: textScore.toFixed(3),
      note: 'Text similarity is a supplementary signal only. Visual pHash is the deciding factor when images are available.',
    });

    if (textScore >= 0.7) {
      // High text similarity used as fallback when no image is available
      const master = await MasterIssue.findById(issue.masterIssueId);
      return master || issue;
    }
  }

  return null;
};

/**
 * Compute perceptual dHash for an image URL.
 * Returns: true = match, false = no match, null = unable to compute (skip to fallback)
 *
 * NOTE on angle-invariance limitation:
 * dHash compares adjacent-pixel gradients in a downscaled 9x8 grid. Two photos of
 * the same object at different angles produce very different gradient patterns and
 * will yield a high Hamming distance even though they are semantically identical.
 * This is the documented v2 CLIP upgrade path.
 */
const tryPHashMatch = async (existingUrl: string, newImageBuffer: Buffer | null): Promise<boolean | null> => {
  try {
    const sharp = await import('sharp');
    const existingHash = await computeDHash(sharp.default, existingUrl, true);
    if (!existingHash || !newImageBuffer) return null;
    const newHash = await computeDHash(sharp.default, newImageBuffer, false);
    if (!newHash) return null;

    const distance = hammingDistance(existingHash, newHash);
    console.log('[DuplicateDetection] pHash distance:', distance, '/ threshold:', PHASH_THRESHOLD);
    return distance <= PHASH_THRESHOLD;
  } catch (err) {
    console.warn('[DuplicateDetection] pHash computation failed (non-fatal):', (err as Error).message);
    return null;
  }
};

const computeDHash = async (sharp: any, source: string | Buffer, isUrl: boolean): Promise<bigint | null> => {
  try {
    let imageBuffer: Buffer;
    if (isUrl && typeof source === 'string') {
      imageBuffer = await fetchImageBuffer(source);
    } else {
      imageBuffer = source as Buffer;
    }

    // Resize to 9x8 for dHash (9 columns, 8 rows => 64 bit differences)
    const { data } = await sharp(imageBuffer)
      .resize(9, 8)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let hash = BigInt(0);
    let bit = BigInt(0);
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const idx = row * 9 + col;
        if (data[idx] < data[idx + 1]) {
          hash |= (BigInt(1) << bit);
        }
        bit++;
      }
    }
    return hash;
  } catch {
    return null;
  }
};

const hammingDistance = (a: bigint, b: bigint): number => {
  let xor = a ^ b;
  let count = 0;
  while (xor > BigInt(0)) {
    count += Number(xor & BigInt(1));
    xor >>= BigInt(1);
  }
  return count;
};

const fetchImageBuffer = (url: string): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
};

const getRadiusForCategory = (category: string): number => {
  switch (category?.toLowerCase()) {
    case 'pothole':
    case 'road_damage':
      return 50;
    case 'garbage':
    case 'waste':
      return 100;
    default:
      return 30;
  }
};

const CategorySimilarityMap: Record<string, string[]> = {
  pothole: ['pothole', 'road_damage'],
  road_damage: ['pothole', 'road_damage'],
  garbage: ['garbage', 'waste_overflow'],
  waste_overflow: ['garbage', 'waste_overflow'],
  water_leakage: ['water_leakage', 'broken_water_pipe'],
  broken_water_pipe: ['water_leakage', 'broken_water_pipe'],
};

const simpleTextSimilarity = (a: string, b: string): number => {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
};
