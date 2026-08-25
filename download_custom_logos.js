const fs = require('fs');
const https = require('https');
const path = require('path');

const files = [
  'bank-bsi-logo.svg',
  'bank-central-asia-(bca)-logo.svg',
  'bank-cimb-niaga-logo.svg',
  'bank-danamon-logo.svg',
  'bank-mandiri-logo.png',
  'bank-negara-indonesia-(bni)-logo.png',
  'bank-permata-logo.png',
  'bank-rakyat-indonesia-(bri)-logo.svg',
  'maybank-logo.png'
];

async function download(filename) {
    const url = `https://raw.githubusercontent.com/king120kw/the-app-belong-to-vic-/main/public/${encodeURIComponent(filename)}`;
    const dest = path.join(__dirname, 'public', 'custom-logos', filename);
    
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => file.close(resolve));
            } else {
                reject(`Failed with status: ${response.statusCode}`);
            }
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err.message));
        });
    });
}

async function run() {
    for (const f of files) {
        try {
            await download(f);
            console.log(`Downloaded ${f}`);
        } catch (e) {
            console.error(`Error downloading ${f}: ${e}`);
        }
    }
}

run();
