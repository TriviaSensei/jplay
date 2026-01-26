const express = require('express');
const router = express.Router();

const viewController = require('../controllers/viewController');

router.get('/', viewController.getHome);
router.get('/help', viewController.getHelp);
// router.get('/test', viewController.getTest);
router.get('/control', viewController.getControlPanel);
router.get('/timer', viewController.getTimer);
router.get('/games/:folder/:filename', viewController.getGame);
router.get('/test', viewController.getTest);
module.exports = router;
