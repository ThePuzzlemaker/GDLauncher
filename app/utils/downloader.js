import makeDir from 'make-dir';
import fss from 'fs';
import reqCall from 'request';
import path from 'path';
import assert from 'assert';
import os from'os';
import log from 'electron-log';
import Promise from'bluebird';
import request from'request-promise-native';
import { promisify } from 'util';
import { DOWNLOAD_FILE_COMPLETED } from '../actions/downloadManager';

const fs = Promise.promisifyAll(fss);

export const downloadArr = async (arr, folderPath, dispatch, pack, threads = os.cpus().length) => {
  await Promise.map(arr, async item => {
    // TODO: item.legacyPath ? path.join(folderPath, item.legacyPath) : null
    // Handle legacyPaths better (own function)
    await downloadFileInstance(path.join(folderPath, item.path), item.url);
    dispatch({
      type: DOWNLOAD_FILE_COMPLETED,
      payload: { pack }
    });
  }, { concurrency: threads });
}

const downloadFileInstance = async (filename, url, legacyPath = null) => {
  try {
    const filePath = path.dirname(filename);
    try {
      await fs.accessAsync(filePath);
    } catch (e) {
      await makeDir(filePath);
    }
    const file = await request(url, { encoding: 'binary' });
    await fs.writeFileAsync(filename, file, 'binary');
    // This handles legacy assets.
    if (legacyPath !== null && legacyPath !== undefined) {
      try {
        await fs.accessAsync(legacyPath);
      } catch (e) {
        try {
          await fs.accessAsync(path.dirname(legacyPath));
        } catch (e) {
          await makeDir(path.dirname(legacyPath));
        } finally {
          await fs.writeFileAsync(legacyPath, file, 'binary');
        }
      }
    }
  } catch (e) {
    log.error(`Error while downloading <${url}> to <${filename}> --> ${e.message}`);
  }
}

export const downloadFile = (filename, url, onProgress) => {
  return new Promise((resolve, reject) => {
    // Save variable to know progress
    var received_bytes = 0;
    var total_bytes = 0;

    var req = reqCall({
      method: 'GET',
      uri: url,
    });

    var out = fss.createWriteStream(filename);
    req.pipe(out);

    req.on('response', (data) => {
      // Change the total bytes value to get progress later.
      total_bytes = parseInt(data.headers['content-length']);
    });

    req.on('data', (chunk) => {
      // Update the received bytes
      received_bytes += chunk.length;
      onProgress(((received_bytes * 18) / total_bytes).toFixed(1));
    });

    req.on('end', () => {
      resolve();
    });

    req.on('error', () => {
      reject();
    })
  });
}

// function checkFile(lpath, size, sha1) {
//   return fs.stat(lpath).then(stats => assert.equal(stats.size, size, 'wrong size for ' + lpath))
//     .then(() => fs.readFile(lpath))
//     .then(data => assert.equal(crypto.createHash('sha1').update(data).digest('hex'), sha1, `wrong sha1 for ${lpath}`))
//     .then(() => lpath);
// }