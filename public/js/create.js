import { getElementArray } from './utils/getElementArray.js';
import { showMessage } from './utils/messages.js';
import { createElement } from './utils/createElementFromSelector.js';

const initState = {
	name: '',
	rounds: [
		new Array(6).fill(0).map((el) => {
			return {
				category: '',
				comments: '',
				clues: new Array(5).fill(0).map((el) => {
					return {
						text: '',
						response: '',
					};
				}),
			};
		}),
		new Array(6).fill(0).map((el) => {
			return {
				category: '',
				comments: '',
				clues: new Array(5).fill(0).map((el) => {
					return {
						text: '',
						response: '',
					};
				}),
			};
		}),
		{
			category: '',
			text: '',
			response: '',
		},
	],
};
const sh = new StateHandler(initState);

const msgDiv = document.querySelector('#header-message');

const createArea = document.querySelector('#create-tab-pane');

const loadFile = createArea.querySelector('#load-file');
const saveButton = createArea.querySelector('#save-data');

const roundSelect = getElementArray(
	createArea,
	'input[type="radio"][name="selected-round"]'
);
const categorySelect = createArea.querySelector('#category-select');
const categories = getElementArray(categorySelect, 'option');
const categoryName = createArea.querySelector('#category-name');
const categoryComments = createArea.querySelector('#category-comments');
const valueSelect = getElementArray(
	createArea,
	'input[type="radio"][name="selected-clue"]'
);
const clueText = createArea.querySelector('#edit-clue-text');
const correctResponse = createArea.querySelector('#correct-response');

const textInputs = getElementArray(createArea, 'input[type="text"],textarea');

const resultModal = new bootstrap.Modal('#create-data-modal');
const list = document.querySelector('#data-warnings');

const hideHeaderMessage = () => {
	msgDiv.classList.add('d-none');
};

let msgTimeout = {
	value: null,
};
const showHeaderMessage = (type, text, duration) => {
	const msgTypes = [
		{
			type: 'error',
			color: '#ffffff',
			bgcolor: '#ab0000',
		},
		{
			type: 'info',
			color: '#000000',
			bgcolor: '#d9ffd6',
		},
		{
			type: 'warning',
			color: '#000000',
			bgcolor: '#ffff00',
		},
	];
	if (msgTimeout.value !== null) clearTimeout(msgTimeout.value);
	hideHeaderMessage();
	let color;
	let bgcolor;
	let msgType = msgTypes.find((el) => {
		return el.type === type;
	});
	if (msgType) {
		color = msgType.color;
		bgcolor = msgType.bgcolor;
	} else {
		color = 'black';
		bgcolor = 'white';
	}
	msgDiv.innerHTML = text;
	msgDiv.style = `color:${color};background-color:${bgcolor};opacity:1;`;
	msgDiv.classList.remove('d-none');
	msgTimeout.value = setTimeout(hideHeaderMessage, duration || 1000);
};

const getSelectedClue = () => {
	const selectedRound = roundSelect.find((el) => {
		return el.checked;
	});
	if (!selectedRound) return null;
	const round = Number(selectedRound.value);
	if (isNaN(round)) return null;

	const state = sh.getState();

	if (round === 2)
		return {
			round: 2,
			data: state.rounds.length === 3 ? { ...state.rounds[2] } : null,
		};

	const category = Number(categorySelect.value);
	if (isNaN(category) || category < 0 || category > 5) return null;

	const selectedClue = valueSelect.find((el) => {
		return el.checked;
	});
	if (!selectedClue) return null;
	const clue = Number(selectedClue.value);
	if (isNaN(clue)) return null;

	return {
		round,
		category,
		clue,
		data: {
			...state.rounds[round][category].clues[clue],
			category: state.rounds[round][category].category,
			comments: state.rounds[round][category].comments,
		},
	};
};

//populate category names in the selector
//populate category select on round selection
const populateCategoryNames = () => {
	const sc = getSelectedClue();
	if (sc.round === 2) return;
	else {
		const round = sh.getState().rounds[sc.round];
		if (!round) return;
		categories.forEach((c) => {
			const val = Number(c.getAttribute('value'));
			if (isNaN(val)) return;
			if (round[val].category === '') {
				c.innerHTML = `${val + 1}. [Blank] ⚠️`;
				c.classList.add('invalid');
			} else if (
				round[val].clues.some(
					(clue) => clue.text.trim() === '' || clue.response.trim === ''
				)
			) {
				c.innerHTML = `${val + 1}. ${round[val].category} ⚠️`;
				c.classList.add('invalid');
			} else {
				c.innerHTML = `${val + 1}. ${round[val].category}`;
				c.classList.remove('invalid');
			}
		});
	}
};

