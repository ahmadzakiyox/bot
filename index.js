//============LIB============ 
const { Telegraf, Markup, session } = require('telegraf');
const axios = require('axios');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs');

//============FILE============ 
const usersave = './users.json';
const usersFile = path.join(__dirname, 'users.json');
const transactionCountFile = path.join(__dirname, 'transaction_count.json');
// Import the entire module
const scp = require('@danitech/scraper');
// State untuk menyimpan ID pengguna yang sedang melakukan deposit
const depositState = {};
const userSelections = {};
const prices = {
  's-1vcpu-1gb': 30000,
  's-1vcpu-2gb': 45000,
  's-2vcpu-2gb': 60000,
  's-2vcpu-4gb': 80000,
  's-4vcpu-8gb': 120000
};

//============CONFIG============//
let token = ["7132427541:AAEFLERuvFo9MYy8LSyjpaYDrBui408gmwA"]// TOKEN BOT TELEGRAM
let botname = 'BOGEL STORE BOT'//NAMA UNTUK BOT 
let ownerId = '6752163466'//ID OWNER TELEGRAM bisa pakai Bot Rose untuk mendapatkan user ID
let owner = 'BogelStore1'//Username Owner
let groupId = '-1002081929222' // ID grup Telegram gunakan Helper Bot untuk mendapatka ID Group dengan cara /info @Username_Group
let channelId = '-1002160623851' // ID channel Telegram gunakan Helper Bot untuk mendapatka ID Channel dengan cara /info @Username_Channel
let PHOTO_URL = 'https://telegra.ph//file/a22656931d544e1bd216e.jpg'//LINK PHOTO UNTUK DI TAMPILKAN DALAM BROADCAST JIKA ADA USER / BUYYER YANG MELAKUKAN PEMBELIAN
let MONGODB_URI = 'mongodb+srv://ahmadzakime:lelang18@restapi.syyz2sc.mongodb.net/?retryWrites=true&w=majority&appName=Restapi'
let DO_APIKEY = 'dop_v1_9b97b1d149d46c352b58b028c8492d5f0d7ce981738cdfa1a838da4ee04f5d90'
let SERVICE_PAYDISINI = '23'//Nomor Service PAYDISINI
let TYPEFEE = '1'//TYPE FEE PAYDISINI
let timepaydisini = '1800'// Waktu timer EXP untuk QRIS Paydisini
const bot = new Telegraf(token);
bot.use(session());

//==========MONGODB CONNECTION========== 
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));
  
// Schema definitions
const productSchema = new mongoose.Schema({
  nama: { type: String, required: true },
  kode: { type: String, required: true, unique: true },
  harga: { type: Number, required: true },
  deskripsi: { type: String, required: true },
  stock: { type: Number, default: 0 },
  terjual: { type: Number, default: 0 },
});

const userSchema = new mongoose.Schema({
  userId: { type: Number, required: true, unique: true },
  saldo: { type: Number, default: 0 },
});

// Schema Stock, sesuaikan dengan model Anda
const stockSchema = new mongoose.Schema({
  kode: String,
  email: String,
  username: String,
  password: String,
  twoFactorAuth: String, // Opsional 2FA
});

