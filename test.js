const axios = require('axios');

axios.get('http://localhost:3001/lua')
    .then(response => console.log('Success:', response.data))
    .catch(error => console.log('Error:', error.message));