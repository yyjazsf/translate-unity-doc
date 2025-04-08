/**
 * https://docs.unity3d.com/6000.0/Documentation/Manual/OfflineDocumentation.html
 * download all the docs from the url
 */

// suggest download the doc by aria2

// 6000.0
// https://cloudmedia-docs.unity3d.com/docscloudstorage/en/6000.0/UnityDocumentation.zip

//Unity 6.2 Alpha (same as 6.1)
// https://cloudmedia-docs.unity3d.com/docscloudstorage/en/6000.1/UnityDocumentation.zip

// 6.1 bete
// https://cloudmedia-docs.unity3d.com/docscloudstorage/en/6000.1/UnityDocumentation.zip

//! download the doc to the /en foder

import axios from 'axios';
import fs from 'fs';
import path from 'path';

const url = 'https://cloudmedia-docs.unity3d.com/docscloudstorage/en/6000.1/UnityDocumentation.zip'
const outputPath = path.join(__dirname, 'en', 'UnityDocumentation.zip');

// check if the aria2 server is running
const isAria2Running = await axios.get('http://localhost:6800/jsonrpc')
if(isAria2Running.status === 200) {
  console.log('Aria2 server is running')
  // download the doc by aria2

  async function download(url: string) {
    const rpcUrl = 'http://localhost:6800/jsonrpc';
    const token = ''; // 或空字符串
  
    const res = await axios.post(rpcUrl, {
      jsonrpc: '2.0',
      method: 'aria2.addUri',
      id: new Date().getTime().toString(),
      params: [
        `token:${token}`,
        [url]
      ]
    });
  
    console.log('Response:', res.data);
    console.log('you need unzip the doc to the /en folder by yourself')
  }

  download(url)
  process.exit(0)
}
console.log(`Aria2 server is not running, download the doc by axios, it's very slow`)
axios.get(url, { responseType: 'stream' })
  .then(response => {
    const writer = fs.createWriteStream(outputPath);
    let totalLength = 0;
    let currentLength = 0;
    
    if (response.headers['content-length']) {
      totalLength = parseInt(response.headers['content-length'], 10);
    }

    response.data.on('data', (chunk: Buffer) => {
      currentLength += chunk.length;
      const progress = Math.round((currentLength / totalLength) * 100);
      process.stdout.write(`\rDownloading: ${progress}% (${currentLength}/${totalLength})`);
    });

    response.data.pipe(writer);

    writer.on('finish', () => {
      // unzip to /en folder
      const unzip = require('unzipper');
      const fs = require('fs');
      const path = require('path');

      const zipPath = path.join(__dirname, 'en', 'UnityDocumentation.zip');
      const unzipPath = path.join(__dirname, 'en');

      fs.createReadStream(zipPath)
        .pipe(unzip.Extract({ path: unzipPath }))
        .on('finish', () => {
          console.log('\nUnzip complete');
        });

      console.log('\nDownload complete');
    });

    writer.on('error', (error) => {
      console.error('Download error:', error);
    });
  })
  .catch(error => { 
    console.error('Download error:', error);
  });