// Definisi model Deposit
const depositSchema = new mongoose.Schema({
  userId: { type: Number, required: true },
  amount: { type: Number, required: true },
  status: { type: String, default: 'pending' },
  uniqueCode: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Model definitions
const Stock = mongoose.model('Stock', stockSchema);
const Product = mongoose.model('Product', productSchema);
const User = mongoose.model('User', userSchema);
const Deposit = mongoose.model('Deposit', depositSchema);


//============FUNCTION===========
// Function to make API requests
const doRequest = async (method, endpoint, data) => {
  const url = `https://api.digitalocean.com/v2${endpoint}`;
  const config = {
    method,
    url,
    headers: {
      'Authorization' : `Bearer ${DO_APIKEY}`,
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

// Middleware to check if the user is the owner
const isOwner = (ctx, next) => {
  if (ctx.message.from.id === parseInt(ownerId, 10)) {
    return next();
  } else {
    return ctx.reply('Anda tidak memiliki izin untuk menggunakan perintah ini.');
  }
};

// Fungsi untuk escape karakter khusus Markdown
function escapeMarkdown(text) {
  return text.replace(/([_*[\]()~`>#+-=|{}.!])/g, '\\$1');
}



// Middleware to log all commands and handle unknown commands
bot.use((ctx, next) => {
  if (ctx.message && typeof ctx.message.text === 'string') {
    const timestamp = new Date().toLocaleTimeString();
    const username = ctx.message.from.username || 'Unknown User';
    const command = ctx.message.text;

    console.log(`[${timestamp}] User: @${username}, Command: ${command}`);

    if (command.startsWith('/')) {
      const knownCommands = ['start', 'privacy', 'menu', 'beli', 'addsaldo', 'addproduk', 'delproduk', 'addstock', 'setharga', 'resetdb', 'bc'];

      if (!knownCommands.includes(command.substring(1).split(' ')[0])) {
        ctx.reply('⚠️ Command tidak ditemukan. Silakan gunakan perintah yang valid.');
      }
    }
  }
  return next();
});

//============USER COMMAND============

// Command start
bot.command('start', (ctx) => {
    const username = ctx.message.from.username;
    const userId = ctx.from.id;
    saveUser(userId);
    let user = User.findOne({ userId });
    if (!user) {
      user = new User({ userId });
      user.save();
    }
    
    ctx.reply(`Halo ${username}! Nama saya ${botname}. Saya adalah BOT Sale Telegram! Klik /menu untuk mengetahui lebih lanjut tentang cara menggunakan bot ini.\n\nKirim perintah /privacy untuk melihat syarat dan ketentuan penggunaan bot.`, { reply_to_message_id: ctx.message.message_id });
});

// Command menu 
bot.command('menu', async (ctx) => {
  try {
    await ctx.reply(
      `╭─❒ 「 Bot Info 」 
├ Creator : [@ahmadzakiyo]
├ Sponsored : [@BotFather]
├ Memory Used : ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB / ${Math.round(os.totalmem() / 1024 / 1024)}MB
├ Hostname : ${os.hostname()}
├ Platform : ${os.platform()}
╰❒ 

╭─❒ 「 USER MENU 」 
╰❒ 
      `,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'DEPOSIT', callback_data: 'deposit' },
              { text: 'CEKSALDO', callback_data: 'ceksaldo' }
            ],
            [
              { text: 'LIST PRODUK', callback_data: 'listproduk' },
              { text: 'INFO', callback_data: 'info' }
            ],
            [
              { text: 'CARA ORDER', callback_data: 'caraorder' }
            ],
            [
              { text: 'CREATE VPS', callback_data: 'createvps' }

            ]
          ]
        },
        reply_to_message_id: ctx.message.message_id
      }
    );
  } catch (error) {
    console.error('Error handling menu action:', error);
    // Jika ada kesalahan, hanya kirimkan pesan kesalahan ke pengguna tanpa membalas ke pesan tertentu
    await ctx.reply('Terjadi kesalahan saat menampilkan menu.');
  }
});

// Command untuk menampilkan kebijakan privasi
bot.command ('privacy', (ctx) => {
  const privacyMessage = `
**Kebijakan Privasi**

Kami berkomitmen untuk melindungi privasi Anda. Berikut adalah rincian kebijakan privasi kami:

1. **Pengumpulan Informasi:**
   - Kami mengumpulkan informasi yang Anda berikan saat menggunakan layanan kami, termasuk nama pengguna, ID Telegram, dan informasi lainnya yang diperlukan untuk memberikan layanan yang Anda minta.

2. **Penggunaan Informasi:**
   - Informasi yang kami kumpulkan digunakan untuk memproses pesanan, memberikan layanan, dan meningkatkan pengalaman pengguna.

3. **Keamanan Informasi:**
   - Kami mengambil langkah-langkah yang wajar untuk melindungi informasi Anda dari akses yang tidak sah atau penggunaan yang tidak sah.

4. **Pembagian Informasi:**
   - Kami tidak akan membagikan informasi pribadi Anda dengan pihak ketiga tanpa persetujuan Anda, kecuali jika diperlukan oleh hukum.

5. **Perubahan Kebijakan:**
   - Kami dapat mengubah kebijakan privasi ini dari waktu ke waktu. Perubahan akan dipublikasikan di saluran ini.

Jika Anda memiliki pertanyaan atau kekhawatiran tentang kebijakan privasi kami, silakan hubungi admin atau owner.

Terima kasih telah menggunakan layanan kami.
  `;

    ctx.reply(privacyMessage, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🤖HUBUNGI OWNER🤖', url: `https://t.me/${owner}` }]
      ]
    },
    reply_to_message_id: ctx.message.message_id
  })
});

// Handle caraorder
bot.action('caraorder', (ctx) => {
  const message = `
**Cara Order Produk:**

1. **Cara Order Produk Akun:**
   - Ketik /beli diikuti dengan kode produk dan jumlah.
   - Contoh: /beli kodeproduk jumlah
   - Admin atau owner akan memverifikasi dan memproses pesanan Anda.

Jika Anda memiliki pertanyaan lebih lanjut atau membutuhkan bantuan, jangan ragu untuk menghubungi admin atau owner.
`;

  ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🤖HUBUNGI OWNER🤖', url: `https://t.me/${owner}` }]
      ]
    }
  })
  ctx.deleteMessage();  // Hapus pesan yang memicu aksi ini
});

// Handle info user
bot.action('info', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const firstName = escapeMarkdown(ctx.from.first_name || 'Tidak tersedia');
    const lastName = escapeMarkdown(ctx.from.last_name || 'Tidak tersedia');
    const profileLink = escapeMarkdown(`@${ctx.from.username || 'tidak_terdaftar'}`);

    // Temukan atau buat pengguna
    let user = await User.findOne({ userId });
    if (!user) {
      user = new User({ userId });
      await user.save();
    }

    // Ambil saldo dari pengguna yang ditemukan
    const saldo = `Rp ${user.saldo || 0}`; // Ganti dengan kode untuk mendapatkan saldo jika tersedia
    
    const message = `
👤 ID Telegram: \`${userId}\`
👦🏻 First Name: \`${firstName}\`
👪 Last Name: \`${lastName}\`
🌐 Profile Link: \`${profileLink}\`
💳 Saldo: \`${saldo}\`
    `;

    await ctx.reply(message, {
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Error handling /info command:', error);
    await ctx.reply('Terjadi kesalahan saat menampilkan informasi.');
    await ctx.deleteMessage();  // Hapus pesan yang memicu aksi ini
  }
});

