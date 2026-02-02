const express = require('express');
const db = require('../utils/db');

const router = express.Router();

// 获取所有分类
router.get('/', async (req, res) => {
  try {
    const categories = await db.findAll('SELECT * FROM Category ORDER BY sortOrder ASC');

    const categoryData = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      nameCn: cat.nameCn,
      sortOrder: cat.sortOrder
    }));

    res.json({
      success: true,
      data: categoryData
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get categories'
    });
  }
});

// 根据名称获取分类
router.get('/:name', async (req, res) => {
  try {
    const { name } = req.params;

    const category = await db.findOne('SELECT * FROM Category WHERE name = ? OR nameCn = ?', [name, name]);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const categoryData = {
      id: category.id,
      name: category.name,
      nameCn: category.nameCn,
      sortOrder: category.sortOrder
    };

    res.json({
      success: true,
      data: categoryData
    });
  } catch (error) {
    console.error('Get category by name error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get category'
    });
  }
});

module.exports = router;
