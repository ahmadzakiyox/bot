const axios = require('axios');



const fs = require('fs');

const path = require('path');
const { authenticator } = require('otplib');

const transactionCountFile = path.join(__dirname, 'transaction_count.json');
const usersFile = path.join(__dirname, 'users.json');

// Function to make API requests
const doRequest = async (method, endpoint, data) => {
  const url = `https://api.digitalocean.com/v2${endpoint}`;
  const config = {
    method,
    url,
    headers: {
      'Authorization' : 'Bearer dop_v1_9b97b1d149d46c352b58b028c8492d5f0d7ce981738cdfa1a838da4ee04f5d90',
      'Content-Type': 'application/json'
    },
    data
  };
  const response = await axios(config);
  return response.data;
};

// Function to generate a random password
const generateRandomPassword = () => {
  return Math.random().toString(36).slice(-8);
};

// Function to fetch OS images dynamically
async function fetchOSImages() {
    return await doRequest('get', '/images?type=distribution');
  }

// Helper function to load transaction count
const loadTransactionCount = () => {
  try {
    if (fs.existsSync(transactionCountFile)) {
      const data = fs.readFileSync(transactionCountFile, 'utf8');
      if (data) {
        return JSON.parse(data).count || 0;
      }
    }
  } catch (err) {
    console.error('Failed to load transaction count:', err);
  }
  return 0;
};

// Helper function to save transaction count
const saveTransactionCount = (count) => {
  try {
    fs.writeFileSync(transactionCountFile, JSON.stringify({ count }));
  } catch (err) {
    console.error('Failed to save transaction count:', err);
  }
};

// Helper function to save users to JSON file
const saveUsers = (users) => {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
};

// Function to generate 2FA code from secret
const generate2FA = (secret) => {
  return authenticator.generate(secret);
};

// Middleware to check if the user is the owner
const isOwner = (ctx, next) => {
  if (ctx.message.from.id === parseInt(global.ownerId, 10)) {
    return next();
  } else {
    return ctx.reply('Anda tidak memiliki izin untuk menggunakan perintah ini.');
  }
};

module.exports = {
  doRequest,
  generateRandomPassword,
  loadTransactionCount,
  saveTransactionCount,
  saveUsers,
  generate2FA,
  isOwner,
  fetchOSImages
};