// Handle /listproduk
bot.action('listproduk', async (ctx) => {
  try {
    // Menghapus pesan yang memicu aksi ini
    await ctx.deleteMessage();

    const products = await Product.find();
    if (products.length === 0) {
      return await ctx.reply('Tidak ada produk yang tersedia.');
    }

    const validProducts = products.filter(p => p.nama && p.kode && p.harga !== undefined);

    if (validProducts.length === 0) {
      return await ctx.reply('Tidak ada produk yang valid tersedia.');
    }

    const header = `
╭────〔 *PRODUCT LIST📦* 〕─ 
┊・ Jika tidak mengetahui ketik #caraorder
┊・ Untuk membeli Ketik Perintah #order atau #buy 
┊・ #buy *code* *jumlah*
┊・ *Contoh : #buy YTGAR 1*
┊・ Pastikan Code & Jumlah Akun di *Ketik* dengan *benar*
╰┈┈┈┈┈┈┈┈
    `;

    const buttons = validProducts.map(p => ({
      text: `${p.nama} - Rp ${p.harga.toLocaleString('id-ID')}`,
      callback_data: `select_product_${p.kode}`
    }));

    // Atur tombol agar ditampilkan secara horizontal
    const inlineKeyboard = [];
    for (let i = 0; i < buttons.length; i += 2) {
      inlineKeyboard.push(buttons.slice(i, i + 2)); // 2 tombol per baris
    }

    // Mengirimkan pesan dengan daftar produk dan tombol
    await ctx.reply(header, {
      reply_markup: {
        inline_keyboard: inlineKeyboard
  },
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Error listing products:', error);
    await ctx.reply('Terjadi kesalahan saat menampilkan daftar produk.');
  }
});

// Handle product selection
bot.action(/^select_product_(\w+)$/, async (ctx) => {
  const kode = ctx.match[1];
  const userId = ctx.callbackQuery.from.id;
  const messageId = ctx.callbackQuery.message.message_id;

  try {
    const product = await Product.findOne({ kode });
    if (!product) {
      return ctx.reply('Produk tidak ditemukan.', { reply_to_message_id: messageId });
    }

    if (product.stock <= 0) {
      return ctx.reply('Stok produk habis. Tidak ada jumlah yang bisa dipilih.', { reply_to_message_id: messageId });
    }

    try {
      await ctx.deleteMessage();  // Hapus pesan yang memicu aksi ini
    } catch (deleteError) {
      console.warn('Error deleting message:', deleteError);
      await ctx.reply('Gagal menghapus pesan sebelumnya. Pesan mungkin sudah dihapus.', { reply_to_message_id: messageId });
    }

    const buttonCount = Array.from({ length: product.stock }, (_, i) => ({
      text: `${i + 1}`,
      callback_data: `select_quantity_${kode}_${i + 1}`
    }));

    const inlineKeyboard = [];
    for (let i = 0; i < buttonCount.length; i += 5) {
      inlineKeyboard.push(buttonCount.slice(i, i + 5)); // 5 tombol per baris
    }

    const productInfo = `
📦 *Informasi Produk*
- *Nama*: ${product.nama}
- *Kode*: ${product.kode}
- *Harga*: Rp ${product.harga.toLocaleString('id-ID')}
- *Deskripsi*: ${product.deskripsi || 'Tidak ada deskripsi'}
- *Stok Tersedia*: ${product.stock}

Pilih jumlah akun yang ingin dibeli untuk ${product.nama}
    `;

    await ctx.reply(productInfo, {
      reply_markup: {
        inline_keyboard: inlineKeyboard
  },
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Error selecting product:', error);
    ctx.reply('Terjadi kesalahan saat memilih produk.', { reply_to_message_id: messageId })
    ctx.deleteMessage();  // Hapus pesan yang memicu aksi ini
  }
});

// Handle quantity selection
bot.action(/^select_quantity_(\w+)_(\d+)$/, async (ctx) => {
  const [kode, jumlah] = [ctx.match[1], parseInt(ctx.match[2], 10)];
  const userId = ctx.callbackQuery.from.id;
  const messageId = ctx.callbackQuery.message.message_id;
  const username = ctx.callbackQuery.from.username || 'Unknown';
  
  try {
    const product = await Product.findOne({ kode });
    if (!product) {
      return ctx.reply('Produk tidak ditemukan.', { reply_to_message_id: messageId });
    }
    
    const user = await User.findOne({ userId });
    if (!user) {
      return ctx.reply('Anda belum memiliki akun. Lakukan deposit terlebih dahulu.');
    }
    
    console.log(`Stok produk saat ini: ${product.stock}`);

    const stocks = await Stock.find({ kode });
    console.log(`Jumlah stok ditemukan: ${stocks.length}`);
    
    const totalHarga = product.harga * parseInt(jumlah);
    if (user.saldo < totalHarga) {
      return ctx.reply('Saldo Anda tidak mencukupi.');
    }
    
    if (stocks.length < jumlah) {
      return ctx.reply('Stok produk tidak mencukupi untuk jumlah yang diminta.', { reply_to_message_id: messageId });
    }
    
    const stockIds = stocks.slice(0, jumlah).map(stock => stock._id);
    await Stock.deleteMany({ _id: { $in: stockIds } });
    
    // Kurangi saldo pengguna dan simpan perubahan
    user.saldo -= totalHarga;
    try {
      await user.save();
      console.log(`Saldo pengguna telah diperbarui: ${user.saldo}`);
    } catch (saveError) {
      console.error('Error saving user:', saveError);
      throw saveError;  // Ulangkan error agar bisa ditangkap oleh catch utama
    }
    
    product.stock -= jumlah;
    product.terjual += jumlah;
    try {
      await product.save();
      console.log(`Stok produk telah diperbarui: ${product.stock}, Terjual: ${product.terjual}`);
    } catch (saveError) {
      console.error('Error saving product:', saveError);
      throw saveError;  // Ulangkan error agar bisa ditangkap oleh catch utama
    }

    let accountInfos = stocks.slice(0, jumlah).map(stock => `
Kode Produk    : ${kode}
Email        : ${stock.email}
Username     : ${stock.username}
Password     : ${stock.password}
${stock.twoFactorAuth ? `2FA Code: ${stock.twoFactorAuth}` : ''}
────────────────────────
    `).join('\n\n');

    const fileName = `account-info-${userId}.txt`;
    const filePath = path.join(__dirname, fileName);
    fs.writeFileSync(filePath, accountInfos);

    if (jumlah > 1) {
      await ctx.replyWithDocument({ source: filePath }, { reply_to_message_id: messageId });
    } else {
      await ctx.reply(accountInfos, { reply_to_message_id: messageId });
    }

    fs.unlinkSync(filePath);

    await ctx.editMessageReplyMarkup({
      inline_keyboard: []  // Menghapus semua tombol
    });

    // Update transaction count
    let transactionCount = loadTransactionCount();
    transactionCount++;
    saveTransactionCount(transactionCount);
    
    // Pesan yang akan dikirim ke grup dan channel
    const transactionMessage = `╭──── 〔 *NOTIF OTOMATIS* 〕
*┊・ 🏷️| USERNAME:* ${username}
*┊・ 📦| Barang yang di beli :* ${product.nama}
*┊・ 🧾| Harga barang yang di beli :* Rp ${totalHarga}
*┊・ 🔐| Transaksi berhasil:* ${transactionCount}
   Pembelian barang berhasil, terima kasih telah berbelanja. Yuk beli akun di @nuxysaibot
   
   Auothor : @${owner}
   ©2024
╰┈┈┈┈┈┈┈┈`;

    // Kirim pesan ke grup dengan foto
    await bot.telegram.sendPhoto(groupId, PHOTO_URL, {
      caption: transactionMessage,
      parse_mode: 'Markdown',
    });

    // Kirim pesan ke channel dengan foto
    await bot.telegram.sendPhoto(channelId, PHOTO_URL, {
      caption: transactionMessage,
      parse_mode: 'Markdown',
    });

    console.log(`Product purchased: ${JSON.stringify({ kode, jumlah, userId })}`);
    ctx.reply('Pembelian berhasil. Terima kasih telah berbelanja.', { reply_to_message_id: messageId });
  } catch (error) {
    console.error('Error selecting quantity:', error);
    ctx.reply('Terjadi kesalahan saat memilih jumlah.', { reply_to_message_id: messageId });
    ctx.deleteMessage();  // Hapus pesan yang memicu aksi ini
  }
});

// Handle Ceksaldo user
bot.action('ceksaldo', async (ctx) => {
  const userId = ctx.from.id;
  try {
    // Menghapus pesan yang memicu aksi ini
    await ctx.deleteMessage();

    let user = await User.findOne({ userId });
    if (!user) {
      user = new User({ userId });
      await user.save();
    }

    // Mengirimkan balasan kepada pengguna
    await ctx.reply(`Saldo Anda saat ini adalah: Rp ${user.saldo.toLocaleString('id-ID')}`);
  
  } catch (error) {
    console.error('Failed to check saldo:', error);

    // Mengirimkan pesan kesalahan kepada pengguna
    await ctx.reply('Terjadi kesalahan saat memeriksa saldo Anda. Silakan coba lagi nanti.');
  }
});

// Command /deposit untuk memulai proses deposit
bot.action('deposit', (ctx) => {
  // Menyimpan ID pengguna yang memulai deposit
  depositState[ctx.from.id] = { action: 'request_amount' };

  ctx.reply('Silakan ketik jumlah nominal saldo yang ingin Anda depositkan:')
  // Menghapus pesan yang memicu aksi ini
  ctx.deleteMessage();
});

//============COMMAND OWNER============
// Command /bc
bot.command('bc', isOwner, (ctx) => {

  const users = loadUsers();
  const message = ctx.message.text.replace('/bc', '').trim();

  users.forEach(userId => {
      bot.telegram.sendMessage(userId, message)
          .catch(err => console.error(`Failed to send message to ${userId}:`, err));
  });

  ctx.reply('Broadcast message sent.', { reply_to_message_id: ctx.message.message_id });
});

// Command /resetdb
bot.command('resetdb', isOwner, async (ctx) => {
try {
  // Menghapus semua data dari koleksi
  await Product.deleteMany({});
  await User.deleteMany({});
  await Stock.deleteMany({});

  ctx.reply('Semua data di database telah dihapus.');
  console.log('Database reset successfully.');
} catch (error) {
  console.error('Error resetting database:', error);
  ctx.reply('Terjadi kesalahan saat menghapus data di database.', { reply_to_message_id: ctx.message.message_id });
}
});

// Command /addsaldo
bot.command('addsaldo', isOwner, async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length !== 2) {
    return ctx.reply('Gunakan format: /addsaldo <jumlah> <saldo>', { reply_to_message_id: ctx.message.message_id });
  }

  const [jumlahStr, saldoStr] = args;
  const jumlah = parseInt(jumlahStr, 10);
  const saldoToAdd = parseInt(saldoStr, 10);

  if (isNaN(jumlah) || isNaN(saldoToAdd) || jumlah <= 0 || saldoToAdd <= 0) {
    return ctx.reply('Jumlah dan saldo harus berupa angka positif.');
  }

  try {
    // Cari pengguna berdasarkan ID Telegram dari pesan yang diterima
    const userId = ctx.message.from.id;
    let user = await User.findOne({ userId });
    if (!user) {
      // Jika pengguna belum ada, buat entri baru
      user = new User({
        userId,
        username: ctx.message.from.username || 'Tidak ada username',
        saldo: saldoToAdd, // Inisialisasi saldo dengan nilai yang ditambahkan
      });
      await user.save();
      ctx.reply('Akun Anda telah berhasil dibuat dan saldo ditambahkan.');
    } else {
      // Tambahkan saldo baru ke pengguna yang sudah ada
      user.saldo += saldoToAdd;
      await user.save();
      ctx.reply(`Saldo Anda telah berhasil ditambahkan sebesar Rp ${saldoToAdd}. Saldo baru: Rp ${user.saldo}`, );
    }

    console.log(`Saldo updated for user ID ${userId}, New balance: ${user.saldo}`);
  } catch (error) {
    console.error('Error adding saldo:', error);
    ctx.reply('Terjadi kesalahan saat menambahkan saldo.');
  }
});

// Command /addproduk
bot.command('addproduk', isOwner, async (ctx) => {
const args = ctx.message.text.split(' ').slice(1);
if (args.length < 4) {
  return ctx.reply('Gunakan format: /addproduk <nama_produk> <kode_produk> <harga_produk> <deskripsi_produk>', { reply_to_message_id: ctx.message.message_id });
}

const [nama, kode, harga, ...deskripsiArr] = args;
const deskripsi = deskripsiArr.join(' ');

const newProduct = new Product({ nama, kode, harga: parseInt(harga), deskripsi });

try {
  await newProduct.save();
  ctx.reply('Produk berhasil ditambahkan!');
} catch (error) {
  console.error('Error adding product:', error);
  ctx.reply('Terjadi kesalahan saat menambahkan produk.', { reply_to_message_id: ctx.message.message_id } );
}
});

// Command /delproduk
bot.command('delproduk', isOwner, async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length !== 1) {
    return ctx.reply('Gunakan format: /delproduk <kode_produk>', { reply_to_message_id: ctx.message.message_id });
  }

  const kode = args[0];

  try {
    const result = await Product.deleteOne({ kode });
    if (result.deletedCount === 0) {
      ctx.reply('Produk tidak ditemukan.', { reply_to_message_id: ctx.message.message_id });
    } else {
      ctx.reply('Produk berhasil dihapus.', { reply_to_message_id: ctx.message.message_id });
    }
  } catch (error) {
    console.error('Error deleting product:', error);
    ctx.reply('Terjadi kesalahan saat menghapus produk.', { reply_to_message_id: ctx.message.message_id });
  }
});

