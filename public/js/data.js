import { createElement } from './utils/createElementFromSelector.js';

const table = document.querySelector('#result-table');
const nameRow = table.querySelector('#name-row');
const scoreRow = table.querySelector('#score-row');

const stats = [
	{
		title: 'After DJ!',
		aggregate: (gameData, i) => {
			const score = gameData.reduce((p, c) => {
				return p + (c.data[i].result || 0);
			}, 0);
			return `${score < 0 ? '-' : ''}$${Math.abs(score).toLocaleString('en')}`;
		},
	},
	{
		title: 'After J!',
		aggregate: (gameData, i) => {
			const score = gameData.reduce((p, c) => {
				if (c.round !== 1) return p;
				return p + (c.data[i].result || 0);
			}, 0);
			return `${score < 0 ? '-' : ''}$${Math.abs(score).toLocaleString('en')}`;
		},
	},
	{
		title: 'Buzz Att',
		aggregate: (gameData, i) => {
			return gameData.reduce((p, c) => {
				return p + (c.data[i].buzz ? 1 : 0);
			}, 0);
		},
	},
	{
		title: 'Early Buzz',
		aggregate: (gameData, i) => {
			return gameData.reduce((p, c) => {
				return p + (c.data[i].early ? 1 : 0);
			}, 0);
		},
	},
	{
		title: 'First Buzz',
		aggregate: (gameData, i) => {
			return gameData.reduce((p, c) => {
				return p + (c.data[i].first ? 1 : 0);
			}, 0);
		},
	},
	{
		title: 'Avg Reax Time (ms)',
		aggregate: (gameData, i) => {
			const agg = gameData.reduce(
				(p, c) => {
					return {
						total: c.data[i].buzz ? p.total + c.data[i].time : p.total,
						count: c.data[i].buzz ? p.count + 1 : p.count,
					};
				},
				{
					total: 0,
					count: 0,
				}
			);
			if (agg.count > 0) return `${(agg.total / agg.count).toFixed(0)}`;
			return `N/A`;
		},
	},
	{
		title: 'Correct/Res',
		aggregate: (gameData, i) => {
			const agg = gameData.reduce(
				(p, c) => {
					return {
						correct: c.data[i].result > 0 ? p.correct + 1 : p.correct,
						incorrect: c.data[i].result < 0 ? p.incorrect + 1 : p.incorrect,
					};
				},
				{
					correct: 0,
					incorrect: 0,
				}
			);
			return `${agg.correct}/${agg.correct + agg.incorrect} (${(
				(100 * agg.correct) /
				(agg.correct + agg.incorrect)
			).toFixed(1)}%)`;
		},
	},
	{
		title: 'Rebounds',
		aggregate: (gameData, i) => {
			return gameData.reduce((p, c) => {
				return (
					p + (!c.isDD && !c.data[i].first && c.data[i].result > 0 ? 1 : 0)
				);
			}, 0);
		},
	},
	{
		title: 'Coryat',
		aggregate: (gameData, i) => {
			const coryat = gameData.reduce((p, c) => {
				if (c.round > 2) return p;
				const mult = c.round === 1 ? 200 : c.round === 2 ? 400 : 0;
				const row = c.clue + 1;
				const value = mult * row;
				if (c.isDD) return p + (c.data[i].value > 0 ? value : 0);
				return p + c.data[i].result;
			}, 0);

			return `${coryat < 0 ? '-' : ''}$${coryat.toLocaleString('en')}`;
		},
	},
	{
		title: 'DD',
		aggregate: (gameData, i) => {
			const agg = gameData.reduce(
				(p, c) => {
					if (c.isDD && c.data[i].result !== 0) {
						return {
							count: p.count + 1,
							correct: p.correct + (c.data[i].result > 0 ? 1 : 0),
							result: p.result + c.data[i].result,
						};
					} else return p;
				},
				{
					count: 0,
					correct: 0,
					result: 0,
				}
			);
			return `${agg.correct}/${agg.count} (${
				agg.result < 0 ? '-' : ''
			}$${Math.abs(agg.result).toLocaleString('en')})`;
		},
	},
	{
		title: 'FJ?',
		aggregate: (gameData, i) => {
			const dt = gameData.find((d) => d.round === 3);
			if (!dt) return '?';
			else if (dt.data[i].correct) return '✅';
			else return '❌';
		},
	},
];

document.addEventListener(
	'process-data',
	(e) => {
		const data = e.detail;

		data.players.forEach((p) => {
			if (!p.name) return;
			const cell = createElement('td');
			cell.innerHTML = p.name;
			nameRow.appendChild(cell);
			const score = createElement(`td${p.score < 0 ? '.neg' : ''}`);
			score.innerHTML = `${p.score < 0 ? '-' : ''}$${Math.abs(
				p.score
			).toLocaleString('en')}`;
			scoreRow.appendChild(score);
		});

		stats.forEach((st) => {
			const row = createElement('tr');
			const title = createElement('td');
			title.innerHTML = st.title;
			row.appendChild(title);
			data.players.forEach((p, i) => {
				if (!p.name) return;
				const cell = createElement('td');
				cell.innerHTML = st.aggregate(data.gameData, i);
				row.appendChild(cell);
			});
			table.appendChild(row);
		});
		const evt = new CustomEvent('data-ready');
		document.dispatchEvent(evt);
	},
	{ once: true }
);
