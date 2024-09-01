const mongoose = require('mongoose');

// MongoDB connection setup
mongoose.connect(global.MONGODB_URI, {
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
const StockSchema = new mongoose.Schema({
  kode: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true }
});

const Stock = mongoose.model('Stock', StockSchema);

module.exports = Stock;



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

// Export models
module.exports = {
  Stock,
  Product,
  User,
  Deposit
};