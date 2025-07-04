const express = require('express');
const router = express.Router();

const viewController = require('../controllers/viewController');

router.get('/', viewController.getHome);
module.exports = router;
