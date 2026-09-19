import {
  COMPRESSION_STEPS,
  fitWithin,
  photoMaxBytes,
} from '@corechain/domain';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// E5-1: photo files live in the app's own documents folder (not the shared
// gallery), so they stay with the project's data and are backed up with it.

const PHOTO_DIRECTORY = 'photos';

export function photosDirectory(): Directory {
  const directory = new Directory(Paths.document, PHOTO_DIRECTORY);
  if (!directory.exists) {
    directory.create({ idempotent: true });
  }
  return directory;
}

export function photoFile(fileName: string): File {
  return new File(photosDirectory(), fileName);
}

export type CompressedPhoto = {
  /** A temporary file in the cache; move it into place with `keepPhoto`. */
  file: File;
  widthPx: number;
  heightPx: number;
  sizeBytes: number;
};

/**
 * Compresses a captured photo to fit under `maxMb`. Walks the compression
 * ladder from best quality downward and stops at the first result that fits;
 * if none does, the smallest is kept, so a photo is never lost to its size.
 */
export async function compressPhoto(
  sourceUri: string,
  sourceWidth: number,
  sourceHeight: number,
  maxMb: number,
): Promise<CompressedPhoto> {
  const maxBytes = photoMaxBytes(maxMb);
  let last: CompressedPhoto | null = null;

  for (const step of COMPRESSION_STEPS) {
    const context = ImageManipulator.manipulate(sourceUri);
    const target = fitWithin(sourceWidth, sourceHeight, step.maxEdgePx);
    if (target) {
      context.resize(target);
    }
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      compress: step.quality,
      format: SaveFormat.JPEG,
    });

    // A step that didn't fit is discarded before trying the next.
    if (last) {
      last.file.delete();
    }
    const file = new File(saved.uri);
    last = {
      file,
      widthPx: saved.width,
      heightPx: saved.height,
      sizeBytes: file.size,
    };
    if (last.sizeBytes <= maxBytes) {
      break;
    }
  }

  if (!last) {
    throw new Error('No compression step ran.');
  }
  return last;
}

/** Moves a compressed photo from the cache into the permanent photos folder. */
export function keepPhoto(compressed: CompressedPhoto, fileName: string): File {
  const destination = photoFile(fileName);
  if (destination.exists) {
    destination.delete();
  }
  compressed.file.move(destination);
  return destination;
}

export function deletePhotoFile(fileName: string): void {
  const file = photoFile(fileName);
  if (file.exists) {
    file.delete();
  }
}
