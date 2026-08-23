const http = require('http');

const data = JSON.stringify({
  categories: ["Seafood", "Beef", "Chicken", "Vegetarian", "Vegan", "Pasta", "Breakfast", "Dessert"],
  limit: 20
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/recipes/sync',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  res.on('end', () => {
    console.log(responseData);
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(data);
req.end();
