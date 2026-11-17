const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAllProductsAdmin,
  getProductByIdAdmin,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
  uploadImage,
} = require('../controllers/adminController');
const { protectAdmin } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

// All admin routes are protected
router.use(protectAdmin);

router.get('/dashboard', getDashboardStats);
router.get('/products', getAllProductsAdmin);
router.get('/products/:id', getProductByIdAdmin);
router.post('/products', upload.array('images', 5), createProduct);
router.put('/products/:id', upload.array('images', 5), updateProduct);
router.delete('/products/:id', deleteProduct);
router.patch('/products/:id/toggle', toggleProductStatus);
router.post('/upload', upload.single('image'), uploadImage);

module.exports = router;
