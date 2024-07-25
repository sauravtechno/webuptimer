const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const moment = require('moment');
require('dotenv').config();

const app = express();
const port = process.env.PORT;

app.set('view engine', 'ejs');
app.set('views', './views');

const postUrl = process.env.POST_URL;
const pingUrl = process.env.PING_URL;
const thirdPartyUrl = process.env.THIRD_PARTY_URL;
const bearerToken = process.env.BEARER_TOKEN;
const postData = {
    _id: process.env.POST_DATA_ID
};

let maxUptime = 0;
let currentUptime = 0;
let downtime = 0;
let status = 'Unknown';

function formatDuration(seconds) {
    const duration = moment.duration(seconds, 'seconds');
    const days = Math.floor(duration.asDays());
    const hours = duration.hours();
    const minutes = duration.minutes();
    const secs = duration.seconds();
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

async function sendPostRequest() {
    try {
        const response = await axios.post(postUrl, postData, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': bearerToken
            }
        });
        console.log('Response:', response.data);
    } catch (error) {
        console.error('Error in POST request:', error.response ? error.response.data : error.message);
    }
}

async function pingUrlRequest() {
    try {
        const response = await axios.get(pingUrl);
        if (response.status === 200) {
            currentUptime += 3; // since the request interval is 3 seconds
            maxUptime = Math.max(maxUptime, currentUptime);
            status = 'Up';
        } else {
            throw new Error(`Status code: ${response.status}`);
        }
    } catch (error) {
        console.error('Error in ping request:', error.response ? error.response.data : error.message);
        console.log('Max uptime:', maxUptime, 'seconds');
        downtime += 3; // increment downtime
        currentUptime = 0; // reset current uptime on error
        status = 'Down';
    }
}

async function pingThirdParty() {
    try {
        const response = await axios.get(thirdPartyUrl);
        console.log('Third party response:', response.data);
    } catch (error) {
        console.error('Error in third party ping request:', error.response ? error.response.data : error.message);
    }
}

app.get('/ping', (req, res) => {
    res.json({ status, currentUptime, maxUptime, downtime });
});

app.get('/status', (req, res) => {
    res.render('index', { status, currentUptime, maxUptime, downtime, formatDuration });
});

// Set up cron job to ping third party URL every 13 minutes
cron.schedule('*/13 * * * *', () => {
    pingThirdParty();
});

// Ping URL and send POST request every 3 seconds
setInterval(() => {
    sendPostRequest();
    pingUrlRequest();
}, 3000);

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
