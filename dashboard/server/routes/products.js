const express = require('express');
const { query, execute } = require('../db');

const router = express.Router();

// GET /api/products — list all products
router.get('/', async (req, res) => {
  try {
    const products = await query('SELECT * FROM Products ORDER BY Category, Name');
    res.json(products);
  } catch (err) {
    console.error('Error fetching products:', err.message);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/:id — get one product by Id
router.get('/:id', async (req, res) => {
  try {
    const products = await query('SELECT * FROM Products WHERE Id = @id', {
      id: parseInt(req.params.id, 10),
    });

    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(products[0]);
  } catch (err) {
    console.error('Error fetching product:', err.message);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// PATCH /api/products/:id/stock — update stock level
router.patch('/:id/stock', async (req, res) => {
  try {
    const { stock } = req.body;
    const productId = parseInt(req.params.id, 10);

    if (stock === undefined || stock === null) {
      return res.status(400).json({ error: 'Stock value is required' });
    }

    const result = await execute(
      'UPDATE Products SET Stock = @stock WHERE Id = @id',
      { stock: parseInt(stock, 10), id: productId }
    );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const updated = await query('SELECT * FROM Products WHERE Id = @id', { id: productId });
    res.json(updated[0]);
  } catch (err) {
    console.error('Error updating stock:', err.message);
    res.status(500).json({ error: 'Failed to update stock' });
  }
});

module.exports = router;
