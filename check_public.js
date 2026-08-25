const https = require('https');

https.get('https://api.github.com/repos/king120kw/the-app-belong-to-vic-/contents/public', {
    headers: { 'User-Agent': 'Node.js' }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log(JSON.parse(data).map(f => f.name)));
});
