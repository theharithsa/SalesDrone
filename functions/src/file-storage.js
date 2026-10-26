import { getStorage } from 'firebase-admin/storage';
import { AppError } from './contracts.js';
import { MAX_FILE_BYTES } from './attachments.js';
export function firebaseFiles(
  observe = (_name, fn) => fn(),
  bucketName = 'sales-drone-avinya.firebasestorage.app',
) {
  const bucket = () => getStorage().bucket(bucketName);
  return {
    save: async (path, bytes, contentType, checksum) =>
      observe('storage.upload', async () => {
        try {
          await bucket()
            .file(path)
            .save(bytes, {
              resumable: false,
              validation: 'crc32c',
              preconditionOpts: { ifGenerationMatch: 0 },
              metadata: {
                contentType,
                cacheControl: 'private, no-store',
                metadata: { sha256: checksum },
              },
            });
        } catch (e) {
          if (Number(e.code) === 412) {
            const [m] = await bucket().file(path).getMetadata();
            if (m.metadata?.sha256 === checksum) return;
            throw new AppError(
              409,
              'FILE_CONFLICT',
              'This upload already contains a different file',
            );
          }
          throw new AppError(
            503,
            'STORAGE_UNAVAILABLE',
            'File storage is unavailable; retry this upload',
          );
        }
      }),
    read: async (path) =>
      observe('storage.download', async () => {
        try {
          const [m] = await bucket().file(path).getMetadata();
          if (Number(m.size) > MAX_FILE_BYTES) throw Error();
          const [b] = await bucket()
            .file(path, { generation: m.generation })
            .download();
          return b;
        } catch {
          throw new AppError(
            503,
            'STORAGE_UNAVAILABLE',
            'The file could not be downloaded; retry shortly',
          );
        }
      }),
    delete: async (path) =>
      observe('storage.delete', () =>
        bucket().file(path).delete({ ignoreNotFound: true }),
      ),
  };
}
