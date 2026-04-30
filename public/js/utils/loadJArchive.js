export const getGame = (html) => {
	const data = parser.parse(html);

	const gameData = data.querySelector('#game_title h1')?.innerHTML;
	const gameComments = data.querySelector('#game_comments')?.innerHTML;
	const toReturn = {
		metadata: {
			'Show number': null,
			'Air date': null,
			Comments: gameComments || '',
		},
		rounds: [],
	};
	if (gameData) {
		const arr = gameData.split('-');
		const a = arr[0].split('#');
		if (a.length >= 2) toReturn.metadata['Show number'] = Number(a[1].trim());
		const b = arr[arr.length - 1].split(',');
		if (b.length >= 3) {
			const ad = `${b[b.length - 2]},${b[b.length - 1]}`.trim();
			toReturn.metadata['Air date'] = moment
				.tz(new Date(ad), 'America/New_York')
				.startOf('day')
				.format()
				.split('T')[0];
		}
		['jeopardy_round', 'double_jeopardy_round'].forEach((r) => {
			const area = data.querySelector(`#${r}`);
			if (!area) return toReturn.rounds.push([]);
			const table = area.querySelector('table.round');
			if (!table) return toReturn.rounds.push([]);

			const rows = table.querySelectorAll('tr');
			const round = [];

			rows.forEach((row, i) => {
				if (i === 0) {
					const categories = row.querySelectorAll('td.category').map((c) => {
						const name = c.querySelector('td.category_name')?.innerHTML || '';
						const comments =
							c.querySelector('td.category_comments')?.innerHTML || '';
						return {
							name,
							comments,
						};
					});

					categories.forEach((c) => {
						round.push({
							category: c.name,
							comments: c.comments,
							clues: [],
						});
					});
				} else {
					const clues = row.querySelectorAll('td.clue');
					clues.forEach((c, i) => {
						const text = c.querySelector('.clue_text')?.innerHTML || '';
						const response =
							c.querySelector('.correct_response')?.innerHTML || '';

						round[i].clues.push({
							text,
							response,
						});
					});
				}
			});
			toReturn.rounds.push(round);
		});

		const fj = {
			category:
				data.querySelector('#final_jeopardy_round .category_name')?.innerHTML ||
				'',
			text: data.querySelector('#clue_FJ.clue_text')?.innerHTML || '',
			response:
				data.querySelector('#clue_FJ_r.clue_text .correct_response')
					?.innerHTML || '',
		};

		toReturn.rounds.push(fj);
	}
	['Air date', 'Show number', 'Comments'].forEach((el) => {
		if (!toReturn.metadata[el]) delete toReturn.metadata[el];
	});
	return toReturn;
};