// Command /addstock
bot.command('addstock', isOwner, async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 4 || args.length > 5) {
    return ctx.reply('Gunakan format: /addstock <kode_produk> <email> <username> <password> [2fa, Tidak Wajib ]', { reply_to_message_id: ctx.message.message_id });
  }

  const [kode, email, username, password, twoFactorAuth] = args;

  try {
    const product = await Product.findOne({ kode });
    if (!product) {
      return ctx.reply('Produk tidak ditemukan.', { reply_to_message_id: ctx.message.message_id });
    }

    // Tambahkan stock
    product.stock += 1; // Menambahkan stock 1, sesuaikan jika diperlukan

    // Simpan data stock tambahan
    const newStock = new Stock({ kode, email, username, password, twoFactorAuth: twoFactorAuth || '' });
    await newStock.save();

    // Simpan perubahan produk
    await product.save();

    ctx.reply(`Stock untuk produk dengan kode ${kode} berhasil ditambahkan.`,  { reply_to_message_id: ctx.message.message_id });
  } catch (error) {
    console.error('Error adding stock:', error);
    ctx.reply('Terjadi kesalahan saat menambahkan stock produk.', { reply_to_message_id: ctx.message.message_id });
  }
});

// Command /addstockall
bot.command('addstockall', isOwner, async (ctx) => {
  // Ambil teks perintah dan pisahkan dengan koma
  const text = ctx.message.text.split(' ').slice(1).join(' ');
  const entries = text.split(',').map(entry => entry.trim());

  // Validasi format data
  if (entries.length === 0 || entries.some(entry => entry.split(' ').length !== 4)) {
    return ctx.reply('Gunakan format: /addstockall <kode_produk> <email> <username> <password>, <kode_produk> <email> <username> <password>, ...', { reply_to_message_id: ctx.message.message_id });
  }

  try {
    for (const entry of entries) {
      const [kode, email, username, password] = entry.split(' ');

      const product = await Product.findOne({ kode });
      if (!product) {
        ctx.reply(`Produk dengan kode ${kode} tidak ditemukan.`, { reply_to_message_id: ctx.message.message_id });
        continue; // Skip to the next product
      }

      // Tambahkan stock
      product.stock += 1; // Menambahkan stock 1, sesuaikan jika diperlukan

      // Simpan data stock tambahan
      const newStock = new Stock({ kode, email, username, password, twoFactorAuth: '' });
      await newStock.save();

      // Simpan perubahan produk
      await product.save();
    }

    ctx.reply(`Stock untuk produk berhasil ditambahkan.`, { reply_to_message_id: ctx.message.message_id });
  } catch (error) {
    console.error('Error adding stock:', error);
    ctx.reply('Terjadi kesalahan saat menambahkan stock produk.', { reply_to_message_id: ctx.message.message_id });
  }
});

