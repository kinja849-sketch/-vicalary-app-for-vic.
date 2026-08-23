const https = require('https');

const rawBanks = [
    { id: 'bca', url: 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Bank_Central_Asia.svg' },
    { id: 'mandiri', url: 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Bank_Mandiri_logo_2016.svg' },
    { id: 'bni', url: 'https://upload.wikimedia.org/wikipedia/commons/2/22/Bank_Negara_Indonesia_logo_%282004%29.svg' },
    { id: 'cimb', url: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/CIMB_Niaga_logo.svg' },
    { id: 'bri', url: 'https://upload.wikimedia.org/wikipedia/commons/2/2e/BRI_2020.svg' },
    { id: 'danamon', url: 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Logo_Bank_Danamon.svg' },
    { id: 'permata', url: 'https://upload.wikimedia.org/wikipedia/commons/3/38/PermataBank_logo.svg' },
    { id: 'bsi', url: 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Bank_Syariah_Indonesia.svg' },
    { id: 'maybank', url: 'https://upload.wikimedia.org/wikipedia/commons/c/c5/Maybank_logo.svg' },
    { id: 'panin', url: 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Logo_Panin_Bank.svg' },
    { id: 'ocbc', url: 'https://upload.wikimedia.org/wikipedia/commons/0/07/OCBC_logo.svg' },
    { id: 'mega', url: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Bank_Mega_logo.svg' },
    { id: 'btn', url: 'https://upload.wikimedia.org/wikipedia/commons/2/2c/Bank_Tabungan_Negara_logo.svg' }
];

async function checkUrl(url) {
    return new Promise((resolve) => {
        https.get(url, (res) => {
            resolve(res.statusCode);
        }).on('error', () => {
            resolve('ERROR');
        });
    });
}

async function run() {
    for (const b of rawBanks) {
        const code = await checkUrl(b.url);
        console.log(`${b.id}: ${code}`);
    }
}

run();
