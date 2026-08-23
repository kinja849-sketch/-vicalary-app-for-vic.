const fs = require('fs');
const https = require('https');
const path = require('path');

const banks = [
    { id: 'bca', title: 'Bank Central Asia' },
    { id: 'mandiri', title: 'Bank Mandiri' },
    { id: 'bni', title: 'Bank Negara Indonesia' },
    { id: 'cimb', title: 'CIMB Niaga' },
    { id: 'bri', title: 'Bank Rakyat Indonesia' },
    { id: 'danamon', title: 'Bank Danamon' },
    { id: 'permata', title: 'Permata Bank' },
    { id: 'bsi', title: 'Bank Syariah Indonesia' },
    { id: 'maybank', title: 'Maybank' },
    { id: 'panin', title: 'Panin Bank' },
    { id: 'ocbc', title: 'OCBC Indonesia' },
    { id: 'mega', title: 'Bank Mega' },
    { id: 'btn', title: 'Bank Tabungan Negara' }
];

async function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function download(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => file.close(resolve));
            } else {
                reject(response.statusCode);
            }
        }).on('error', reject);
    });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
    for (const b of banks) {
        try {
            const api = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&titles=${encodeURIComponent(b.title)}&format=json&pithumbsize=500`;
            const data = await fetchJson(api);
            const pages = data.query.pages;
            const pageId = Object.keys(pages)[0];
            const imgUrl = pages[pageId].thumbnail?.source;

            if (imgUrl) {
                await download(imgUrl, path.join(__dirname, 'public', 'logos', `${b.id}.png`));
                console.log(`Downloaded ${b.id}.png from ${imgUrl}`);
            } else {
                // fallback to indonesian wiki
                const apiId = `https://id.wikipedia.org/w/api.php?action=query&prop=pageimages&titles=${encodeURIComponent(b.title)}&format=json&pithumbsize=500`;
                const dataId = await fetchJson(apiId);
                const pagesId = dataId.query.pages;
                const pageIdId = Object.keys(pagesId)[0];
                const imgUrlId = pagesId[pageIdId].thumbnail?.source;
                if (imgUrlId) {
                    await download(imgUrlId, path.join(__dirname, 'public', 'logos', `${b.id}.png`));
                    console.log(`Downloaded ${b.id}.png from ${imgUrlId} (ID Wiki)`);
                } else {
                    console.log(`No image found for ${b.title}`);
                }
            }
            await sleep(500); // Prevent 429
        } catch (e) {
            console.error(`Failed ${b.title}:`, e);
        }
    }
}

run();