// Command /setharga
bot.command('setharga', isOwner, async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length !== 2) {
    return ctx.reply('Gunakan format: /setharga <kode_produk> <harga_baru>', { reply_to_message_id: ctx.message.message_id });
  }

  const [kode, hargaBaru] = args;

  try {
    const product = await Product.findOne({ kode });
    if (!product) {
      return ctx.reply('Produk tidak ditemukan.');
    }

    product.harga = parseInt(hargaBaru);
    await product.save();
    ctx.reply('Harga produk berhasil diubah.', { reply_to_message_id: ctx.message.message_id });
  } catch (error) {
    console.error('Error setting price:', error);
    ctx.reply('Terjadi kesalahan saat mengubah harga produk.', { reply_to_message_id: ctx.message.message_id });
  }
});

// Handle beli
bot.command('beli', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length !== 2) {
    return ctx.reply('Gunakan format: /beli <kode_produk> <jumlah_produk>', {reply_to_message_id: ctx.message.message_id});
  }

  const [kode, jumlah] = args;
  const userId = ctx.message.from.id;
  const username = ctx.message.from.username || 'Unknown';

  try {
    // Cek apakah pengguna sudah terdaftar
    const user = await User.findOne({ userId });
    if (!user) {
      return ctx.reply('Anda belum memiliki akun. Lakukan deposit terlebih dahulu.');
    }

    // Cek produk yang tersedia
    const product = await Product.findOne({ kode });
    if (!product) {
      return ctx.reply('Produk tidak ditemukan.');
    }

    const totalHarga = product.harga * parseInt(jumlah);
    if (user.saldo < totalHarga) {
      return ctx.reply('Saldo Anda tidak mencukupi.');
    }

    // Cek dan ambil data stok dari stok yang ada
    const stocks = await Stock.find({ kode }).limit(parseInt(jumlah));
    if (stocks.length < parseInt(jumlah)) {
      return ctx.reply('Stok produk tidak mencukupi untuk jumlah yang diminta.');
    }

    // Tampilkan opsi pembayaran
    const paymentOptions = Markup.inlineKeyboard([
      [Markup.button.callback('Bayar dengan Saldo', `pay_with_balance_${kode}_${jumlah}`)],
      [Markup.button.callback('Bayar dengan PayDisini', `pay_with_paydisini_${kode}_${jumlah}`)],
    ]);

    return ctx.reply('Pilih metode pembayaran:', paymentOptions);
  } catch (error) {
    console.error('Error processing purchase:', error);
    ctx.reply('Terjadi kesalahan saat memproses pembelian.', { reply_to_message_id: ctx.message.message_id });
  }
});