const populateSelectedClue = () => {
	const sc = getSelectedClue();
	const state = sh.getState();

	categoryName.value = sc.data.category;
	categoryComments.value = sc.data.comments;
	clueText.value = sc.data.text;
	correctResponse.value = sc.data.response;

	populateCategoryNames();
	//check validity of round
	//round radio
	state.rounds.forEach((round, rd) => {
		const radio = createArea.querySelector(
			`input[type="radio"][name="selected-round"][value="${rd}"]`
		);
		//FJ needs a category, text, and response
		if (rd === 2) {
			const { category, text, response } = state.rounds[2];
			if (
				category &&
				category.trim() !== '' &&
				text &&
				text.trim() !== '' &&
				response &&
				response.trim() !== ''
			)
				radio.classList.remove('invalid');
			else radio.classList.add('invalid');
		} else {
			//other rounds need every category...
			if (
				round.every((cat) => {
					return (
						//to have a category text
						cat.category.trim() !== '' &&
						cat.clues.length === 5 &&
						//...and for every clue in it to have a text and response
						cat.clues.every((clue, cl) => {
							const val = valueSelect[cl];
							if (clue.text.trim() !== '' && clue.response.trim() !== '') {
								val.classList.remove('invalid');
								return true;
							}
							val.classList.add('invalid');
							return false;
						})
					);
				})
			)
				radio.classList.remove('invalid');
			else radio.classList.add('invalid');
		}
	});
};

//populate clue data on selection
sh.addWatcher(null, populateSelectedClue);
[...roundSelect, ...valueSelect, categorySelect].forEach((el) =>
	el.addEventListener('change', populateSelectedClue)
);

roundSelect.forEach((rs) =>
	rs.addEventListener('change', () => {
		populateCategoryNames();
		categorySelect.selectedIndex = 0;
	})
);
sh.addWatcher(null, populateCategoryNames);

//change data when text inputs change
const handleDataChange = (e) => {
	const sc = getSelectedClue();
	sh.setState((prev) => {
		if (sc.round === 2)
			prev.rounds[2] = {
				category: categoryName.value,
				text: clueText.value,
				response: correctResponse.value,
			};
		else if (sc.round === 1 || sc.round === 0) {
			prev.rounds[sc.round][sc.category].category = categoryName.value;
			prev.rounds[sc.round][sc.category].comments = categoryComments.value;
			prev.rounds[sc.round][sc.category].clues[sc.clue].text = clueText.value;
			prev.rounds[sc.round][sc.category].clues[sc.clue].response =
				correctResponse.value;
		}
		showHeaderMessage('info', 'Data saved');
		return prev;
	});
	populateCategoryNames();
};
textInputs.forEach((t) => {
	t.addEventListener('change', handleDataChange);
});

const validateData = (data) => {
	let messages = [];
	let newData = { ...initState };

	if (!data.rounds || !Array.isArray(data.rounds)) {
		messages.push('JSON object does not contain rounds array');
		return { messages, data: newData };
	}

	if (data.rounds?.length !== 3)
		messages.push('JSON object must contain 3 rounds');
	let a = data.rounds.findIndex((rd, i) => i < 2 && rd.length < 6);
	if (a >= 0) messages.push(`Round ${a + 1} does not contain 6 categories`);
	[0, 1].forEach((rd, i) => {
		data.rounds[rd].forEach((cat, j) => {
			if (!cat.clues || !Array.isArray(cat.clues))
				messages.push(
					`Round ${i + 1}, category ${j + 1}${
						cat.category ? ` (${cat.category.toUpperCase()})` : ''
					} does not contain a clue array`
				);
			else if (cat.clues.length !== 5)
				messages.push(
					`Round ${i + 1}, category ${j + 1}${
						cat.category ? ` (${cat.category.toUpperCase()})` : ''
					} does not contain 5 clues`
				);
		});
	});

	if (data.name) newData.name = data.name;
	data.rounds.forEach((rd, i) => {
		const newRound = newData.rounds[i];
		if (i === 2) {
			newRound.category = rd.category || '';
			newRound.text = rd.text || '';
			newRound.response = rd.response || '';
		} else {
			if (!Array.isArray(rd)) return;
			rd.forEach((cat, j) => {
				if (j < newRound.length) {
					const newCategory = newRound[j];
					newCategory.category = cat.category || '';
					newCategory.comments = cat.comments || '';
					if (!Array.isArray(cat.clues)) return;
					const newClues = newCategory.clues;
					cat.clues.forEach((clue, k) => {
						if (k < newClues.length) {
							newClues[k].text = clue.text || '';
							newClues[k].response = clue.response || '';
						}
					});
				}
			});
		}
	});

	return { messages, data: newData };
};
loadFile.addEventListener('change', (e) => {
	const file = loadFile.files[0];
	if (!file) return;
	else if (file.type !== 'application/json')
		return showMessage('error', 'Invalid file format');

	const reader = new FileReader();
	reader.addEventListener('load', () => {
		const data = JSON.parse(reader.result);
		const result = validateData(data);
		if (resultModal && result.messages.length > 0) {
			list.innerHTML = '';
			result.messages.forEach((msg) => {
				const li = createElement('li');
				li.innerHTML = msg;
				list.appendChild(li);
			});
			resultModal.show();
		} else showMessage('info', 'Data successfully loaded');
		sh.setState({ ...result.data, name: file.name });
	});
	reader.readAsText(file, 'utf-8');
});

saveButton.addEventListener('click', () => {
	const state = sh.getState();
	const dataStr =
		'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state));
	const dlAnchorElem = createElement('a');
	dlAnchorElem.setAttribute('href', dataStr);
	dlAnchorElem.setAttribute('download', state.name || 'game.json');
	dlAnchorElem.click();
	dlAnchorElem.remove();
});
