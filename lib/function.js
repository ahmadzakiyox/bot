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
      'Authorization' : `Bearer ${global.DO_APIKEY}`,
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

// Fungsi untuk memuat ID pengguna dari users.json
function loadUsers() {
    if (fs.existsSync(usersFile)) {
        const data = fs.readFileSync(usersFile);
        try {
            const json = JSON.parse(data);
            return Array.isArray(json) ? json : [];
        } catch (error) {
            console.error('Failed to parse users.json:', error);
            return [];
        }
    }
    return [];
}

// Fungsi untuk menyimpan ID pengguna ke users.json
function saveUser(userId) {
    const users = loadUsers();
    if (!users.includes(userId)) {
        users.push(userId);
        fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
    }

  
}
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

// Fungsi untuk escape karakter khusus Markdown
function escapeMarkdown(text) {
  return text.replace(/([_*[\]()~`>#+-=|{}.!])/g, '\\$1');
}

module.exports = {
  doRequest,
  generateRandomPassword,
  loadTransactionCount,
  saveTransactionCount,
  saveUser,
  loadUsers,
  generate2FA,
  isOwner,
  escapeMarkdown
};
