const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.json());

// Function to encode video to HLS with multiple resolutions and subtitles
const encodeToHLS = (inputPath, outputDir) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-preset veryfast',
        '-g 48',
        '-sc_threshold 0',
        '-map 0:0',
        '-map 0:1',
        '-map 0:0',
        '-map 0:1',
        '-map 0:0',
        '-map 0:1',
        '-map 0:s?',        // map all subtitle streams
        '-s:v:0 854x480',   // 480p
        '-c:v:0 libx264',
        '-b:v:0 1400k',
        '-s:v:1 1280x720',  // 720p
        '-c:v:1 libx264',
        '-b:v:1 2800k',
        '-s:v:2 1920x1080', // 1080p
        '-c:v:2 libx264',
        '-b:v:2 5000k',
        '-c:a copy',
        '-c:s mov_text',    // ensure subtitles are in a compatible format
        '-var_stream_map "v:0,a:0 v:1,a:1 v:2,a:2 s:0,s:1,s:2"', // map video, audio, and subtitle streams
        '-master_pl_name master.m3u8',
        '-f hls',
        '-hls_time 6',
        '-hls_list_size 0',
        '-hls_segment_filename',
        `${outputDir}/v%v/fileSequence%d.ts`
      ])
      .output(`${outputDir}/v%v/prog_index.m3u8`)
      .on('end', () => resolve(`${outputDir}/master.m3u8`))
      .on('error', reject)
      .run();
  });
};

app.post('/encode', async (req, res) => {
  const { filename_url } = req.body;
  const inputPath = path.join(__dirname, 'uploads', path.basename(filename_url));
  const outputDir = path.join(__dirname, 'hls', path.basename(filename_url, path.extname(filename_url)));
  fs.mkdirSync(outputDir, { recursive: true });

  // Download the file from the URL to the server
  const response = await axios({
    url: filename_url,
    method: 'GET',
    responseType: 'stream'
  });

  const writer = fs.createWriteStream(inputPath);
  response.data.pipe(writer);

  writer.on('finish', async () => {
    try {
      const hlsUrl = await encodeToHLS(inputPath, outputDir);
      res.json({ url: `/hls/${path.basename(hlsUrl)}` });
    } catch (error) {
      res.status(500).send('Error encoding video');
    }
  });

  writer.on('error', () => res.status(500).send('Error downloading video'));
});

app.use('/hls', express.static(path.join(__dirname, 'hls')));

app.listen(3000, () => {
  console.log('Server started on http://localhost:3000');
});
