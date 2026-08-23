const https = require('https');

async function check() {
    try {
        const res = await fetch('https://logo.uplead.com/bca.co.id');
        console.log("Uplead BCA OK:", res.ok, res.status);
    } catch (e) {
        console.error("Error fetching:", e);
    }
}

check();
