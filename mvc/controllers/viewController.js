const fs = require('fs');
const path = require('path');
const { readdir, readFile } = require('node:fs/promises');
const template = require('../template');

exports.httpsRedirect = (req, res, next) => {
	if (
		process.env.NODE_ENV === 'production' &&
		req.headers.host !== `localhost:${process.env.PORT}`
	) {
		if (req.header('x-forwarded-proto') !== 'https') {
			return res.redirect(`https://${req.header('host')}${req.url}`);
			// next() ;
		}
	}
	next();
};

exports.getHome = async (req, res, next) => {
	try {
		const folder = path.join(__dirname, `../games`);
		const files = (await readdir(folder, { recursive: true }))
			.filter((f) => f.indexOf('.json') > 0)
			.map((f) => f.replace('\\', '/'))
			.map((f) => {
				const data = require(`../games/${f}`);
				if (data.metadata)
					return {
						name: f,
						metadata: data.metadata,
					};
				return {
					name: f,
				};
			});

		res.status(200).render('home', {
			title: 'This is...J-Play!',
			key: false,
			files,
		});
	} catch (err) {
		res.status(200).render('home', {
			title: 'This is...J-Play!',
			key: false,
			files: [],
		});
	}
};

exports.getHelp = async (req, res, next) => {
	res.status(200).render('help', {
		title: 'J-Play Help!',
		template,
	});
};

exports.getGame = async (req, res, next) => {
	const folder = req.params.folder;
	const filename = req.params.filename;

	const data = (
		await readFile(path.join(__dirname, `../games/${folder}/${filename}`))
	).toString('utf-8');

	res.status(200).json({
		status: 'success',
		data: JSON.parse(data),
	});
};

exports.getControlPanel = async (req, res, next) => {
	res.status(200).render('controlpanel', {
		title: 'Control Panel',
		key: true,
	});
};

exports.getTimer = async (req, res, next) => {
	return res.status(200).render('timer');
};

exports.redirectToIndex = (req, res, next) => {
	if (req.originalUrl !== '/favicon.ico') return res.redirect(`/`);
	else
		res.status(404).json({
			status: 'fail',
		});
};
