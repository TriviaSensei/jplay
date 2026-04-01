export const getEmbeddedLink = (
	media,
	startingTime,
	endingTime,
	audio,
	video,
) => {
	if (media.length === 0)
		return {
			status: 'fail',
			message: 'No link given',
		};
	if (
		media.toLowerCase().indexOf('youtube') < 0 &&
		media.toLowerCase().indexOf('youtu.be') < 0 &&
		media.toLowerCase().indexOf('drive.google.com/file/d') < 0
	) {
		return {
			status: 'fail',
			message: 'YouTube or Google Drive link is required',
		};
	}

	let videoID;
	let postFix = '?controls=0&autoplay=1';
	if (startingTime > 0) postFix = postFix + `&start=${startingTime}`;
	if (endingTime > 0) postFix = postFix + `&end=${endingTime}`;
	if (!audio) postFix = postFix = postFix + `&mute=1`;
	if (!video && audio) postFix = postFix + `&audioonly=1`;
	else if (!video && !audio)
		return {
			status: 'fail',
			message: 'You must turn on either video or audio',
		};

	if (media.toLowerCase().indexOf('youtube.com/embed') >= 0) {
		const tokens = media.split('/').filter((t) => t.trim().length > 0);
		videoID = tokens[tokens.length - 1];
		if (videoID.toLowerCase() === 'embed') {
			return {
				status: 'fail',
				message:
					'Could not parse video link - video ID not found. Check your link.',
			};
		}
	} else if (media.toLowerCase().indexOf('youtube') >= 0) {
		const tokens = media.split('&');
		if (tokens.length === 0) {
			return {
				status: 'fail',
				message: 'Could not parse video link. Check your link.',
			};
		}
		videoID = tokens[0].split('=')[1];
		if (!videoID) {
			return {
				status: 'fail',
				message: 'Could not parse video link. Check your link.',
			};
		}
	} else if (media.toLowerCase().indexOf('youtu.be') >= 0) {
		const tokens = media.split('/').filter((t) => t.trim().length > 0);
		if (tokens.length < 2) {
			return {
				status: 'fail',
				message: 'Could not parse video link. Check your link.',
			};
		}
		videoID = tokens[tokens.length - 1];
		if (!videoID) {
			return {
				status: 'fail',
				message: 'Could not parse video link. Check your link.',
			};
		}
	}
	return {
		status: 'success',
		link: `https://www.youtube.com/embed/${videoID}${postFix}`,
	};
};
