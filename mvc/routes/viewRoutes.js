const express = require('express');
const router = express.Router();

const viewController = require('../controllers/viewController');

router.get('/', viewController.getHome);
router.get('/test', viewController.getTest);
router.get('/control', viewController.getControlPanel);
router.get('/games/:folder/:filename', viewController.getGame);
module.exports = router;
