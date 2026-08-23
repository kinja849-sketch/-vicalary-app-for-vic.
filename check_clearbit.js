const https = require('https');

async function check() {
    try {
        const res = await fetch('https://logo.clearbit.com/bca.co.id');
        console.log("BCA Clearbit OK:", res.ok, res.status);
        console.log("Content-Type:", res.headers.get('content-type'));
        
        const res2 = await fetch('https://logo.clearbit.com/danamon.co.id');
        console.log("Danamon Clearbit OK:", res2.ok, res2.status);
    } catch (e) {
        console.error("Error fetching:", e);
    }
}

check();
