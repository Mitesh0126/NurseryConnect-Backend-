const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
const app = express();
const PORT = 5001;

// Load environment variables

// MongoDB URI from environment variables
const MONGO_URI = "mongodb+srv://VikasR:VIKAS@cluster.kwe5ycq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster"

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Schemas
const User = mongoose.model('User', new mongoose.Schema({
  userType: String,
  name: String,
  email: String,
  password: String,
  phone: String,
  companyName: String,
  businessLicense: String,
  businessCategory: String,
  businessAddress: String,
  status: String,
  registeredAt: Date
}));

const DealerListing = mongoose.model('DealerListing', new mongoose.Schema({
  dealerId: mongoose.Schema.Types.ObjectId,
  dealerName: String,
  name: String,
  price: Number,
  category: String,
  stock: Number,
  description: String,
  image: String,
  status: String,
  liveStock: Boolean,
  createdAt: Date
}));

const Order = mongoose.model('Order', new mongoose.Schema({
  customerId: mongoose.Schema.Types.ObjectId,
  customerName: String,
  items: Array,
  total: Number,
  contactDetails: Object,
  status: String,
  orderDate: Date,
  estimatedDelivery: Date,
  completedDate: Date
}));

// Admin credentials (in production, use environment variables)
const ADMIN_CREDENTIALS = {
  adminId: 'admin',
  password: 'admin123'
};

// Routes
app.post('/api/admin/login', async (req, res) => {
  const { adminId, adminPassword } = req.body;
  
  if (adminId === ADMIN_CREDENTIALS.adminId && adminPassword === ADMIN_CREDENTIALS.password) {
    res.json({ success: true, message: 'Admin login successful' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid admin credentials' });
  }
});

app.get('/api/admin/stats', async (req, res) => {
  const totalUsers = await User.countDocuments();
  const activeDealers = await User.countDocuments({ userType: 'dealer', status: 'active' });
  const pendingApprovals = await User.countDocuments({ userType: 'dealer', status: 'pending' });
  const totalListings = await DealerListing.countDocuments();
  
  res.json({
    totalUsers,
    activeDealers, 
    pendingApprovals,
    totalListings
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password, userType } = req.body;
  const user = await User.findOne({ email, password, userType });
  if (user) res.json({ success: true, user });
  else res.status(401).json({ success: false, message: 'Invalid credentials' });
});

app.post('/api/auth/register', async (req, res) => {
  const { userType, name, email, password, companyName, businessLicense, phone, businessAddress, businessCategory } = req.body;

  if (await User.findOne({ email })) {
    return res.status(400).json({ success: false, message: 'User already exists' });
  }

  const newUser = new User({
    userType,
    name,
    email,
    password,
    companyName: userType === 'dealer' ? companyName : null,
    businessLicense: userType === 'dealer' ? businessLicense : null,
    businessCategory: userType === 'dealer' ? businessCategory : null,
    phone,
    businessAddress,
    status: userType === 'dealer' ? 'pending' : 'active',
    registeredAt: new Date()
  });

  await newUser.save();
  res.json({ success: true, user: newUser });
});

app.get('/api/plants', async (req, res) => {
  const staticPlants = [
    {
      id: 1,
      name: "Money Plant (Pothos)",
      price: 299,
      image: "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=500&auto=format&fit=crop&q=60",
      description: "Known for bringing good luck and prosperity. Easy to grow, air-purifying plant with heart-shaped leaves.",
      category: "Indoor"
    },
    {
      id: 2,
      name: "Tulsi (Holy Basil)",
      price: 199,
      image: "https://images.unsplash.com/photo-1618164436241-4473940d1f5c?w=400&h=300&fit=crop",
      description: "Sacred plant with medicinal properties. Known for its spiritual significance and health benefits.",
      category: "Outdoor"
    }
  ];

  const liveStockPlants = await DealerListing.find({ liveStock: true, status: 'active' });
  res.json({ plants: [...staticPlants, ...liveStockPlants] });
});

app.get('/api/dealer/listings/:dealerId', async (req, res) => {
  const listings = await DealerListing.find({ dealerId: req.params.dealerId });
  res.json({ listings });
});

app.post('/api/dealer/listings', async (req, res) => {
  const newPlant = new DealerListing({
    ...req.body,
    price: parseFloat(req.body.price),
    stock: parseInt(req.body.stock),
    status: 'active',
    liveStock: true,
    createdAt: new Date()
  });

  await newPlant.save();
  res.json({ success: true, plant: newPlant });
});

app.put('/api/dealer/listings/:plantId', async (req, res) => {
  const plant = await DealerListing.findByIdAndUpdate(req.params.plantId, req.body, { new: true });
  if (plant) res.json({ success: true, plant });
  else res.status(404).json({ success: false, message: 'Plant not found' });
});

app.delete('/api/dealer/listings/:plantId', async (req, res) => {
  const result = await DealerListing.findByIdAndDelete(req.params.plantId);
  if (result) res.json({ success: true });
  else res.status(404).json({ success: false, message: 'Plant not found' });
});

app.post('/api/orders', async (req, res) => {
  const order = new Order({
    ...req.body,
    status: 'new',
    orderDate: new Date(),
    estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  await order.save();
  res.json({ success: true, order });
});

app.get('/api/orders/customer/:customerId', async (req, res) => {
  const orders = await Order.find({ customerId: req.params.customerId });
  res.json({ orders });
});

app.get('/api/orders/dealer/:dealerId', async (req, res) => {
  const listings = await DealerListing.find({ dealerId: req.params.dealerId });
  const dealerPlantIds = listings.map(p => p._id.toString());
  const orders = await Order.find({
    items: { $elemMatch: { id: { $in: dealerPlantIds } } }
  });
  res.json({ orders });
});

app.put('/api/orders/:orderId/status', async (req, res) => {
  const update = { status: req.body.status };
  if (req.body.status === 'completed') update.completedDate = new Date();

  const order = await Order.findByIdAndUpdate(req.params.orderId, update, { new: true });
  if (order) res.json({ success: true, order });
  else res.status(404).json({ success: false, message: 'Order not found' });
});

app.get('/api/admin/users', async (req, res) => {
  const users = await User.find();
  res.json({ users });
});

app.put('/api/admin/users/:userId/status', async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.userId, { status: req.body.status }, { new: true });
  if (user) res.json({ success: true, user });
  else res.status(404).json({ success: false, message: 'User not found' });
});

app.get('/api/admin/dealers', async (req, res) => {
  const dealers = await User.find({ userType: 'dealer' });
  res.json({ dealers });
});

app.get('/api/admin/listings', async (req, res) => {
  const listings = await DealerListing.find().populate('dealerId', 'name');
  res.json({ listings });
});

app.put('/api/admin/listings/:listingId/status', async (req, res) => {
  const listing = await DealerListing.findByIdAndUpdate(req.params.listingId, { status: req.body.status }, { new: true });
  if (listing) res.json({ success: true, listing });
  else res.status(404).json({ success: false, message: 'Listing not found' });
});

app.delete('/api/admin/listings/:listingId', async (req, res) => {
  const result = await DealerListing.findByIdAndDelete(req.params.listingId);
  if (result) res.json({ success: true });
  else res.status(404).json({ success: false, message: 'Listing not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
});