//============BOT ON============
// Handle input dari pengguna untuk jumlah deposit
bot.hears(/^\d+$/, async (ctx) => {
  const amount = parseInt(ctx.message.text);
  const userId = ctx.from.id;

  if (!depositState[userId] || depositState[userId].action !== 'request_amount') {
    return ctx.reply('Anda tidak sedang dalam proses deposit.');
  }

  if (isNaN(amount) || amount <= 0) {
    return ctx.reply('Jumlah deposit harus berupa angka positif.');
  }

  const uniqueCode = `user${userId}-${Date.now()}`;
  const key = 'fdf655de25e8b2da1f757206fa631cb9';
  const service = '11';
  const note = 'Deposit saldo';
  const validTime = `${timepaydisini}`;
  const typeFee = '1';
  const signatureString = `${key}${uniqueCode}${service}${amount}${validTime}NewTransaction`;
  const signature = crypto.createHash('md5').update(signatureString).digest('hex');

  try {
    const response = await axios.post('https://api.paydisini.co.id/v1/', new URLSearchParams({
      key,
      request: 'new',
      unique_code: uniqueCode,
      service,
      amount,
      note,
      valid_time: validTime,
      type_fee: typeFee,
      payment_guide: true,
      signature,
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
  }
    });

    if (response.data.success) {
      const { data } = response.data;
      const qrcodeUrl = data.qrcode_url;
      const { service_name, balance, fee, type_fee, note, status, expired } = data;

      // Simpan informasi deposit ke database
      const newDeposit = new Deposit({
        userId,
        amount,
        status: 'pending',
        uniqueCode,
      });
      await newDeposit.save();

      await ctx.replyWithPhoto(
        { url: qrcodeUrl },
        {
          caption: `Informasi Deposit:\n- Service Name: ${service_name}\n- Amount: ${amount}\n- Jumlah deposit: ${balance}\n- Fee: ${fee}\n- Type Fee: ${type_fee}\n- Note: ${note}\n- Status: ${status}\n- Expired: ${expired}`,
        }
      );

      console.log(`Deposit request created: ${JSON.stringify(data)}`);
    } else {
      ctx.reply('Minimal deposit adalah Rp1000');
      console.log(`Failed to create deposit request: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    ctx.reply('Gagal membuat permintaan deposit.');
    console.log(`Failed to create deposit request: ${error.message}`);
  }

  // Hapus state setelah selesai
  delete depositState[userId];
});

 // Handle size selection
  bot.action(/(vps|rdp)_size_.+/, async (ctx) => {
    const [type, , size] = ctx.match[0].split('_');
    userSelections[ctx.from.id].size = size;
    
    console.log(`Selected size: ${size}`); // Logging ukuran yang dipilih
    console.log(` object:`, ); // Logging objek prices
  
    const price = prices[size];
  
    // Periksa apakah harga valid
    if (!price) {
      ctx.reply('Harga untuk ukuran VM ini tidak valid.');
      return;
    }
  
    // Fetch available OS images dynamically
    const images = await doRequest('get', '/images?type=distribution');
    
    // Create vertical inline keyboard
    const osButtons = images.images.map(image => [Markup.button.callback(`${image.distribution} ${image.name}`, `${type}_os_${image.slug}`)]);
  
    ctx.reply(`Harga untuk ukuran yang dipilih adalah ${price} per bulan. Silakan pilih OS:`, Markup.inlineKeyboard(osButtons));
    ctx.deleteMessage(); // Hapus pesan sebelumnya
  });
  
  // Command untuk membuat VPS
bot.action('createvps', async (ctx) => {
    // Inisialisasi pilihan pengguna
    userSelections[ctx.from.id] = { type: 'vps' }; 
    ctx.reply('Silakan pilih Spek VM yang ingin dibuat:', Markup.inlineKeyboard([
      [Markup.button.callback('🖥 1 GB / 1 vCPU', 'vps_size_s-1vcpu-1gb')],
      [Markup.button.callback('🖥 2 GB / 1 vCPU', 'vps_size_s-1vcpu-2gb')],
      [Markup.button.callback('🖥 2 GB / 2 vCPU', 'vps_size_s-2vcpu-2gb')],
      [Markup.button.callback('🖥 4 GB / 2 vCPU', 'vps_size_s-2vcpu-4gb')],
      [Markup.button.callback('🖥 8 GB / 4 vCPU', 'vps_size_s-4vcpu-8gb')]
    ]));
  });
  
  // Command untuk membuat RDP
  bot.command('createrdp', async (ctx) => {
    // Inisialisasi pilihan pengguna
    userSelections[ctx.from.id] = { type: 'rdp' }; 
    ctx.reply('Silakan pilih Spek VM yang ingin dibuat:', Markup.inlineKeyboard([
      [Markup.button.callback('🖥 1 GB / 1 vCPU', 'rdp_size_s-1vcpu-1gb')],
      [Markup.button.callback('🖥 2 GB / 1 vCPU', 'rdp_size_s-1vcpu-2gb')],
      [Markup.button.callback('🖥 2 GB / 2 vCPU', 'rdp_size_s-2vcpu-2gb')],
      [Markup.button.callback('🖥 4 GB / 2 vCPU', 'rdp_size_s-2vcpu-4gb')],
      [Markup.button.callback('🖥 8 GB / 4 vCPU', 'rdp_size_s-4vcpu-8gb')]
    ]));
  });
  
  // Handle size selection
  bot.action(/(vps|rdp)_size_.+/, async (ctx) => {
    const [type, , size] = ctx.match[0].split('_');
    userSelections[ctx.from.id].size = size;
    
    console.log(`Selected size: ${size}`); // Logging ukuran yang dipilih
    console.log(` object:`, ); // Logging objek prices
  
    const price = prices[size];
  
    // Periksa apakah harga valid
    if (!price) {
      ctx.reply('Harga untuk ukuran VM ini tidak valid.');
      return;
    }
  
    // Fetch available OS images dynamically
    const images = await doRequest('get', '/images?type=distribution');
    
    // Create vertical inline keyboard
    const osButtons = images.images.map(image => [Markup.button.callback(`${image.distribution} ${image.name}`, `${type}_os_${image.slug}`)]);
  
    ctx.reply(`Harga untuk ukuran yang dipilih adalah ${price} per bulan. Silakan pilih OS:`, Markup.inlineKeyboard(osButtons));
    ctx.deleteMessage(); // Hapus pesan sebelumnya
  });

  // Handle OS selection
  bot.action(/(vps|rdp)_os_.+/, async (ctx) => {
    const [type, , os] = ctx.match[0].split('_');
    userSelections[ctx.from.id].os = os;
    if (type === 'rdp') {
      ctx.reply('Silakan berikan catatan untuk VM (misalnya, versi Windows yang ingin diinstal):');
    } else {
      ctx.reply('Silakan pilih region:', Markup.inlineKeyboard([
        [Markup.button.callback('New York 3 (🇺🇲)', 'region_nyc3')],
        [Markup.button.callback('San Francisco 2 (🇺🇲)', 'region_sfo2')],
        [Markup.button.callback('Amsterdam 3 (🇳🇱)', 'region_ams3')],
        [Markup.button.callback('Singapore 1 (🇸🇬)', 'region_sgp1')],
        [Markup.button.callback('London 1 (🇬🇧)', 'region_lon1')],
        [Markup.button.callback('Frankfurt 1 (🇩🇪)', 'region_fra1')],
        [Markup.button.callback('Toronto 1 (🇨🇦)', 'region_tor1')]
      ]));
    }
    ctx.deleteMessage(); // Hapus pesan sebelumnya
  });
  
  // Handle region selection
  bot.action(/region_.+/, async (ctx) => {
    const region = ctx.match[0].split('_')[1];
    userSelections[ctx.from.id].region = region;
    ctx.reply('Please enter the VM name:');
    ctx.deleteMessage(); // Hapus pesan sebelumnya
  });
  
  // Handle note input for RDP
  bot.on('text', async (ctx) => {
    const userSelection = userSelections[ctx.from.id];
    
    if (!userSelection) return; // Exit if no selection found
  
    if (userSelection.type === 'rdp' && !userSelection.note && userSelection.os) {
      userSelection.note = ctx.message.text;
      ctx.reply('Please choose the region:', Markup.inlineKeyboard([
        [Markup.button.callback('New York 3 (🇺🇲)', 'region_nyc3')],
        [Markup.button.callback('San Francisco 2 (🇺🇲)', 'region_sfo2')],
        [Markup.button.callback('Amsterdam 3 (🇳🇱)', 'region_ams3')],
        [Markup.button.callback('Singapore 1 (🇸🇬)', 'region_sgp1')],
        [Markup.button.callback('London 1 (🇬🇧)', 'region_lon1')],
        [Markup.button.callback('Frankfurt 1 (🇩🇪)', 'region_fra1')],
        [Markup.button.callback('Toronto 1 (🇨🇦)', 'region_tor1')]
      ]));
      ctx.deleteMessage(); // Delete previous message
    } else if (userSelection.region && !userSelection.name) {
      userSelection.name = ctx.message.text;
      const { type, size, os, region, name, note } = userSelection;
  
      // Make sure the user has an account and sufficient balance
      const user = await User.findOne({ userId: ctx.from.id });
      if (!user) {
        return ctx.reply('Anda belum memiliki akun. Lakukan deposit terlebih dahulu.');
      }
  
      const price = prices[size];
      if (!price) {
        return ctx.reply('Harga untuk ukuran VM ini tidak valid.');
      }
  
      const saldo = parseFloat(user.saldo);
      if (isNaN(saldo)) {
        return ctx.reply('Saldo Anda tidak valid.');
      }
  
      // Mengurangi saldo user
      const newSaldo = saldo - price;
      if (isNaN(newSaldo) || newSaldo < 0) {
        return ctx.reply('Saldo Anda tidak mencukupi untuk membuat VM ini. Silakan lakukan deposit terlebih dahulu.');
      }
      user.saldo = newSaldo;
      await user.save();
  
      // VM creation logic
      const password = generateRandomPassword();
      const data = {
        name,
        region,
        size,
        image: os,
        ssh_keys: null,
        backups: false,
        ipv6: false,
        user_data: `#cloud-config\npassword: ${password}\nchpasswd: { expire: False }\nssh_pwauth: True`
      };
  
      if (type === 'vps') {
        try {
          // Membuat VPS
          const response = await doRequest('post', '/droplets', data);
          const droplet = response.droplet;
  
          // Kirim pesan bahwa VM telah dibuat
          ctx.reply(`VM created with ID: ${droplet.id}. Waiting for IP address...`);

          // Cek IP address secara berkala
          const checkIP = setInterval(async () => {
            try {
              const response = await doRequest('get', `/droplets/${droplet.id}`);
              const ip = response.droplet.networks?.v4?.[0]?.ip_address;
  
              if (ip) {
                clearInterval(checkIP);
                ctx.reply(`VPS Anda telah dibuat dengan rincian berikut:
                IP Address: ${ip}
                Username: root
                Password: ${password}`);
                delete userSelections[ctx.from.id];
              }
            } catch (error) {
              console.error(error);
            }
          }, 5000); // Check every 5 seconds
  
        } catch (error) {
          ctx.reply('Error creating VM.');
          console.error(error);
          delete userSelections[ctx.from.id];
        }
      } else if (type === 'rdp') {
        try {
          // Membuat RDP VM
          const response = await doRequest('post', '/droplets', data);
          const droplet = response.droplet;
          userSelections[ctx.from.id].droplet_id = droplet.id;
          userSelections[ctx.from.id].password = password;
          
          // Kirim pesan bahwa VM sedang dibuat
          ctx.reply(`VM created with ID: ${droplet.id}. Waiting for IP address...`);
  
          // Kirim data VM ke owner untuk konfirmasi
          const checkIP = setInterval(async () => {
            try {
              const response = await doRequest('get', `/droplets/${droplet.id}`);
              const ip = response.droplet.networks?.v4?.[0]?.ip_address;
  
              if (ip) {
                clearInterval(checkIP);
                
                const vmInfo = `New RDP VM request:
                User ID: ${ctx.from.id}
                User Name: ${ctx.from.username}
                IP Address: ${ip}
                Name: ${name}
                Username: root
                Password: ${password}
                OS: ${os}
                Note: ${note}
                Size: ${size}
                Region: ${region}`;
  
                bot.telegram.sendMessage(global.ownerId, vmInfo, Markup.inlineKeyboard([
                  [Markup.button.callback('Confirm', `confirm_${ctx.from.id}`)],
                  [Markup.button.callback('Reject', `reject_${ctx.from.id}`)]
                ]));
  
                // Simpan IP address untuk penggunaan selanjutnya
                userSelections[ctx.from.id].ip = ip;
              }
            } catch (error) {
              console.error(error);
            }
          }, 5000); // Check every 5 seconds
        } catch (error) {
          ctx.reply('Error creating VM.');
          console.error(error);
          delete userSelections[ctx.from.id];
        }
      }
    }
  });

// Handle confirmation from owner
bot.action(/confirm_(\d+)/, async (ctx) => {
  const userId = ctx.match[1];
  const userSelection = userSelections[userId];

  if (!userSelection || userSelection.type !== 'rdp') return;

  try {
    const ip = userSelection.ip;
    const password = userSelection.password;

    // Kirim data VM ke user
    await ctx.telegram.sendMessage(userId, `RDP Anda telah disetujui. Berikut detail VM:
    IP Address: ${ip}
    Username: root
    Password: ${password}
    OS: ${userSelection.os}
    Name: ${userSelection.name}
    Size: ${userSelection.size}
    Region: ${userSelection.region}
    Note: ${userSelection.note}`);

    // Konfirmasi pengiriman ke owner
    ctx.reply('RDP VM telah dikonfirmasi dan detail dikirimkan ke pengguna.');

    // Hapus data user dari sesi
    delete userSelections[userId];
  } catch (error) {
    ctx.reply('Terjadi kesalahan saat mengkonfirmasi RDP VM.');
    console.error(error);
  }
});

// Handle rejection from owner
bot.action(/reject_(\d+)/, async (ctx) => {
  const userId = ctx.match[1];
  const userSelection = userSelections[userId];

  if (!userSelection || userSelection.type !== 'rdp') return;

  // Kirim pesan bahwa RDP ditolak
  await ctx.telegram.sendMessage(userId, 'Permintaan RDP Anda ditolak oleh owner.');

  // Konfirmasi penolakan ke owner
  ctx.reply('RDP VM telah ditolak.');

  // Hapus data user dari sesi
  delete userSelections[userId];
});


// Function to list VMs
const listVMs = async (ctx) => {
  try {
    const response = await doRequest('get', '/droplets');
    const droplets = response.droplets;

    if (!droplets || droplets.length === 0) {
      return ctx.reply('No VMs found.');
    }

    const buttons = droplets.map((droplet) => {
      return [Markup.button.callback(`${droplet.name} (${droplet.id})`, `vm_${droplet.id}`)];
    });

    ctx.reply('Select a VM to manage:', Markup.inlineKeyboard(buttons));
  } catch (error) {
    ctx.reply('Error fetching VM list.', { reply_to_message_id: ctx.message.message_id });
    console.error('Error fetching VM list:', error);
  }
};

bot.launch();
console.log('Bot Starting....')
