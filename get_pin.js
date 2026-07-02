const https = require('https');

https.get('https://html.duckduckgo.com/html/?q=site:pinterest.com/pin/+video', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const matches = data.match(/https:\/\/www\.pinterest\.[a-z]+\/pin\/\d+\//g);
        if (matches) {
            console.log(matches.slice(0, 5));
        } else {
            console.log("No pins found.");
        }
    });
});
