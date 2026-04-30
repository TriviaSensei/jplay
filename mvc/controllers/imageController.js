const axios = require('axios');

exports.imgurUpload = async (req, res, next) => {
	try {
		if (!Array.isArray(req.body.files))
			return res.status(400).json({
				status: 'fail',
				message: 'Invalid input',
			});
		const config = {
			method: 'POST',
			maxBodyLength: Infinity,
			url: 'https://api.imgur.com/3/image',
			headers: {
				Authorization: `bearer ${process.env.IMGUR_API_KEY}`,
			},
		};
		const results = await Promise.all(
			req.body.files.map(async (file) => {
				const result = await axios({
					...config,
					data: {
						image: file,
						type: 'file',
					},
				});
			}),
		);
		res.status(200).json({
			status: 'success',
			data: results,
		});
	} catch (err) {
		console.log(err.message);
		res.status(400).json({
			status: 'fail',
			message: err.message,
		});
	}
};

exports.imgurDelete = (req, res, next) => {
	res.status(200).json({
		status: 'success',
		data: req.body,
	});
};
