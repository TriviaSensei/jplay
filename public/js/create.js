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

const createArea = document.querySelector('#create-tab-pane .game-data');

const loadFile = document.querySelector('#create-tab-pane #load-file');
const saveButton = document.querySelector('#create-tab-pane #save-data');

const metadataArea = document.querySelector(
	'#create-tab-pane .create-game-metadata'
);
const addMetadata = document.querySelector(
	'#create-tab-pane #create-game-metadata'
);

const gameNotes = document.querySelector('#game-notes');

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
		const state = sh.getState();
		if (!state) return;
		const round = state.rounds[sc.round];
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

	categoryName.value = sc.data.category;
	categoryComments.value = sc.data.comments;
	clueText.value = sc.data.text;
	correctResponse.value = sc.data.response;

	populateCategoryNames();
	validateAll();
};

const validateAll = () => {
	const state = sh.getState();
	const selectedRound = createArea.querySelector(
		`input[type="radio"][name="selected-round"]:checked`
	);
	if (!selectedRound) return;
	const selectedRoundNo = Number(selectedRound.getAttribute('value'));
	//for each round
	state.rounds.forEach((round, rd) => {
		const radio = createArea.querySelector(
			`input[type="radio"][name="selected-round"][value="${rd}"]`
		);
		//assume it's valid to start
		radio.classList.remove('invalid');
		//FJ needs a category, text, and response
		if (rd === 2) {
			const { category, text, response } = state.rounds[2];
			if (!category?.trim() || !text?.trim() || !response?.trim())
				radio.classList.add('invalid');
		} else {
			//all other rounds
			round.forEach((cat, catNo) => {
				//the category text must not be empty and it must have 5 clues, or the entire round is invalid
				if (!cat?.category?.trim() || cat.clues.length !== 5)
					radio.classList.add('invalid');

				//within the category
				cat.clues.forEach((clue, clueNo) => {
					//each clue must have text and response or the round is invalid
					const clueValid =
						(clue.text ? clue.text.trim() !== '' : false) &&
						(clue.response ? clue.response.trim() !== '' : false);
					if (!clueValid) radio.classList.add('invalid');

					if (
						catNo === categorySelect.selectedIndex &&
						rd === selectedRoundNo
					) {
						const clueRadio = createArea.querySelector(
							`input[type="radio"][name="selected-clue"][value="${clueNo}"]`
						);
						if (clueRadio) {
							const lbl = createArea.querySelector(
								`label[for="${clueRadio.id}"]`
							);
							console.log(lbl);
							console.log(clue);
							console.log(clueValid);
							if (!clueValid) clueRadio.classList.add('invalid');
							else clueRadio.classList.remove('invalid');
						}
					}
				});
			});
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
sh.addWatcher(null, validateAll);
//change data when text inputs change
const handleDataChange = (e) => {
	if (e.target === gameNotes) {
		sh.setState((prev) => {
			return {
				...prev,
				gameNotes: e.target.value,
			};
		});
	}
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
	validateAll();
};
textInputs.forEach((t) => {
	t.addEventListener('change', handleDataChange);
});

const legalChars = 'abcdefghijklmnopqrstuvwxyz1234567890-_ ';
const validateTitle = (e) => {
	const chars = e.target.value.toLowerCase().split('');
	const t = e.target.closest('.metadata-title');
	if (!t) return;
	if (
		chars.length > 0 &&
		chars.every((char) => legalChars.indexOf(char) >= 0)
	) {
		const titles = getElementArray(metadataArea, '.metadata-title input');
		for (var i = 0; i < titles.length; i++) {
			if (titles[i] === e.target) break;
			if (titles[i].value.toLowerCase() === e.target.value.toLowerCase()) {
				t.classList.add('invalid');
				return;
			}
		}
		t.classList.remove('invalid');
	} else t.classList.add('invalid');
};
const validateValue = (e) => {
	const v = e.target.closest('.metadata-value');
	if (!v) return;
	const val = e.target.value;
	if (val.length > 0) v.classList.remove('invalid');
	else v.classList.add('invalid');
};

//handle game metadata
const removeMetadataItem = (e) => {
	const item = e.target.closest('.metadata-item');
	if (item) item.remove();

	const titles = getElementArray(metadataArea, '.metadata-title input');
	titles.forEach((t) => validateTitle({ target: t }));
};
const createMetadataItem = (name, value) => {
	const newItem = createElement('.metadata-item');
	const t = createElement(`.metadata-title${name ? '' : '.invalid'}`);
	const in1 = createElement('input');
	in1.setAttribute('type', 'text');
	in1.addEventListener('change', validateTitle);
	in1.addEventListener('blur', validateTitle);
	t.appendChild(in1);
	in1.value = name;
	const v = createElement(`.metadata-value${value ? '' : '.invalid'}`);
	const in2 = createElement('input');
	in2.setAttribute('type', 'text');
	v.appendChild(in2);
	in2.value = value;
	in2.addEventListener('change', validateValue);
	in2.addEventListener('blur', validateValue);
	newItem.appendChild(t);
	newItem.appendChild(v);
	const b = createElement('button.delete-button');
	b.addEventListener('click', removeMetadataItem);
	newItem.appendChild(b);
	return newItem;
};

addMetadata.addEventListener('click', (e) => {
	const newItem = createMetadataItem('', '');
	metadataArea.appendChild(newItem);
	const inp = newItem.querySelector('.metadata-title input');
	inp.focus();
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
		metadataArea.innerHTML = '';
		if (data.metadata) {
			const attrs = Object.getOwnPropertyNames(data.metadata);
			attrs.forEach((attr) => {
				const item = createMetadataItem(attr, data.metadata[attr]);
				metadataArea.appendChild(item);
			});
		}
		gameNotes.value = '';
		if (data.gameNotes) gameNotes.value = data.gameNotes;
	});
	reader.readAsText(file, 'utf-8');
});

const getMetadataItem = (item) => {
	const title = item?.querySelector('.metadata-title input')?.value;
	if (!title)
		return { status: 'fail', message: 'All metadata items must have a name.' };
	const value = item.querySelector('.metadata-value input')?.value;
	if (!value)
		return {
			status: 'fail',
			message: `Metadata item "${title}" is missing a value`,
		};

	const chars = title.toLowerCase().split('');
	if (!chars.every((char) => legalChars.indexOf(char) >= 0))
		return {
			status: 'fail',
			message: `Metadata item "${title}" has an illegal character in the name`,
		};

	return {
		status: 'OK',
		title,
		value,
	};
};

saveButton.addEventListener('click', () => {
	const state = sh.getState();
	const metadataItems = getElementArray(metadataArea, '.metadata-item');
	const metadata = {};
	for (var i = 0; i < metadataItems.length; i++) {
		const extract = getMetadataItem(metadataItems[i]);
		if (extract.status !== 'OK')
			return showMessage('error', extract.message, 2000);
		metadata[extract.title] = extract.value;
	}
	const dataStr =
		'data:text/json;charset=utf-8,' +
		encodeURIComponent(
			JSON.stringify({
				metadata,
				...state,
			})
		);
	const dlAnchorElem = createElement('a');
	dlAnchorElem.setAttribute('href', dataStr);
	dlAnchorElem.setAttribute('download', state.name || 'game.json');
	dlAnchorElem.click();
	dlAnchorElem.remove();
});
